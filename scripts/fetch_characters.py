#!/usr/bin/env python3
"""Fetch 部编版小学语文识字表(二类字)/写字表(一类字) from zitie.xueyuqu.com.

Source: 学于趣字帖 (https://zitie.xueyuqu.com)
  /zg/{0-11}/characters  -> 识字表 (recognition, 会认)
  /zg/{0-11}/dictations  -> 写字表 (writing, 会写)
  where 0-11 maps to 一年级上册 .. 六年级下册

Output: public/characters.json
  [
    {
      "id": "g1s",           # 一年级上
      "book": 0,             # zg index
      "grade": "一年级上",
      "recognition": [...],  # 识字表字 (二类字)
      "writing": [...]       # 写字表字 (一类字)
    },
    ...
  ]

Note: 六年级 (zg/10, zg/11) 的识字表页面无数据, recognition 将为空数组.
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path

import requests

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_JSON = PROJECT_ROOT / "public" / "characters.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

GRADES = [
    "一年级上", "一年级下", "二年级上", "二年级下",
    "三年级上", "三年级下", "四年级上", "四年级下",
    "五年级上", "五年级下", "六年级上", "六年级下",
]

BASE_URL = "https://zitie.xueyuqu.com/zg/{book}/{kind}"


def extract_chars_from_grid(html: str) -> list[str]:
    """Extract unique Chinese characters from the paper-box li grid.

    Each character appears 8-9 times in the practice grid (one per cell).
    Deduplicate preserving first-appearance order.
    """
    body = re.search(r"<body.*?</body>", html, re.DOTALL)
    btext = body.group(0) if body else html
    lis = re.findall(r"<li[^>]*>([\u4e00-\u9fff]+)</li>", btext)

    seen = set()
    result = []
    for ch in lis:
        if ch not in seen:
            seen.add(ch)
            result.append(ch)
    return result


def fetch_chars(book: int, kind: str) -> list[str]:
    """Fetch recognition/writing chars for a book (0-11)."""
    url = BASE_URL.format(book=book, kind=kind)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.encoding = "utf-8"
        if resp.status_code != 200:
            print(f"  [ERROR] {url}: status {resp.status_code}")
            return []
        return extract_chars_from_grid(resp.text)
    except Exception as e:
        print(f"  [ERROR] {url}: {e}")
        return []


def fetch_all() -> list[dict]:
    """Fetch all 12 books' recognition + writing tables."""
    tables = []
    for book in range(12):
        grade = GRADES[book]
        print(f"Fetching {grade} (book={book})...")

        recognition = fetch_chars(book, "characters")
        time.sleep(0.3)
        writing = fetch_chars(book, "dictations")
        time.sleep(0.3)

        tables.append({
            "id": f"g{book // 2 + 1}{'s' if book % 2 == 0 else 'x'}",
            "book": book,
            "grade": grade,
            "recognition": recognition,
            "writing": writing,
        })
        print(f"  -> 识字表 {len(recognition)} 字, 写字表 {len(writing)} 字")
    return tables


def validate(tables: list[dict]) -> bool:
    """Validate char tables. Returns True if all pass."""
    ok = True

    # 1. 12 books
    if len(tables) != 12:
        print(f"[FAIL] expected 12 books, got {len(tables)}")
        ok = False

    seen_ids = set()
    for t in tables:
        # 2. id uniqueness
        if t["id"] in seen_ids:
            print(f"[FAIL] duplicate id: {t['id']}")
            ok = False
        seen_ids.add(t["id"])

        # 3. content non-empty (writing should always exist)
        if not t["writing"]:
            print(f"[WARN] {t['id']} ({t['grade']}): writing empty")
        if not t["recognition"]:
            print(f"[WARN] {t['id']} ({t['grade']}): recognition empty (六年级教材无独立识字表)")

        # 4. no duplicates within a list
        for field in ["recognition", "writing"]:
            chars = t[field]
            if len(chars) != len(set(chars)):
                dupes = [c for c in set(chars) if chars.count(c) > 1]
                print(f"[FAIL] {t['id']} {field} has duplicates: {dupes}")
                ok = False

    # 5. writing char count reasonable (100-260)
    for t in tables:
        n = len(t["writing"])
        if n < 50 or n > 280:
            print(f"[WARN] {t['id']} ({t['grade']}): writing count {n} looks unusual")

    return ok


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch 部编版识字表/写字表")
    parser.add_argument("--validate", action="store_true", help="Validate only (no fetch)")
    args = parser.parse_args()

    if args.validate:
        tables = load_output()
        ok = validate(tables)
        sys.exit(0 if ok else 1)

    tables = fetch_all()
    ok = validate(tables)

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(tables, f, ensure_ascii=False, indent=2)

    print(f"\nGenerated {OUTPUT_JSON} with {len(tables)} books")
    print(f"Validation: {'PASS' if ok else 'WARNINGS/FAILURES'} (see above)")


def load_output() -> list[dict]:
    if not OUTPUT_JSON.exists():
        print(f"{OUTPUT_JSON} not found. Run fetch first.")
        sys.exit(1)
    with open(OUTPUT_JSON, "r", encoding="utf-8") as f:
        return json.load(f)


if __name__ == "__main__":
    main()

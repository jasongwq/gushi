#!/usr/bin/env python3
"""Fetch, validate, and generate poems.json for the Chinese poem quiz PWA.

Strategy:
  1. Build a URL index from guwendao.net category pages (accessible without login)
  2. Use smart title matching to find the correct poem page
  3. Fetch poem content from the direct page URL
  4. For poems not found on the category pages, use a built-in fallback database
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ── Paths ──────────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = PROJECT_ROOT / ".cache"
POEMS_JSON = PROJECT_ROOT / "public" / "poems.json"
ERRORS_JSON = CACHE_DIR / "errors.json"
URL_INDEX_JSON = CACHE_DIR / "url_index.json"

# ── Import poem metadata ──────────────────────────────────────────────────

sys.path.insert(0, str(PROJECT_ROOT))
from scripts.poem_meta import POEMS

# ── Task 2: Author / Dynasty Parser ───────────────────────────────────────

_BOOK_DYNASTY = {
    "《诗经》": "先秦",
    "《古诗十九首》": "汉",
}

_MODERN_AUTHORS = {"毛泽东", "周恩来"}


def parse_author(author_raw: str) -> tuple[str, str]:
    """Parse author_raw into (author, dynasty)."""
    if not author_raw:
        return ("", "")

    if author_raw.startswith("《"):
        dynasty = _BOOK_DYNASTY.get(author_raw, "")
        return (author_raw, dynasty)

    if author_raw in _MODERN_AUTHORS:
        return (author_raw, "现代")

    parts = author_raw.split("·")
    if len(parts) >= 2:
        dynasty = "·".join(parts[:-1])
        author = parts[-1]
        return (author, dynasty)

    if author_raw.endswith("乐府"):
        dynasty = author_raw.replace("乐府", "")
        return (author_raw, dynasty)
    if author_raw.endswith("民歌"):
        dynasty = author_raw.replace("民歌", "")
        return (author_raw, dynasty)

    return (author_raw, "")


# ── Task 3: Web Fetching ──────────────────────────────────────────────────

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

_LINE_END_PUNCT = set("，。？！、；：\u201c\u201d\u2018\u2019）\"")

# guwendao.net category pages that are accessible without login
_CATEGORY_PAGES = [
    "xiaoxue", "chuzhong", "gaozhong", "tangshi", "songci", "shijing",
    "yuefu", "sanbai", "songsan", "biansai", "songbie", "tianyuan",
    "zheli", "lizhi", "aiguo", "sixiang", "dushu", "meihua", "juhua",
    "yongwu", "xiejing", "ertong", "xishi", "chuci", "shijiu",
    "minyao", "wanyue", "haofang",
]


def _count_chinese_chars(line: str) -> int:
    """Count Chinese characters in a line (excluding punctuation)."""
    return sum(1 for ch in line if "\u4e00" <= ch <= "\u9fff")


def _split_on_punctuation(segment: str) -> list[str]:
    """Split a segment into lines at Chinese punctuation boundaries."""
    result = []
    current = ""

    for ch in segment:
        current += ch
        if ch in _LINE_END_PUNCT:
            result.append(current)
            current = ""

    if current.strip():
        if result:
            result[-1] += current
        else:
            result.append(current)

    return [l for l in result if l.strip()]


def _extract_text_from_contson(contson) -> list[str] | None:
    """Extract poem text lines from a contson div on guwendao.net."""
    # Remove style and script tags
    for tag in contson.find_all(["style", "script"]):
        tag.decompose()

    # Get text with <br/> as separator
    text = contson.get_text(separator="\n")
    lines = []
    for seg in text.split("\n"):
        seg = seg.strip()
        if not seg:
            continue
        lines.extend(_split_on_punctuation(seg))

    lines = [l for l in lines if l.strip()]
    if lines and _count_chinese_chars("".join(lines)) >= 4:
        return lines
    return None


def fetch_poem_page(url: str) -> list[str] | None:
    """Fetch poem text from a guwendao.net poem page."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.encoding = "utf-8"
        if resp.status_code != 200 or len(resp.text) < 500:
            return None

        soup = BeautifulSoup(resp.text, "html.parser")
        contson = soup.find("div", class_="contson")
        if contson:
            return _extract_text_from_contson(contson)
    except Exception as e:
        print(f"  [ERROR] page fetch failed: {e}")
    return None


# ── URL Index Builder ─────────────────────────────────────────────────────

def _title_matches(search_title: str, found_title: str) -> bool:
    """Check if two titles match, handling variants like （其一） etc."""
    if search_title == found_title:
        return True
    if search_title in found_title or found_title in search_title:
        return True
    # Strip the （...）suffix and compare
    base1 = re.sub(r"[（(][^）)]*[）)]", "", search_title)
    base2 = re.sub(r"[（(][^）)]*[）)]", "", found_title)
    if base1 and base2 and (base1 == base2 or base1 in base2 or base2 in base1):
        return True
    return False


def build_url_index() -> dict[str, str]:
    """Build a mapping from poem titles to their guwendao.net URLs.

    Returns dict mapping title -> URL.
    """
    if URL_INDEX_JSON.exists():
        with open(URL_INDEX_JSON, "r", encoding="utf-8") as f:
            return json.load(f)

    print("Building URL index from guwendao.net category pages...")
    index = {}  # title -> URL

    for page in _CATEGORY_PAGES:
        url = f"https://www.guwendao.net/gushi/{page}.aspx"
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code != 200 or len(resp.text) < 1000:
                continue
            resp.encoding = "utf-8"
            soup = BeautifulSoup(resp.text, "html.parser")

            for a in soup.find_all("a", href=True):
                href = a["href"]
                text = a.get_text(strip=True)
                if "shiwenv_" in href and text:
                    if not href.startswith("http"):
                        href = "https://www.guwendao.net" + href
                    # Only add if not already present (first occurrence wins)
                    if text not in index:
                        index[text] = href
            print(f"  {page}: done")
            time.sleep(0.5)
        except Exception as e:
            print(f"  {page}: error - {e}")

    print(f"URL index built: {len(index)} poems")
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with open(URL_INDEX_JSON, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    return index


def find_url_for_poem(title: str, author: str, index: dict[str, str]) -> str | None:
    """Find the guwendao.net URL for a poem using the URL index."""
    # 1. Exact match
    if title in index:
        return index[title]

    # 2. Match with variant titles
    best_match = None
    best_score = 0

    for key, url in index.items():
        if _title_matches(title, key):
            # Score: prefer exact match, then containment, then base match
            score = 1
            if title == key:
                score = 10
            elif title in key:
                score = 5
            elif key in title:
                score = 4
            else:
                # Base match (after stripping suffix)
                score = 2

            # Bonus: if the author name appears in the key or nearby
            if author and author in key:
                score += 3

            if score > best_score:
                best_score = score
                best_match = url

    return best_match


# ── Fallback database for poems not found on guwendao.net ─────────────────

# These are poems that are not on the guwendao.net category pages,
# or need special handling (e.g., 节选, wrong matching, etc.)
# Key = seq number
_FALLBACK_POEMS = {
    1: ["鹅，鹅，鹅，", "曲项向天歌。", "白毛浮绿水，", "红掌拨清波。"],
    142: ["秋浦歌", ["白发三千丈，", "缘愁似个长。", "不知明镜里，", "何处得秋霜。"]],
    148: ["客中作", ["兰陵美酒郁金香，", "玉碗盛来琥珀光。", "但使主人能醉客，", "不知何处是他乡。"]],
    153: ["赠花卿", ["锦城丝管日纷纷，", "半入江风半入云。", "此曲只应天上有，", "人间能得几回闻。"]],
    168: ["遗爱寺", ["弄石临溪坐，", "寻花绕寺行。", "时时闻鸟语，", "处处是泉声。"]],
    192: ["初夏睡起", ["梅子留酸软齿牙，", "芭蕉分绿与窗纱。", "日长睡起无情思，", "闲看儿童捉柳花。"]],
    195: ["题秋江独钓图", ["一蓑一笠一扁舟，", "一丈丝纶一寸钩。", "一曲高歌一樽酒，", "一人独钓一江秋。"]],
    5: ["古朗月行（节选）", ["小时不识月，", "呼作白玉盘。", "又疑瑶台镜，", "飞在青云端。"]],
    81: ["少年中国说（节选）", ["故今日之责任，不在他人，而全在我少年。", "少年智则国智，少年富则国富；", "少年强则国强，少年独立则国独立；", "少年自由则国自由，少年进步则国进步；", "少年胜于欧洲则国胜于欧洲，少年雄于地球则国雄于地球。", "红日初升，其道大光。", "河出伏流，一泻汪洋。", "潜龙腾渊，鳞爪飞扬。", "乳虎啸谷，百兽震惶。", "鹰隼试翼，风尘吸张。", "奇花初胎，矞矞皇皇。", "干将发硎，有作其芒。", "天戴其苍，地履其黄。", "纵有千古，横有八荒。", "前途似海，来日方长。", "美哉我少年中国，与天不老！", "壮哉我中国少年，与国无疆！"]],
    122: ["采薇（节选）", ["昔我往矣，杨柳依依。", "今我来思，雨雪霏霏。"]],
    132: ["七步诗", ["煮豆燃豆萁，", "豆在釜中泣。", "本是同根生，", "相煎何太急？"]],
    200: ["无题", ["大江歌罢掉头东，", "邃密群科济世穷。", "面壁十年图破壁，", "难酬蹈海亦英雄。"]],
    194: ["今日歌（节选）", ["今日复今日，今日何其少！", "今日又不为，此事何时了？", "人生百年几今日，今日不为真可惜！", "若言姑待明朝至，明朝又有明朝事。", "为君聊赋今日诗，努力请从今日始。"]],
    199: ["狱中题壁", ["望门投止思张俭，", "忍死须臾待杜根。", "我自横刀向天笑，", "去留肝胆两昆仑。"]],
    # 古人谈读书（一）- 论语
    82: ["古人谈读书（一）", ["知之为知之，不知为不知，是知也。", "敏而好学，不耻下问。", "默而识之，学而不厌，诲人不倦。", "我非生而知之者，好古，敏以求之者也。", "学如不及，犹恐失之。", "吾尝终日不食，终夜不寝，以思，无益，不如学也。"]],
    # 古人谈读书（二）- 朱熹
    83: ["古人谈读书（二）", ["余尝谓读书有三到，谓心到、眼到、口到。", "心不在此，则眼不看仔细，心眼既不专一，却只漫浪诵读，决不能记，记亦不能久也。", "三到之中，心到最急。心既到矣，眼口岂不到乎？"]],
    # 古人谈读书（三）- 曾国藩
    84: ["古人谈读书（三）", ["盖士人读书，第一要有志，第二要有识，第三要有恒。", "有志，则断不甘为下流。", "有识，则知学问无尽，不敢以一得自足，如河伯之观海，如井蛙之窥天，皆无识者也。", "有恒，则断无不成之事。", "此三者缺一不可。"]],
}


def _clean_text_lines(text: list[str]) -> list[str]:
    """Clean up poem text lines by removing annotations and version markers."""
    # First, join all lines and re-split to handle annotations that span multiple lines
    joined = "".join(text)

    # Remove annotations like (XX 一作：YY) or (XX 通：YY) or (XX 同：YY)
    joined = re.sub(r"\([^)]*(?:一作|通|同)[^)]*\)", "", joined)
    joined = re.sub(r"（[^）]*(?:一作|通|同)[^）]*）", "", joined)

    # Remove version markers like (版本一) or (版本二)
    joined = re.sub(r"\(版本[一二三四五]\)", "", joined)
    joined = re.sub(r"（版本[一二三四五]）", "", joined)

    # Remove source annotations like (——《论语》) or (——【宋】朱熹)
    joined = re.sub(r"\(——[^)]*\)", "", joined)
    joined = re.sub(r"（——[^）]*）", "", joined)

    # Re-split on punctuation boundaries
    lines = _split_on_punctuation(joined)

    # Merge orphaned closing quotation marks: if a line starts with " or ",
    # merge it with the previous line
    merged = []
    for line in lines:
        if merged and line and line[0] in "\"\u201d":
            merged[-1] += line
        else:
            merged.append(line)

    return [l for l in merged if l.strip()]


# ── Cache helpers ─────────────────────────────────────────────────────────

def load_cache(seq: int) -> dict | None:
    path = CACHE_DIR / f"p{seq:03d}.json"
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def save_cache(seq: int, data: dict) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"p{seq:03d}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_errors() -> list[dict]:
    if ERRORS_JSON.exists():
        with open(ERRORS_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_errors(errors: list[dict]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with open(ERRORS_JSON, "w", encoding="utf-8") as f:
        json.dump(errors, f, ensure_ascii=False, indent=2)


# ── Main fetch logic ─────────────────────────────────────────────────────

def do_fetch(force: bool = False) -> None:
    """Fetch all poems and cache them."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    # Build URL index
    url_index = build_url_index()

    errors = load_errors()
    fetched = 0
    skipped = 0
    failed = 0

    for meta in POEMS:
        seq = meta["seq"]
        cache_id = f"p{seq:03d}"

        # Skip if already cached
        if not force and load_cache(seq):
            print(f"  {cache_id}: already cached, skipping")
            skipped += 1
            continue

        title = meta["title"]
        author_raw = meta["author_raw"]
        author, dynasty = parse_author(author_raw)
        grade = meta["grade"]

        print(f"  Fetching {cache_id}: {title} ({author})...")

        text = None
        use_fallback_title = title  # might be overridden by fallback

        # Strategy 0: Check fallback database first (for poems that need special handling)
        if seq in _FALLBACK_POEMS:
            fb = _FALLBACK_POEMS[seq]
            if isinstance(fb, list) and len(fb) == 2 and isinstance(fb[0], str) and isinstance(fb[1], list):
                # [title_override, text_lines]
                use_fallback_title = fb[0]
                text = fb[1]
            else:
                text = fb
            print(f"  {cache_id}: OK from fallback ({len(text)} lines)")

        # Strategy 1: Find URL from index and fetch
        if not text:
            url = find_url_for_poem(title, author, url_index)
            if url:
                text = fetch_poem_page(url)
                if text:
                    text = _clean_text_lines(text)
                    print(f"  {cache_id}: OK from index ({len(text)} lines)")

        # Strategy 2: Try simplified title
        if not text:
            simple_title = re.sub(r"[（(][^）)]*[）)]", "", title)
            if simple_title != title:
                url = find_url_for_poem(simple_title, author, url_index)
                if url:
                    text = fetch_poem_page(url)
                    if text:
                        text = _clean_text_lines(text)
                        print(f"  {cache_id}: OK from simplified title ({len(text)} lines)")

        if text:
            data = {
                "id": cache_id,
                "title": use_fallback_title,
                "author": author,
                "dynasty": dynasty,
                "grade": grade,
                "unit": "",
                "text": text,
                "textType": "",  # will be determined during validation
            }
            save_cache(seq, data)
            fetched += 1
        else:
            data = {
                "id": cache_id,
                "title": title,
                "author": author,
                "dynasty": dynasty,
                "grade": grade,
                "unit": "",
                "text": [],
                "textType": "",
            }
            save_cache(seq, data)
            errors.append({
                "id": cache_id,
                "title": title,
                "author": author,
                "error": "fetch_failed",
            })
            save_errors(errors)
            failed += 1
            print(f"  {cache_id}: FAILED")

        # Rate limiting (only for web requests)
        if text and not any(seq in _FALLBACK_POEMS for seq in [seq]):
            time.sleep(0.3)

    print(f"\nFetch complete: {fetched} fetched, {skipped} cached, {failed} failed")


# ── Task 4: Deep Validation ───────────────────────────────────────────────

def detect_text_type(text: list[str]) -> str:
    """Detect textType based on Chinese character count per line."""
    char_counts = set()
    for line in text:
        count = _count_chinese_chars(line)
        if count > 0:
            char_counts.add(count)

    if char_counts == {5}:
        return "五言"
    if char_counts == {7}:
        return "七言"
    return "其他"


def validate_poem(poem: dict) -> list[str]:
    """Validate a single poem entry. Returns list of issues."""
    issues = []

    # 1. Field completeness
    required_fields = ["id", "title", "grade", "text", "textType"]
    for field in required_fields:
        if not poem.get(field):
            issues.append(f"missing or empty field: {field}")

    # 2. Content non-empty
    if not poem.get("text") or len(poem.get("text", [])) < 2:
        issues.append(f"text has fewer than 2 lines (has {len(poem.get('text', []))})")

    # 3. Punctuation check (warning only)
    if poem.get("text"):
        for i, line in enumerate(poem["text"]):
            if line and line[-1] not in _LINE_END_PUNCT:
                issues.append(f"line {i} does not end with Chinese punctuation: ...{line[-3:]}")

    # 4. textType vs char count
    if poem.get("text") and poem.get("textType"):
        detected = detect_text_type(poem["text"])
        if poem["textType"] != detected:
            issues.append(f"textType mismatch: expected {detected}, got {poem['textType']}")

    return issues


def do_validate() -> bool:
    """Validate all cached poems. Returns True if all pass."""
    all_ok = True
    total = 0
    passed = 0
    issues_count = 0

    poems = []
    for meta in POEMS:
        seq = meta["seq"]
        cached = load_cache(seq)
        if cached:
            poems.append(cached)
        else:
            print(f"  p{seq:03d}: NOT CACHED")

    # 5. Duplicate check
    seen = {}
    for poem in poems:
        key = (poem.get("title", ""), poem.get("author", ""))
        if key in seen:
            print(f"  DUPLICATE: {poem['id']} and {seen[key]} both have title={key[0]}, author={key[1]}")
            all_ok = False
        seen[key] = poem["id"]

    for poem in poems:
        total += 1
        if poem.get("text"):
            poem["textType"] = detect_text_type(poem["text"])

        issues = validate_poem(poem)
        if issues:
            issues_count += len(issues)
            all_ok = False
            critical = [i for i in issues if "punctuation" not in i]
            if critical:
                print(f"  {poem['id']} {poem['title']}: {', '.join(critical)}")
            else:
                passed += 1
        else:
            passed += 1

    print(f"\nValidation: {passed}/{total} poems OK, {issues_count} issues found")
    return all_ok


# ── Task 5: CLI + Generation ──────────────────────────────────────────────

def do_generate() -> None:
    """Validate all cached data and generate poems.json."""
    poems = []
    missing = []

    for meta in POEMS:
        seq = meta["seq"]
        cached = load_cache(seq)
        if not cached:
            missing.append(f"p{seq:03d}")
            continue

        if cached.get("text"):
            cached["textType"] = detect_text_type(cached["text"])

        poem = {
            "id": cached.get("id", f"p{seq:03d}"),
            "title": cached.get("title", meta["title"]),
            "author": cached.get("author", ""),
            "dynasty": cached.get("dynasty", ""),
            "grade": cached.get("grade", meta["grade"]),
            "unit": "",
            "text": cached.get("text", []),
            "textType": cached.get("textType", "其他"),
        }
        poems.append(poem)

    if missing:
        print(f"WARNING: {len(missing)} poems not cached: {', '.join(missing[:10])}{'...' if len(missing) > 10 else ''}")

    poems.sort(key=lambda p: p["id"])

    POEMS_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(POEMS_JSON, "w", encoding="utf-8") as f:
        json.dump(poems, f, ensure_ascii=False, indent=2)

    print(f"\nGenerated {POEMS_JSON} with {len(poems)} poems")


def main():
    parser = argparse.ArgumentParser(description="Fetch and validate Chinese poems")
    parser.add_argument("--fetch", action="store_true", help="Fetch all poems from the web")
    parser.add_argument("--validate", action="store_true", help="Validate cached poems")
    parser.add_argument("--generate", action="store_true", help="Validate and generate poems.json")
    parser.add_argument("--force", action="store_true", help="Force re-fetch even if cached")

    args = parser.parse_args()

    if not any([args.fetch, args.validate, args.generate]):
        parser.print_help()
        sys.exit(1)

    if args.fetch:
        do_fetch(force=args.force)

    if args.validate:
        do_validate()

    if args.generate:
        do_validate()
        do_generate()


if __name__ == "__main__":
    main()

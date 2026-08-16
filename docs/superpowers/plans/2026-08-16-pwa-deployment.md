# PWA Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将古诗抽查 PWA 正式发布到 Cloudflare Pages，支持自定义域名和 HTTPS。

**Architecture:** 纯静态部署 — GitHub 仓库关联 Cloudflare Pages，push 自动构建部署。DNSPod CNAME 指向 Cloudflare Pages。发布前补齐 PWA 图标和 meta 标签。

**Tech Stack:** Vue 3 + Vite + vite-plugin-pwa, Cloudflare Pages, DNSPod, GitHub

---

### Task 1: 生成 PNG 图标

**Files:**
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`

- [ ] **Step 1: 从 SVG 生成 192x192 和 512x512 PNG 图标**

SVG 源文件在 `public/icons/icon.svg`（512x512，靛蓝底色白字"诗"）。使用 `convert`（ImageMagick）或 `rsvg-convert` 生成 PNG：

```bash
# 优先使用 rsvg-convert（SVG 渲染更准确）
rsvg-convert -w 192 -h 192 public/icons/icon.svg -o public/icons/icon-192.png
rsvg-convert -w 512 -h 512 public/icons/icon.svg -o public/icons/icon-512.png

# 如果 rsvg-convert 不可用，用 ImageMagick
# convert -background none -resize 192x192 public/icons/icon.svg public/icons/icon-192.png
# convert -background none -resize 512x512 public/icons/icon.svg public/icons/icon-512.png
```

- [ ] **Step 2: 验证 PNG 文件生成成功**

```bash
ls -la public/icons/icon-192.png public/icons/icon-512.png
file public/icons/icon-192.png public/icons/icon-512.png
```

Expected: 两个文件存在，类型为 PNG image data

- [ ] **Step 3: Commit**

```bash
git add public/icons/icon-192.png public/icons/icon-512.png
git commit -m "feat: add PNG icons for PWA installation"
```

---

### Task 2: 更新 PWA manifest 配置和 index.html

**Files:**
- Modify: `vite.config.ts` — manifest.icons 添加 PNG 条目
- Modify: `index.html` — 添加 apple-touch-icon 和 theme-color meta

- [ ] **Step 1: 更新 vite.config.ts 的 manifest.icons**

将 `vite.config.ts` 中 `VitePWA` 的 `manifest.icons` 数组改为：

```typescript
icons: [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
  { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
],
```

- [ ] **Step 2: 更新 index.html 添加 apple-touch-icon 和 theme-color**

在 `<head>` 中 `<link rel="icon">` 之后添加：

```html
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
<meta name="theme-color" content="#4f46e5" />
```

- [ ] **Step 3: 本地构建验证**

```bash
npm run build
```

Expected: 构建成功，无错误。检查 `dist/manifest.webmanifest` 包含 PNG 图标条目。

```bash
cat dist/manifest.webmanifest | python3 -m json.tool
```

Expected: icons 数组包含 3 个条目（192png, 512png, svg）。

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts index.html
git commit -m "feat: add PNG icons to PWA manifest and apple-touch-icon"
```

---

### Task 3: 推送代码到 GitHub

**Files:** 无新文件

- [ ] **Step 1: 创建 GitHub 仓库**

在 GitHub 上创建新仓库（公开或私有均可）。仓库名建议 `gushi-choucha`。

```bash
# 如果尚未配置 remote
git remote add origin git@github.com:<username>/gushi-choucha.git
```

- [ ] **Step 2: 推送代码到 main 分支**

```bash
git push -u origin main
```

Expected: 推送成功，所有代码（含 PNG 图标和更新后的配置）在 GitHub 上。

---

### Task 4: Cloudflare Pages 配置

**Files:** 无代码修改，纯平台操作

- [ ] **Step 1: 登录 Cloudflare Dashboard 创建 Pages 项目**

1. 访问 https://dash.cloudflare.com → Workers & Pages → Create
2. 选择 "Connect to Git"
3. 授权 GitHub 并选择 `gushi-choucha` 仓库
4. 配置构建设置：
   - Production branch: `main`
   - Framework preset: `Vue.js`
   - Build command: `npm run build`
   - Build output directory: `dist`
5. 点击 "Save and Deploy"

- [ ] **Step 2: 等待首次构建完成**

Cloudflare Pages 会自动运行构建。确认构建成功，访问 `*.pages.dev` 域名验证页面正常。

- [ ] **Step 3: 添加自定义域名**

1. 在 Pages 项目设置 → Custom domains → Add domain
2. 输入自定义域名（如 `gushi.ypwq.fun`）
3. Cloudflare 会提供 CNAME 目标值（格式类似 `gushi-choucha.pages.dev`）

---

### Task 5: DNSPod 配置 CNAME

**Files:** 无代码修改，纯 DNS 操作

- [ ] **Step 1: 在 DNSPod 添加 CNAME 记录**

登录 DNSPod 控制台，选择 `ypwq.fun` 域名，添加记录：

| 字段 | 值 |
|------|-----|
| 主机记录 | `gushi` |
| 记录类型 | `CNAME` |
| 记录值 | Cloudflare Pages 提供的目标（如 `gushi-choucha.pages.dev`） |
| TTL | 默认（600） |

- [ ] **Step 2: 如果 Cloudflare 要求域名验证，添加 TXT 记录**

Cloudflare 可能要求添加 TXT 记录验证域名所有权。在 DNSPod 添加：

| 字段 | 值 |
|------|-----|
| 主机记录 | Cloudflare 指定的子域名 |
| 记录类型 | `TXT` |
| 记录值 | Cloudflare 提供的验证值 |

- [ ] **Step 3: 等待 DNS 生效 + SSL 证书签发**

DNS 传播通常几分钟，SSL 证书签发最多几小时。在 Cloudflare Pages 的 Custom domains 页面确认状态变为 "Active"。

---

### Task 6: 验证部署

**Files:** 无代码修改

- [ ] **Step 1: 验证 HTTPS 访问**

```bash
curl -I https://gushi.ypwq.fun
```

Expected: HTTP 200，响应头包含 `cf-cache-status` 等 Cloudflare 标识。

- [ ] **Step 2: 验证 PWA manifest**

```bash
curl https://gushi.ypwq.fun/manifest.webmanifest
```

Expected: JSON 包含 name、icons（含 PNG 条目）、display: standalone。

- [ ] **Step 3: 验证 Service Worker**

```bash
curl -I https://gushi.ypwq.fun/sw.js
```

Expected: HTTP 200，Content-Type 为 JavaScript。

- [ ] **Step 4: 手机端验证 PWA 安装**

1. 在手机浏览器访问 `https://gushi.ypwq.fun`
2. Android Chrome: 应出现"添加到主屏幕"提示，或菜单中有该选项
3. iOS Safari: 分享菜单 → 添加到主屏幕
4. 验证安装后图标显示正确（靛蓝底色白字"诗"）
5. 验证打开后全屏显示（无浏览器地址栏）

- [ ] **Step 5: Commit 部署完成标记（可选）**

如果更新了版本号：

```bash
# 在 package.json 中将 version 从 0.1.0 改为 1.0.0
git add package.json
git commit -m "release: v1.0.0 - PWA deployed to Cloudflare Pages"
git push
```

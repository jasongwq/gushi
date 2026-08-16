---
name: PWA Deployment Design
description: 古诗抽查PWA正式发布方案：GitHub + Cloudflare Pages + DNSPod自定义域名
type: project
---

# PWA 正式发布设计

## 背景

古诗抽查是一个纯客户端 Vue 3 + Vite PWA 应用，目标用户为亲友小范围分享。需要选择稳定、免运维、国内访问快的部署方案。

## 方案选择

**选定：GitHub + Cloudflare Pages**

理由：
- 国内 CDN 节点多，访问速度快
- 完全免费，小流量额度足够
- 自动 HTTPS（PWA 必须）
- 推代码自动构建部署
- 自定义域名支持

## 一、PWA 发布前必改项

### 1.1 图标问题

当前只有 SVG 图标，iOS/Android 安装 PWA 需要 PNG 图标。

**操作：**
- 从现有 SVG 生成 192x192 和 512x512 PNG 图标
- 更新 `vite.config.ts` 中 manifest.icons，添加 PNG 条目（保留 SVG 作为 fallback）
- 更新 `index.html` 添加 `<link rel="apple-touch-icon" href="/icons/icon-192.png">`

### 1.2 缓存策略

- `registerType: 'autoUpdate'` 已正确配置
- Workbox 默认 precache 所有构建产物，`poems.json` 更新时需改版本号触发更新
- 无需额外 workbox 配置

## 二、部署流程

### 2.1 GitHub 仓库

- 创建 GitHub 仓库（公开或私有均可，Cloudflare Pages 两者都支持）
- 确认 `.gitignore` 排除 `dist/`、`node_modules/`、`.cache/`
- 推送代码到 main 分支

### 2.2 Cloudflare Pages 配置

| 配置项 | 值 |
|--------|-----|
| Framework | Vue.js |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js version | 18+ |
| 自动部署 | push 到 main 自动触发 |

### 2.3 自定义域名

1. Cloudflare Pages 默认分配 `*.pages.dev` 域名
2. 在 Pages 设置中添加自定义域名（如 `gushi.ypwq.fun`）
3. Cloudflare 提供 CNAME 目标值
4. 在 DNSPod 添加 CNAME 记录：主机记录 `gushi` → Cloudflare 提供的目标
5. HTTPS 证书由 Cloudflare 自动签发

### 2.4 DNSPod + Cloudflare 注意事项

- DNS 不在 Cloudflare 托管，SSL 模式需选 **Full (Strict)**
- 域名验证通过 DNS TXT 记录完成（DNSPod 加一条即可）

## 三、部署后优化（可选）

### 3.1 PWA 安装提示

首次访问时引导用户"添加到主屏幕"，特别是 iOS Safari 需要手动操作（分享菜单 → 添加到主屏幕）。

### 3.2 访问统计

可接入 Cloudflare Web Analytics（免费、无 cookie、隐私友好）。

## 四、步骤总结

| 步骤 | 操作 | 预估耗时 |
|------|------|----------|
| 1 | 生成 PNG 图标，更新 manifest 和 index.html | 5分钟 |
| 2 | 推代码到 GitHub | 5分钟 |
| 3 | Cloudflare Pages 关联仓库并配置构建 | 5分钟 |
| 4 | DNSPod 加 CNAME 指向 Pages | 5分钟 |
| 5 | 验证 HTTPS + PWA 安装 | 5分钟 |

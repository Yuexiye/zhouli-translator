# 新三国体翻译器

<p align="center">
  <strong>把现代中文扔进新三国的平行宇宙，让它自动获得失重感。</strong>
</p>

<p align="center">
  <a href="https://github.com/Aspirin0000/zhouli-translator">参考上游仓库：合乎周礼</a>
  ·
  <a href="#quick-start">快速开始</a>
  ·
  <a href="#deployment">部署</a>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-black">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black">
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6">
</p>

## What Is This

`新三国体翻译器` 是一个中文梗文案生成器。它把用户的现代中文，翻译成 2010 版电视剧《三国》的台词风格。

这个项目 fork 自 [Aspirin0000/zhouli-translator](https://github.com/Aspirin0000/zhouli-translator)（`合乎周礼`），保留了原项目的 Next.js 前端架构和 DeepSeek API 调用方式，并把 prompt 系统整体替换为「新三国宇宙」规则。

## Highlights

| Capability | Detail |
| --- | --- |
| 角色线路 | 曹操 / 刘备 / 关羽 / 张飞 / 诸葛亮 / 司马懿 |
| 三档强度 | 小礼 / 成礼 / 大礼 |
| 多 Provider | DeepSeek / OpenAI 兼容接口 / 本地演示 |
| 演示模式 | 没有 API Key 时仍可预览界面与交互 |
| 限流保护 | 服务端轻量限流，防止接口被刷爆 |

## Example

### 新三国体示例

Input:

```text
今天天气真好啊
```

Output style:

```text
列位诸公！今日天气好？哈哈哈，不可能，绝对不可能！这就不奇怪了，这就不奇怪了。接着奏乐，接着舞！
```

## Quick Start

Requirements:

- Node.js 20 or newer.
- A DeepSeek API key for real generation.

Run locally:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000/xinsanguo](http://localhost:3000/xinsanguo).

`.env.local`:

```env
DEEPSEEK_API_KEY=sk-your-key-here
DEEPSEEK_MODEL=deepseek-v4-flash

# 可选：OpenAI 兼容接口
OPENAI_COMPATIBLE_BASE_URL=https://your-compatible-endpoint.example.com
OPENAI_COMPATIBLE_API_KEY=sk-your-compatible-key
OPENAI_COMPATIBLE_MODEL=your-model-name
```

If `DEEPSEEK_API_KEY` and `OPENAI_COMPATIBLE_*` are both missing, the app falls back to local demo output and does not call any model API.

## Project Structure

```text
app/
  api/xinsanguo/route.ts       Server-side generation endpoint
  xinsanguo/page.tsx           Main UI
lib/
  xinsanguo-prompt.ts          角色 prompt 与强度规则
```

## Upstream

本项目基于 [Aspirin0000/zhouli-translator](https://github.com/Aspirin0000/zhouli-translator) 改造，保留了原项目的架构与部署方式，仅替换 prompt 与前端页面为新三国主题。

## Deployment

### Vercel

1. Import the repository into Vercel.
2. Add `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL`.
3. Deploy.

### Cloudflare Workers

```bash
npm install
npx wrangler login
npx wrangler secret put DEEPSEEK_API_KEY
npm run deploy
```

## License

MIT License. See [LICENSE](LICENSE).

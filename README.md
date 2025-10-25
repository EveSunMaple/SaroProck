# SaroProck | 我的个人博客 🚀

![GitHub Repo stars](https://img.shields.io/github/stars/EveSunMaple/SaroProck?style=flat-square)
![GitHub license](https://img.shields.io/github/license/EveSunMaple/SaroProck?style=flat-square)
![Vercel](https://img.shields.io/badge/deployed-on-vercel?style=flat-square&logo=vercel&logoColor=white)
![Astro](https://img.shields.io/badge/built%20with-Astro-FF5D01?style=flat-square)
![TailwindCSS](https://img.shields.io/badge/style-Tailwind%20CSS-38B2AC?style=flat-square)
![React](https://img.shields.io/badge/frontend-React-61DAFB?style=flat-square&logo=react&logoColor=white)

简单部署教程 → [点我！](https://saro.pub/build-saroprock)

---

## ✨ 这个博客有什么不同？

SaroProck 是 **静态博客 + 动态博客** 的结合体，内置评论、搜索功能，支持与 [Sink](https://github.com/ccbikai/Sink) 短链项目集成统计浏览量，同时提供一个后台评论管理面板。

- **用 Telegram 写动态**
  - 完全通过 Telegram 频道管理，无需后台或静态文件。
  - 每次访问，博客会自动抓取并生成动态文章。
- **自建评论与点赞系统**
  - 基于 LeanCloud 自建系统，完全匹配站点样式。
  - 不依赖第三方评论系统。
- **免维护 + 全球加速**
  - 部署在 Vercel 免费 Serverless。
  - 免费套餐满足个人使用需求。

当然还有……

- ✅ 自动的 **白天 / 黑夜** 模式
- ✅ 自建的博文搜索模块
- ✅ 使用 XSL 美化的 RSS
- ✅ 多样的自定义 MDX 组件
- ✅ 自动生成社交媒体图片
- ✅ 博文目录侧边栏

---

## 🚀 技术栈

- **框架**: Astro
- **内容源**: Telegram
- **前端交互**: React
- **样式**: Tailwind CSS + DaisyUI
- **后端服务**: LeanCloud + Vercel Serverless

---

## 🛠️ 关于部署

推荐使用 **Vercel** 部署，简单易用，无需服务器。

[![Deploy on Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/EveSunMaple/SaroProck)

> [!IMPORTANT]
>
> **注意**：Cloudflare Pages/Functions 运行在 Edge Runtime（V8 环境），并不具备完整的 Node.js API 支持。由于本项目使用 React 并依赖部分 Node API，直接部署到 Cloudflare 会导致构建或运行时报错（如 `MessageChannel is not defined`），页面无法正常渲染甚至返回 404。

## ⚖️ 关于开源和版权

这个项目是开源的，代码托管在 GitHub 上，使用的是 **严格的 GPLv3 协议**。
你可以自由查看、学习、修改甚至搭建自己的版本，但你必须：

- 在你使用我的代码时保留我的署名；
- 你修改后发布的版本也必须继续遵守 GPLv3 协议。

换句话说：**你可以用，但不能删掉我。**

---

## ⭐ 支持项目

如果你喜欢这个项目的思路或者实现，欢迎点亮右上角的 ⭐！

---

## 📷 预览

### 动态页面

![](/docs/img/post-page.webp)

### 博客页面

![](/docs/img/blog-page.webp)

### 管理页面

![](/docs/img/admin-page.webp)

---

## 🔧 环境变量

```dotenv
# LeanCloud 应用凭证 (国际版或国内版)
# 请前往 LeanCloud 控制台 > 设置 > 应用凭证 获取
LEANCLOUD_APP_ID=<你的 LeanCloud App ID>
LEANCLOUD_APP_KEY=<你的 LeanCloud App Key>
LEANCLOUD_MASTER_KEY=<你的 LeanCloud Master Key>
LEANCLOUD_SERVER_URL=<你的 LeanCloud 服务器 URL>

# JSON Web Token (JWT) 密钥
# 用于用户认证和 API 安全，请使用一个长且随机的字符串
JWT_SECRET=<你的 JWT 密钥>

# 自定义频道或标识符
CHANNEL=your_channel_name

# HTTP 代理 (可选)
# 如果你的网络环境需要代理才能访问外部服务，请取消注释并设置
# HTTP_PROXY=http://127.0.0.1:7897

TELEGRAM_HOST=t.me

# GitHub Personal Access Token
# 用于访问 GitHub API，请在 GitHub > Settings > Developer settings > Personal access tokens 中生成
GITHUB_TOKEN=<你的 GitHub Personal Access Token>

# 后台管理员密码
# 用于访问受保护的管理功能
SECRET_ADMIN_PASSWORD=<设置一个强的管理员密码>

# 数据接收服务 (Sink) 配置
# 如果你使用自定义的数据统计或链接缩短服务，请配置以下选项
SINK_PUBLIC_URL=<你的 Sink 服务公开访问 URL>
SINK_API_KEY=<你的 Sink 服务 API 密钥>
```

---

### 🎉 致谢与参考

本项目的部分设计思路参考了以下优秀开源项目：

- [BroadcastChannel](https://github.com/ccbikai/BroadcastChannel) - AGPL-3.0 License

特别说明：
本项目 **未直接使用其源代码**，仅参考了架构和实现思路，样式均为自己设计，遵循本项目所使用的 [GPL-3.0 License](./LICENSE)。

如对原项目感兴趣，欢迎前往其仓库进一步了解。

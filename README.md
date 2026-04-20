# Skills Manager

Skills 统一管理平台 — 为同时使用 Claude、Qoder、QoderWork、Openclaw、Cursor、CodeBuddy、GitHub Copilot 等多个 AI 编程工具/Agent智能体的使用者提供一个统一的 WebUI 界面，解决 Skills 配置分散、维护困难的痛点。

## 项目原点

**痛点**：多个 AI 编程工具各自维护 Skills，内容分散、难以同步，重复劳动多。

**解法**：统一源目录管理 Skills，通过软链接一键同步到各项目，一处维护、多处生效。

## 功能概览

| 模块 | 功能 |
|------|------|
| **项目管理** | 添加/管理本地项目，自动检测 AI 工具配置（`.claude/`、`.cursor/`、`.codebuddy/` 等），支持文件夹浏览 |
| **Skills 库** | 树形文件浏览、Monaco Editor 在线编辑、Markdown 预览、全文搜索、AI 生成技能、AI 优化技能（含草稿对比）、Skill 自定义别名、版本管理（快照/对比/回滚）、导出 ZIP |
| **导入中心** | 支持 GitHub、ClawHub、Aone 开放平台、本地文件、ZIP、剪贴板、批量导入等多渠道一键导入 Skills，导入历史记录（版本号追踪）、订阅管理（版本追踪、批量检查更新），全局拖放导入、实时进度条（SSE）、快捷键 Ctrl+I / Cmd+I |
| **扩展系统** | Provider 注册模式、文件级扩展加载（`~/.skills-manager/extensions/`）、自定义导入源和发布目标、设置中导入/删除扩展插件，零侵入开源代码 |
| **发布集成** | 发布 Skills 到云端 AI 平台（悟空等）、内置软链接同步、审核状态追踪、发布历史管理 |
| **工具同步优化** | 工具特性数据库（生效方式/已知问题）、编辑后生效提示 toast、项目卡片工具标签、导入后自动同步 |
| **使用分析** | 事件埋点、仪表盘概览、热门 Skills 排行、最近活动时间线，数据本地存储 |
<img width="800" height="447" alt="slide_01" src="https://github.com/user-attachments/assets/85d10408-96e0-4c19-9fc8-17d49f960928" />
<img width="800" height="447" alt="slide_02" src="https://github.com/user-attachments/assets/076550a4-7e75-4a57-b48d-c23f6504bcbd" />
<img width="800" height="447" alt="slide_03" src="https://github.com/user-attachments/assets/bf0a3ff4-5883-41b5-abea-024581701231" />
<img width="800" height="447" alt="slide_04" src="https://github.com/user-attachments/assets/53804a3e-4a54-44a3-9dd2-3d30818ec2dd" />
<img width="800" height="447" alt="slide_05" src="https://github.com/user-attachments/assets/49983ad6-b582-414f-bd5a-b438dba3f97b" />
<img width="800" height="447" alt="slide_06" src="https://github.com/user-attachments/assets/b0c88d62-9227-4c5d-b357-335af80c2630" />

## 核心特性

- **可展开/收起的侧边栏**：默认展开显示图标+文字，支持点击收起为图标模式
- **多源目录管理**：支持配置多个 Skills 源目录，灵活切换
- **AI 生成技能**：通过 AI 模型自动生成 SKILL.md 文件
- **AI 优化技能**：对已有技能进行 AI 优化，支持 DiffEditor 对比原始内容与草稿，确认后替换
- **Skill 自定义别名**：为 Skill 设置自定义展示名称，不修改文件夹，支持设置/修改/清除，localStorage 持久化
- **版本管理**：为 Skill 创建快照、查看版本历史、对比差异、一键回滚，AI 优化时自动创建备份
- **导入中心**：支持 GitHub、ClawHub、Aone 开放平台、本地文件、ZIP、剪贴板、批量导入等多渠道一键导入 Skills
- **ClawHub 集成**：从 ClawHub 技能市场直接导入 OpenClaw Skills，自动提取版本号
- **Aone 开放平台集成**：从 Aone 开放平台导入 Skills，支持 `@scope/name` 和无 scope 两种 URL 格式，Cookie 认证
- **导入历史**：记录每次导入操作，支持按来源过滤，版本号显示，扩展 provider 来源名称动态显示
- **订阅管理**：订阅 GitHub/ClawHub/扩展 provider 来源的 Skills，支持批量检查更新、版本号追踪、一键更新
- **使用分析**：轻量级本地分析仪表盘，追踪查看/编辑/AI 优化/导出等操作，热门 Skills 排行、最近活动时间线
- **Provider 注册模式**：轻量级扩展机制，通过在 `~/.skills-manager/extensions/` 放置 `.js` 扩展文件即可注册自定义导入源和发布目标，无需修改开源代码
- **扩展插件管理**：设置中支持导入/删除扩展插件（`.js` 文件），无需手动操作文件系统
- **发布集成（Publish Target）**：支持将 Skills 发布到云端 AI 平台（如悟空智能体平台），内置软链接同步目标，支持审核状态追踪
- **工具同步优化**：工具特性数据库记录各 AI 工具的生效方式，编辑 Skill 保存后自动提示"需重启"或"需新对话"，项目卡片展示工具生效标签
- **导入后自动同步**：导入 Skills 后可自动触发软链接同步到所有已绑定项目
- **全局拖放导入**：拖拽文件/文件夹到浏览器窗口，自动跳转导入中心并触发导入流程
- **导入进度实时展示**：通过 SSE 实时推送导入进度，前端展示进度条和当前处理的 Skill 名称
- **快捷键支持**：Ctrl+I / Cmd+I 快速跳转到导入中心
- **导出功能**：将技能文件夹打包为 ZIP 下载
- **多主题支持**：浅色/深色/像素风格切换
- **帮助中心**：内置使用指南

## 技术栈

```
前端: React 18 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui + Monaco Editor + Zustand
后端: Node.js + Express.js + TypeScript (tsx)
存储: JSON 本地文件（无需数据库）
```

## 快速开始

### 环境要求

- Node.js 20+
- npm 9+

### 方式一：npm 安装（推荐）

```bash
# 直接运行（无需安装）
npx ahang-skills-manager

# 或全局安装后运行
npm install -g ahang-skills-manager
ahang-skills-manager
```

启动后自动打开浏览器访问 `http://localhost:3001`。

**CLI 参数：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--port <number>` | 指定服务端口 | 3001 |
| `--no-open` | 启动后不自动打开浏览器 | - |
| `-v, --version` | 显示版本号 | - |
| `-h, --help` | 显示帮助信息 | - |

### 方式二：源码安装

```bash
# 1. 克隆项目
git clone git@github.com:hello-ahang/Skills_Manager.git
cd Skills_Manager

# 2. 执行一键安装脚本
chmod +x install.sh && ./install.sh
```

安装脚本会自动完成：
1. 检查 Node.js 环境
2. 安装项目依赖
3. 初始化项目数据目录
4. 初始化用户数据目录（`~/.skills-manager/`）
5. 注册快捷命令 `sm_run` / `sm_stop` 到 shell 配置

### 启动与停止

```bash
# 快捷命令（安装后新开终端生效）
sm_run          # 启动项目
sm_stop         # 停止项目

# 或使用 npm 命令
npm run dev     # 开发模式（同时启动前后端）
npm run stop    # 停止并清理端口
```

启动后访问：
- **前端**: http://localhost:5173（开发模式）
- **后端 API**: http://localhost:3001

### 一键卸载

```bash
chmod +x uninstall.sh && ./uninstall.sh
```

卸载脚本会清除：
1. 停止运行中的服务
2. 清除 shell 别名（`sm_run` / `sm_stop`）
3. 删除用户数据目录（`~/.skills-manager/`）
4. 删除项目目录

### 生产构建

```bash
# 构建
npm run build

# 启动生产服务
npm run start
```

## 项目结构

```
skills-manager/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
│
├── server/                    # 后端代码
│   ├── index.ts               # Express 入口
│   ├── extensions.ts          # 扩展加载机制
│   ├── routes/
│   │   ├── config.ts          # 配置 API
│   │   ├── projects.ts        # 项目管理 API
│   │   ├── skills.ts          # Skills 文件 API
│   │   ├── links.ts           # 链接管理 API
│   │   ├── tools.ts           # 工具 API（导出等）
│   │   ├── import.ts          # 导入中心 API
│   │   ├── import-stream.ts   # 导入进度 SSE 端点
│   │   └── publish.ts         # 发布集成 API
│   ├── services/
│   │   ├── configService.ts   # 配置管理
│   │   ├── fileService.ts     # 文件操作
│   │   ├── linkService.ts     # 软链接操作
│   │   ├── scanService.ts     # 项目扫描
│   │   ├── convertService.ts  # 格式转换
│   │   ├── templateService.ts # 模板管理
│   │   ├── importService.ts   # 导入服务（GitHub/ClawHub/ZIP 等 + Provider 注册）
│   │   ├── importHistoryService.ts  # 导入历史
│   │   ├── publishService.ts  # 发布服务（Publish Target 注册）
│   │   └── subscriptionService.ts   # 订阅管理
│   └── utils/
│       ├── symlink.ts         # 软链接工具函数
│       └── validation.ts      # 输入验证
│
├── src/                       # 前端代码
│   ├── main.tsx               # React 入口
│   ├── App.tsx                # 根组件 & 路由
│   ├── index.css              # 全局样式 & Tailwind 主题（含像素风格）
│   ├── api/
│   │   └── client.ts          # API 客户端封装
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx    # 可展开/收起侧边栏
│   │   │   └── Header.tsx     # 顶部栏（主题切换、模型配置）
│   │   ├── projects/
│   │   │   ├── ProjectList.tsx
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── ProjectFileBrowser.tsx  # 项目文件夹浏览弹框
│   │   │   └── AddProjectModal.tsx
│   │   ├── skills/
│   │   │   ├── FileTree.tsx           # 文件树（含 AI 优化/导出/别名管理）
│   │   │   ├── Editor.tsx             # Monaco 编辑器 & Markdown 预览
│   │   │   ├── AISkillGenerator.tsx   # AI 生成技能弹框
│   │   │   ├── AISkillOptimizer.tsx   # AI 优化技能弹框（DiffEditor 对比）
│   │   │   ├── VersionHistoryDialog.tsx # 版本历史弹框
│   │   │   └── SearchResults.tsx      # 搜索结果组件
│   │   └── ui/                # shadcn/ui 基础组件
│   ├── pages/
│   │   ├── ProjectsPage.tsx   # 项目管理页
│   │   ├── SkillsPage.tsx     # Skills 库页
│   │   ├── ImportPage.tsx     # 导入中心页
│   │   ├── AnalyticsPage.tsx  # 使用分析页
│   │   └── HelpPage.tsx       # 帮助中心页
│   ├── stores/                # Zustand 状态管理
│   │   ├── configStore.ts     # 全局配置
│   │   ├── projectStore.ts    # 项目状态
│   │   └── skillsStore.ts     # Skills 状态
│   ├── hooks/                 # 自定义 Hooks
│   └── types/                 # TypeScript 类型定义
│
├── extensions-guide/           # 扩展开发指南（Git 跟踪）
│   ├── provider-guide.md      # Provider 注册与扩展加载用户指南
│   └── extensions.md          # 扩展开发 API 参考
│
├── docs/                      # 文档（本地文档，不提交 Git）
│   ├── aone-provider.js       # Aone 开放平台导入扩展示例（完整实战代码）
│   └── sharing.md             # 项目分享文案
│
├── data/                      # 项目级配置（不含敏感信息）
│   ├── config.json            # 工具定义 & UI 偏好设置
│   └── config.example.json    # 配置示例文件
│
├── ~/.skills-manager/         # 用户级配置（存储在用户根目录）
│   └── user-config.json       # 源目录、模型密钥、项目列表等
│
└── templates/                 # 内置 Skills 模板
    ├── code-style-ts.md
    ├── code-style-python.md
    ├── testing-strategy.md
    ├── documentation.md
    └── architecture.md
```

## 配置说明

项目采用 **配置分离** 机制，确保敏感信息不会随代码提交到 Git 仓库：

| 配置文件 | 位置 | 内容 | 是否提交 Git |
|---------|------|------|-------------|
| `data/config.json` | 项目目录 | 工具定义、UI 偏好设置 | ✅ 安全提交 |
| `~/.skills-manager/user-config.json` | 用户根目录 | 源目录、LLM 模型密钥、项目列表 | ❌ 不提交 |

> 首次从旧版本升级时，系统会自动将 `data/config.json` 中的用户数据迁移到 `~/.skills-manager/user-config.json`。

## 使用指南

### 1. 配置 Skills 源目录

首次使用时，在 Skills 库页面点击「管理」配置你的 Skills 源目录路径。支持添加多个源目录并灵活切换。

### 2. 添加项目

在「项目管理」页面，点击「添加项目」输入本地项目路径。系统会自动扫描项目中已存在的 AI 工具配置目录，支持一键绑定/解绑 Skills。

### 3. 编辑 Skills

在「Skills 库」页面，浏览和编辑 Skills 文件。支持：
- 树形文件浏览（有效 Skill 目录带 ✨ 标识）
- Monaco Editor 在线编辑（支持 Markdown 语法高亮）
- Markdown 实时预览
- 全文搜索
- AI 生成新技能
- AI 优化已有技能（DiffEditor 对比，草稿可编辑，确认后替换）
- Skill 自定义别名（为 Skill 设置自定义展示名称，不修改原始文件夹）
- 版本管理（创建快照、对比差异、回滚版本，AI 优化前自动备份）
- 使用分析（查看操作统计、热门排行、最近活动）
- 导出技能文件夹为 ZIP

### 4. 同步链接

在项目管理页面，为项目绑定 Skills 源目录，系统通过软链接将 Skills 同步到各个项目的 AI 工具配置目录下。

## 扩展开发指南

Skills Manager 提供了轻量级的扩展机制，允许开发者通过编写 `.js` 扩展文件来注册自定义导入源和发布目标，无需修改开源代码。

扩展开发文档位于项目根目录的 `extensions-guide/` 目录下：

| 文档 | 说明 |
|------|------|
| [provider-guide.md](extensions-guide/provider-guide.md) | **Provider 注册与扩展加载用户指南** — 完整的扩展开发教程，包含 scan 返回值详解、认证机制、URL 自动检测、完整实战示例等 |
| [extensions.md](extensions-guide/extensions.md) | **扩展开发 API 参考** — 扩展系统的 API 接口定义和数据结构说明 |

### 快速上手

1. 在 `~/.skills-manager/extensions/` 目录下创建 `.js` 扩展文件
2. 导出 `setup(context)` 函数，调用 `context.registerImportProvider()` 或 `context.registerPublishTarget()` 注册扩展
3. 重启 Skills Manager，扩展自动加载生效

也可以在设置页面的"Provider 注册模式"中直接导入 `.js` 扩展文件，无需手动操作文件系统。

详细开发指南请参阅 [extensions-guide/provider-guide.md](extensions-guide/provider-guide.md)。

## API 文档

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/config` | 获取全局配置 |
| PUT | `/api/config` | 更新全局配置 |
| GET | `/api/projects` | 获取所有项目 |
| POST | `/api/projects` | 添加项目 |
| POST | `/api/projects/:id/scan` | 扫描项目工具配置 |
| DELETE | `/api/projects/:id` | 删除项目 |
| GET | `/api/skills` | 获取 Skills 文件树 |
| GET | `/api/skills/file?path=xxx` | 获取文件内容 |
| PUT | `/api/skills/file` | 保存文件 |
| POST | `/api/skills/file` | 创建新文件 |
| DELETE | `/api/skills/file?path=xxx` | 删除文件 |
| GET | `/api/skills/search?q=xxx` | 搜索文件 |
| GET | `/api/skills/templates` | 获取模板列表 |
| GET | `/api/links/status` | 获取链接状态 |
| POST | `/api/links/sync` | 同步链接 |
| POST | `/api/links/remove` | 移除链接 |
| POST | `/api/links/verify` | 验证链接 |
| POST | `/api/tools/export` | 导出 ZIP |
| POST | `/api/import/scan/github` | 扫描 GitHub 仓库 |
| POST | `/api/import/scan/clawhub` | 扫描 ClawHub Skill |
| POST | `/api/import/execute` | 执行导入 |
| GET | `/api/import/history` | 获取导入历史 |
| GET | `/api/import/subscriptions` | 获取订阅列表 |
| POST | `/api/import/subscribe` | 订阅来源 |
| POST | `/api/import/check-all-updates` | 批量检查更新 |
| GET | `/api/import/providers` | 获取已注册的导入 Provider 列表 |
| POST | `/api/import/scan/provider/:providerId` | 通用 Provider 扫描端点 |
| POST | `/api/import/scan/auto-detect` | 自动检测 URL 并匹配 Provider |
| GET | `/api/import/extensions` | 获取已安装的扩展插件列表 |
| POST | `/api/import/extensions/upload` | 上传扩展插件（.js 文件） |
| DELETE | `/api/import/extensions/:name` | 删除扩展插件 |
| GET | `/api/publish/targets` | 获取所有发布目标 |
| POST | `/api/publish/:targetId` | 发布 Skill 到指定目标 |
| GET | `/api/publish/:targetId/status/:publishId` | 查询发布审核状态 |
| GET | `/api/publish/:targetId/list` | 获取已发布列表 |
| POST | `/api/import-stream/execute` | SSE 流式导入（实时进度） |

## 支持的 AI 工具

### 系统默认扫描工具

以下工具已内置，添加项目时系统会自动扫描检测：

| 工具 | 配置目录 | Skills 目录 |
|------|---------|------------|
| Claude | `.claude/` | `.claude/skills/` |
| Cursor | `.cursor/` | `.cursor/skills-cursor/` |
| CodeBuddy | `.codebuddy/` | `.codebuddy/skills/` |
| GitHub Copilot | `.github/` | `.github/copilot/skills/` |
| Qoder | `.qoder/` | `.qoder/skills/` |
| Codex | `.codex/` | `.codex/skills/` |
| QoderWork | `.qoderwork/` | `.qoderwork/skills/` |

### 自定义工具路径

除了内置工具外，还支持用户手动新增自定义工具路径，灵活适配任何 AI 编程工具或自定义目录结构。

## License

MIT

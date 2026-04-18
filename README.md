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
| **使用分析** | 事件埋点、仪表盘概览、热门 Skills 排行、最近活动时间线，数据本地存储 |

## 核心特性

- **可展开/收起的侧边栏**：默认展开显示图标+文字，支持点击收起为图标模式
- **多源目录管理**：支持配置多个 Skills 源目录，灵活切换
- **AI 生成技能**：通过 AI 模型自动生成 SKILL.md 文件
- **AI 优化技能**：对已有技能进行 AI 优化，支持 DiffEditor 对比原始内容与草稿，确认后替换
- **Skill 自定义别名**：为 Skill 设置自定义展示名称，不修改文件夹，支持设置/修改/清除，localStorage 持久化
- **版本管理**：为 Skill 创建快照、查看版本历史、对比差异、一键回滚，AI 优化时自动创建备份
- **使用分析**：轻量级本地分析仪表盘，追踪查看/编辑/AI 优化/导出等操作，热门 Skills 排行、最近活动时间线
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
│   ├── routes/
│   │   ├── config.ts          # 配置 API
│   │   ├── projects.ts        # 项目管理 API
│   │   ├── skills.ts          # Skills 文件 API
│   │   ├── links.ts           # 链接管理 API
│   │   └── tools.ts           # 工具 API（导出等）
│   ├── services/
│   │   ├── configService.ts   # 配置管理
│   │   ├── fileService.ts     # 文件操作
│   │   ├── linkService.ts     # 软链接操作
│   │   ├── scanService.ts     # 项目扫描
│   │   ├── convertService.ts  # 格式转换
│   │   └── templateService.ts # 模板管理
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
│   │   ├── AnalyticsPage.tsx  # 使用分析页
│   │   └── HelpPage.tsx       # 帮助中心页
│   ├── stores/                # Zustand 状态管理
│   │   ├── configStore.ts     # 全局配置
│   │   ├── projectStore.ts    # 项目状态
│   │   └── skillsStore.ts     # Skills 状态
│   ├── hooks/                 # 自定义 Hooks
│   └── types/                 # TypeScript 类型定义
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

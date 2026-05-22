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
| **Skills 雷达** | AI 语义搜索（描述场景匹配 Skill）、能力总览（AI 分类统计 + hover 展示详情）、自动标签分类、Skills 全景列表（多 Skills 库聚合 + 版本号展示 + 模糊搜索）、数据本地持久化 |
| **Skills 工程化** ⭐ v1.4.0 | Lint 静态检测（13 条规则覆盖 description / 结构 / 安全 / 一致性）、健康度评分（A-F 等级 + 0-100 分）、AI description 质量评估（按需）、**Skills 测试沙箱**（手动/AI 自动生成场景 → 模拟触发决策 → 触发率+匹配度双指标 → 历史回看，可搜索下拉支持 name·description 展示）、软依赖管理（YAML `related` 字段）、场景智能搜索 |
| **使用分析** | 事件埋点、仪表盘概览、热门 Skills 排行、最近活动时间线，数据本地存储 |
<img width="800" height="447" alt="slide_01" src="https://github.com/user-attachments/assets/85d10408-96e0-4c19-9fc8-17d49f960928" />
<img width="800" height="447" alt="slide_02" src="https://github.com/user-attachments/assets/076550a4-7e75-4a57-b48d-c23f6504bcbd" />
<img width="800" height="447" alt="slide_03" src="https://github.com/user-attachments/assets/bf0a3ff4-5883-41b5-abea-024581701231" />
<img width="800" height="447" alt="slide_04" src="https://github.com/user-attachments/assets/53804a3e-4a54-44a3-9dd2-3d30818ec2dd" />
<img width="800" height="447" alt="slide_05" src="https://github.com/user-attachments/assets/49983ad6-b582-414f-bd5a-b438dba3f97b" />
<img width="800" height="447" alt="d6519d48-ae1f-4180-a6f6-92c51488145a" src="https://github.com/user-attachments/assets/e50ec4ee-4371-49b0-9436-754d8cd2c986" />
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
- **Skills 雷达**：AI 语义搜索（描述场景匹配 Skill）、能力总览（AI 自动分类统计 + hover 展示详情）、自动标签分类、Skills 全景列表（多 Skills 库聚合 + 版本号展示 + 模糊搜索）、数据本地持久化（tags/summary 存储在 `~/.skills-manager/`）
- **Skills 工程化平台**（v1.4.0 新增）：
  - **Lint 静态检测 + 健康度评分**：13 条规则覆盖 description 质量 / SKILL.md 结构 / 安全检测（API Key/密码/内网 URL）/ 一致性，输出 0-100 分 + A/B/C/D/F 等级，文件树彩色徽章直观展示
  - **AI description 评估**：按需调用 LLM 评估 description 质量并给出改进建议（避免无效 token 消耗）
  - **Skills 测试沙箱**：模拟 AI 触发决策，给定测试场景验证 Skill 触发准确率（Top 3 命中）+ description 匹配度，AI 自动生成测试场景，历史持久化（`~/.skills-manager/sandbox-history.json`）
  - **软依赖管理**：在 SKILL.md frontmatter 中声明 Skill 之间的"推荐搭配"关联关系（纯软引用，不做版本约束）
    - **使用方法**：在 `SKILL.md` 顶部 frontmatter 添加 `related` 字段，例如 `related: [skill-a, skill-b]`（也支持多行 `- item` 写法）
    - **文件树徽章**：声明了 related 的 Skill 旁会出现青色"N 相关"徽章，hover 查看完整关联列表，点击可一键跳转到对应 Skill
    - **容错提示**：引用的 Skill 在当前 Skills 库中不存在时，会灰显并标注"未找到"，避免误导
    - **使用场景**：帮助管理大量 Skills 时快速发现哪些经常搭配使用（如"代码审查"与"提交规范"）
  - **场景智能搜索**：基于自然语言描述使用场景，AI 语义匹配最合适的 Skills（位于雷达页"AI 智能检索"区域）
- **Skill Harness 平台**（v1.5~v2.0 新增）：
  - **Rubric 四维评测引擎**：L1 结构完整性 / L2 描述质量 / L3 内容深度 / L4 安全规范，加权评分 0-100 + A/B/C/D/F 等级，自定义 Rubric 模板
  - **评测-改进循环（Eval Loop）**：自动化的 Rubric 评测 → AI 改进 → 版本快照 → 再评测循环，SSE 实时进度，退出条件自适应
  - **智能推荐排名**：语义匹配度 × 0.6 + 质量分 × 0.3 + 使用热度 × 0.1 的综合排名，质量分徽章 + 等级筛选
  - **Skill 对比评测**：并排雷达图 + 内容 Diff + 触发率对比，支持跨版本对比
  - **使用反馈采集**：有效/无效/部分有效/建议四种反馈类型，JSONL 存储 + 统计聚合，Skills 库快捷反馈按钮
  - **自动保鲜机制**：URL 有效性 / 路径存在性 / 反馈趋势 / 修改时间四维检测，文件树保鲜度指示器（绿/黄/红），AI 保鲜建议
  - **生命周期看板**：6 阶段看板视图（草稿→评测中→已发布→使用中→待优化→已归档），聚合质量分 + 反馈 + 保鲜度数据
  - **品质锚定创建**：AI 生成 Skill 时选择品质定位（MVP/精打磨/生产级），生成后自动 Rubric 评测并对比目标分
- **使用分析**：轻量级本地分析仪表盘，追踪查看/编辑/AI 优化/导出等操作，热门 Skills 排行、最近活动时间线、反馈统计维度
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
后端: Node.js + Express.js + TypeScript (tsx) + better-sqlite3
存储: JSON 本地配置 + SQLite 事件/反馈/计数（~/.skills-manager/db.sqlite）
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
5. 注册快捷命令 `sm` / `sm-stop` 到 shell 配置

### 启动与停止

```bash
# 快捷命令（安装后新开终端生效）
sm              # 启动项目
sm-stop         # 停止项目

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
2. 清除 shell 别名（`sm` / `sm-stop`）
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
│   ├── index.ts               # Express 入口（auth → pathGuard → rate-limit → routes）
│   ├── cli.ts                 # 全局命令行入口
│   ├── extensions.ts          # 扩展加载机制
│   ├── db/
│   │   └── sqlite.ts          # better-sqlite3 单例 + schema + JSONL 迁移
│   ├── middleware/
│   │   ├── auth.ts            # X-SM-Token / Bearer 鉴权（仅 header）
│   │   ├── pathGuard.ts       # 路径白名单守卫（sourceDirs/projects 之内）
│   │   └── rateLimit.ts       # 内存版 per-IP 限流
│   ├── routes/
│   │   ├── config.ts          # 配置 API
│   │   ├── projects.ts        # 项目管理 API
│   │   ├── skills.ts          # Skills 文件 API
│   │   ├── links.ts           # 链接管理 API
│   │   ├── tools.ts           # 工具 API（导出等）
│   │   ├── import.ts          # 导入中心 API
│   │   ├── import-stream.ts   # 导入进度 SSE 端点
│   │   ├── publish.ts         # 发布集成 API
│   │   ├── radar.ts           # Skills 雷达 API
│   │   ├── skill-lint.ts      # Lint 静态检测 API
│   │   ├── sandbox.ts         # 测试沙箱 API
│   │   ├── skill-rubric.ts    # Rubric 评测 API
│   │   ├── eval-loop.ts       # Eval Loop SSE API
│   │   ├── compare.ts         # Skill 对比 API
│   │   ├── feedback.ts        # 使用反馈 API
│   │   ├── fresh.ts           # 保鲜检测 API
│   │   └── backup.ts          # 数据备份/恢复 API
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
│   │   ├── subscriptionService.ts   # 订阅管理
│   │   ├── analyticsService.ts # 使用分析（SQLite）
│   │   ├── versionService.ts  # 版本快照（原子化 restore）
│   │   ├── radarService.ts    # Skills 雷达聚合 + 排名（SQLite usage_stats / rubric_cache）
│   │   ├── rubricService.ts   # Rubric 四维评测引擎
│   │   ├── evalLoopService.ts # 评测-改进循环引擎
│   │   ├── compareService.ts  # Skill 对比评测服务
│   │   ├── feedbackService.ts # 使用反馈采集服务（SQLite）
│   │   └── freshService.ts    # 自动保鲜检测服务（含 SSRF 防御）
│   └── utils/
│       ├── symlink.ts         # 软链接工具函数
│       ├── validation.ts      # 路径/文件名校验
│       ├── safeUnzip.ts       # ZipSlip + 解压炸弹防护
│       ├── logger.ts          # pino 结构化日志
│       └── json.ts            # 安全 JSON 解析（safeParseJsonRecord）
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
│   │   ├── radar/
│   │   │   ├── badges.tsx             # SourceBadge / TagBadge / GradeBadge
│   │   │   └── AISearchSection.tsx    # 雷达页 AI 检索区（场景搜索 + ClawHub 检索）
│   │   ├── skills/
│   │   │   ├── FileTree.tsx           # 文件树（含 AI 优化/导出/别名管理）
│   │   │   ├── Editor.tsx             # Monaco 编辑器 & Markdown 预览
│   │   │   ├── AISkillGenerator.tsx   # AI 生成技能弹框（含品质锚定）
│   │   │   ├── AISkillOptimizer.tsx   # AI 优化技能弹框（DiffEditor 对比）
│   │   │   ├── SkillHealthDialog.tsx  # 健康度弹框（四维雷达图 + Rubric 报告 + Eval Loop）
│   │   │   ├── SkillComparePanel.tsx  # Skill 对比评测面板
│   │   │   ├── EvalLoopPanel.tsx      # 评测-改进循环面板
│   │   │   ├── VersionHistoryDialog.tsx # 版本历史弹框
│   │   │   └── SearchResults.tsx      # 搜索结果组件
│   │   └── ui/                # shadcn/ui 基础组件
│   ├── pages/
│   │   ├── ProjectsPage.tsx   # 项目管理页
│   │   ├── SkillsPage.tsx     # Skills 库页
│   │   ├── SkillsRadarPage.tsx # Skills 雷达页
│   │   ├── ImportPage.tsx     # 导入中心页
│   │   ├── AnalyticsPage.tsx  # 使用分析页（含反馈统计）
│   │   ├── LifecyclePage.tsx  # 生命周期看板页
│   │   ├── HomePage.tsx       # 首页
│   │   └── HelpPage.tsx       # 帮助中心页
│   ├── stores/                # Zustand 状态管理
│   │   ├── configStore.ts     # 全局配置
│   │   ├── projectStore.ts    # 项目状态
│   │   ├── skillsStore.ts     # Skills 状态
│   │   └── radarStore.ts      # Skills 雷达状态（搜索/摘要/标签）
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

## 安全与运维

服务默认监听 `127.0.0.1:3001`，所有 `/api/*` 端点都强制鉴权。下面是接入这套服务前需要知道的关键事实。

### 鉴权（必读）

启动时 Skills Manager 会在 `~/.skills-manager/security.json` 写入一个 128 位随机 token（文件 `chmod 0600`，父目录 `chmod 0700`）。所有 API 调用都必须带上：

```bash
# 推荐：X-SM-Token header
curl -H "X-SM-Token: $TOKEN" http://127.0.0.1:3001/api/skills

# 也接受标准的 Authorization Bearer
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3001/api/skills
```

**禁止从 `?token=` 查询参数读 token**——查询字符串会进 access log / 浏览器历史 / Referer header，等于明文外泄。CLI 在浏览器首次打开时通过 `?token=` 一次性传递，前端立刻把它存进 localStorage 并清掉 URL 参数；这是唯一例外。

`/api/health` 是唯一豁免路径，可用于探活。

只在以下情况可禁用鉴权：`SM_AUTH_DISABLE=1` **且** `SM_HOST` 为 loopback（`127.0.0.1` / `::1` / `localhost`）。任何一项不满足都强制 token。

### 路径白名单

`pathGuard` 中间件会校验任何 body / query 中带路径字段（`path`、`skillPath`、`skillPathA/B`、`paths[]`、`skillPaths[]` 等）的请求，确保它们都落在 `~/.skills-manager` 或用户配置的 `sourceDirs` / `projects` 路径之内。越界访问（如 `skillPath: "/etc/"`）返回 `403`。

新增路由如果接受路径输入，**字段名必须出现在 `server/middleware/pathGuard.ts` 的 `PATH_FIELDS` 数组里**，否则等于绕过校验。

### 速率限制

| 范围 | 上限 | 触发返回 |
|---|---|---|
| 全部 `/api/*` | 300 / 分钟 / IP | `429` + `Retry-After` |
| `/api/fresh/*`（外发 HTTP） | 10 / 分钟 / IP | `429` + 提示语 |
| `/api/backup/*`（重 IO） | 5 / 分钟 / IP | `429` + 提示语 |

限流是进程内 Map，单进程部署足够；多进程或反代后部署需要外接 redis 之类。

### AI 模型凭据从哪来

服务端**不接受**客户端传 `baseUrl` / `apiKey` / `modelName`。所有需要调 LLM 的端点（`/api/fresh/suggestions`、`/api/compare/skills`、`/api/skill-rubric/*`、`/api/eval-loop/*`）会从用户配置 `~/.skills-manager/user-config.json` 的 `defaultModelId` 自动选用模型。客户端只发 `includeAI: true` 这种开关位。

这是为了堵 SSRF + Bearer 外泄——攻击者构造 `baseUrl: "http://169.254.169.254/..."` 就能让服务把 `Authorization: Bearer ...` 打到云元数据接口。

### 数据备份

| 操作 | 说明 |
|---|---|
| `POST /api/backup/export` | 流式导出 `~/.skills-manager/` 整个目录为 zip，**自动排除 `security.json`**（根级 + 任意嵌套层级）。 |
| `POST /api/backup/import` | 上传 zip → 解压到 staging（`safeUnzip` 防 ZipSlip + 解压炸弹）→ 校验 → 替换数据。原数据自动备份到 `~/.skills-manager.bak-<时间戳>`，失败回滚。 |

`safeUnzip` 的硬限制（见 `server/utils/safeUnzip.ts:SAFE_UNZIP_LIMITS`）：单文件 ≤ 1 GiB / 总解压量 ≤ 2 GiB / entry 数 ≤ 50000。超过即拒绝并回滚。

## 自定义 Rubric 模板

Rubric 评测引擎支持自定义评测模板，允许你根据团队标准调整评分维度和权重。

### 模板存储位置

自定义模板存储在用户数据目录下：

```
~/.skills-manager/rubric-templates/
```

每个模板为独立的 JSON 文件（如 `my-template.json`）。

### 通过 API 管理模板

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/skill-rubric/templates` | 获取所有可用模板（内置 + 自定义） |
| PUT | `/api/skill-rubric/templates` | 保存/更新自定义模板 |

**获取模板列表：**

```bash
curl http://localhost:3001/api/skill-rubric/templates
```

**保存自定义模板：**

```bash
curl -X PUT http://localhost:3001/api/skill-rubric/templates \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-team-rubric",
    "name": "团队自定义评测模板",
    "version": "1.0.0",
    "dimensions": [
      {
        "id": "L1",
        "label": "结构完整性",
        "weight": 0.30,
        "items": [
          { "id": "frontmatter-exists", "label": "Frontmatter 存在", "priority": "essential", "weight": 1.0, "check": "static" },
          { "id": "name-exists", "label": "name 字段存在", "priority": "essential", "weight": 1.0, "check": "static" }
        ]
      },
      {
        "id": "L2",
        "label": "描述质量",
        "weight": 0.30,
        "items": [
          { "id": "desc-length", "label": "描述长度充分", "priority": "important", "weight": 0.7, "check": "llm" }
        ]
      }
    ]
  }'
```

### 手动创建模板

也可以直接在模板目录下创建 JSON 文件：

```bash
# 创建模板目录（首次使用）
mkdir -p ~/.skills-manager/rubric-templates

# 创建模板文件
cat > ~/.skills-manager/rubric-templates/my-template.json << 'EOF'
{
  "id": "my-template",
  "name": "我的评测模板",
  "version": "1.0.0",
  "dimensions": [
    {
      "id": "L1",
      "label": "结构完整性",
      "weight": 0.35,
      "items": [...]
    }
  ]
}
EOF
```

> 模板 `id` 字段为唯一标识，`name` 为显示名称。维度权重之和建议为 1.0。评测时通过 `templateId` 参数指定使用的模板，不指定则使用内置默认模板。

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
| GET | `/api/radar/skills` | 聚合所有 Skills（Skills 库 + 项目 + 导入历史） |
| POST | `/api/radar/search` | AI 语义搜索：场景描述匹配 Skills |
| POST | `/api/radar/summary` | AI 能力总览：分类统计所有 Skills |
| POST | `/api/radar/tags` | AI 自动标签：批量生成 Skills 分类标签 |
| POST | `/api/radar/usage/increment` | 累加 Skill 使用计数（SQLite UPSERT） |
| GET / PUT | `/api/radar/cache/{summary,tags}` | 摘要/标签缓存读写 |
| GET / POST | `/api/skill-rubric/templates` | 列出 / 保存自定义 Rubric 模板 |
| POST | `/api/skill-rubric/evaluate` | 评测单个 Skill（`includeAI` 可选；模型从 user-config 取） |
| POST | `/api/skill-rubric/batch` | 批量评测当前 sourceDir 下全部 Skills |
| POST | `/api/eval-loop/start` | SSE：评测-改进循环（`includeAI` 必传） |
| POST | `/api/eval-loop/stop` | 终止指定 loop |
| GET | `/api/eval-loop/{history,active}` | 历史 / 进行中循环 |
| POST | `/api/compare/skills` | 双 Skill Rubric + 内容 Diff（最多 5000 行） |
| POST | `/api/feedback` | 提交反馈（effective / ineffective / partial / suggestion） |
| GET | `/api/feedback?skillPath=` | 查反馈（可按 skillPath 过滤） |
| GET | `/api/feedback/stats` | 反馈统计聚合 |
| DELETE | `/api/feedback/:id` | 删除单条 |
| DELETE | `/api/feedback?confirm=true` | 全部清空（必须带 `confirm=true`） |
| POST | `/api/fresh/check` | 单 Skill 保鲜检测 |
| POST | `/api/fresh/batch` | 批量保鲜 |
| POST | `/api/fresh/suggestions` | AI 改进建议（模型从 user-config 取） |
| POST | `/api/backup/export` | 流式导出 `~/.skills-manager/` 为 zip |
| POST | `/api/backup/import` | 上传 zip → 验证 → 替换数据（带回滚） |
| POST | `/api/skill-lint/check` | 单文件 Lint |
| POST | `/api/sandbox/{run,generate}` | Skills 测试沙箱 / AI 生成场景 |

> 全部端点要求 `X-SM-Token` 或 `Authorization: Bearer` header（见上文「安全与运维」）。
> 响应 `403` ⇒ 路径不在白名单；`429` ⇒ 超限；`401` ⇒ token 缺失/错。

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

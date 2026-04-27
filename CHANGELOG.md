# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.2] - 2026-04-27

### Fixed

- 修复 Popover 下拉选择器无法弹出的问题（`Button` 组件在 React 18 下缺少 `forwardRef`，导致 Radix Popper 定位引擎无法获取 trigger DOM 节点）
- 优化 `SearchableSkillSelect` 下拉列表样式：固定宽度、名称与描述分行显示、文字截断、限制列表最大高度

### Changed — 代码架构精简

- **拆分 `importService.ts`**：将 1200+ 行的单文件拆分为 `import/urlParsers.ts`、`import/gitApis.ts`、`import/providerRegistry.ts`、`import/index.ts` 四个模块，职责清晰
- **移除死代码**：删除 6 个未使用的组件文件（`BulkExportImport.tsx`、`GitHubImporter.tsx`、`GitLabImporter.tsx`、`GiteeImporter.tsx`、`LinkStatusPanel.tsx`、`SyncButton.tsx`）
- **依赖整理**：移除 `simple-git`、`tar-stream`、`@types/tar-stream` 等未使用依赖，补充 `.gitignore` 规则
- **代码规范**：移除 `scanService.ts` 中不必要的 `console.log` 调试语句

---

## [1.4.1] - 2026-04-24

### Fixed

- 修复 SourceDirStats 有效 Skill 图标与文件树不一致的问题（统一为 FolderCheck）
- 修复底部「批量健康度检测」和「AI 生成技能」按钮未吸底、随内容滚动的问题
- 修复健康度检测结果刷新页面后丢失的问题（改为 localStorage 持久化）
- 修复已有 AI 评估结果的 Skill 打开弹框仍提示「开始评估」而非直接展示结果的问题

---

## [1.4.0] - 2026-04-24

### Added — Skills 工程化平台升级（4 大模块）

#### 模块 1：Skills Lint + 健康度评分

- **静态 Lint 检测**：实现 13 条静态规则，覆盖 4 类质量维度
  - description 质量：缺失 / 过短 / 过长 / 缺触发词
  - SKILL.md 结构：frontmatter 缺失 / name 缺失 / 文件过大 / references 引用失效
  - 安全检测：API Key（OpenAI sk-/AWS/GitHub/Google）/ 密码硬编码 / 内网 URL（alibaba-inc.com 等）
  - 一致性：name 与目录名一致性 / 子文件命名规范（kebab-case/snake_case）
- **健康度评分算法**：基于 issue 等级加权（error -25 / warning -8 / info -2），关键字段缺失上限 30，输出 0-100 分 + A/B/C/D/F 等级
- **AI 评估增强**：可选调用 LLM 评估 description 质量，按需触发避免无效 token 消耗
- **集成位置**：Skills 库页面文件树每个 Skill 旁显示彩色等级徽章，点击查看详情 Dialog；底部新增"批量健康度检测"按钮
- **新增 API**：`POST /api/skill-lint/check` / `POST /api/skill-lint/batch` / `POST /api/skill-lint/ai-assess`

#### 模块 2：Skills 测试沙箱

- **模拟 AI 触发决策**：给定用户场景描述，AI 模拟 Coding Agent 决策流程，推荐 Top 3 Skill，期望命中 Rank 1/2/3 → 触发分 1.0/0.7/0.4
- **匹配度评估**：AI 评估期望 Skill 的 description 与场景的语义匹配度（0-1），可选关闭以节省 token
- **两种测试模式**（独立 Tab 切换）：
  - **手动配置场景**：手动添加测试用例（用户场景 + 期望触发的 Skill），支持"加载示例"一键填充
  - **AI 自动生成场景**：选择目标 Skill，AI 根据 description 自动生成多个不同话术风格的测试场景
- **整体指标**：自动计算触发准确率 + 平均匹配度，可视化卡片展示
- **可搜索 Skill 下拉**：基于 cmdk 的 SearchableSkillSelect 组件，支持关键词搜索 + 列表显示 name · description（一行截断），便于 Skills 数量较多时快速定位
- **历史持久化**：测试结果保存到 `~/.skills-manager/sandbox-history.json`，最多保留 50 条，按测试模式筛选展示，支持回看 / 清空
- **集成位置**：Skills 雷达页顶部 Tab 切换"雷达概览 / 测试沙箱"，沙箱面板含完整结果表格 + 历史时间线
- **新增 API**：`POST /api/sandbox/test` / `POST /api/sandbox/auto-generate-cases` / `GET|DELETE /api/sandbox/history`

#### 模块 3：软依赖管理（Related Skills）

- **YAML frontmatter 软依赖声明**：在 SKILL.md frontmatter 增加 `related: [skill-a, skill-b]` 字段，无需版本约束，纯软引用
- **flow style + block style 兼容**：YAML 列表支持 `[a, b, c]` 和多行 `- item` 两种语法
- **依赖徽章展示**：文件树 Skill 节点旁显示青色"N 相关"徽章，hover 展示完整列表，点击下拉菜单可跳转
- **未找到提示**：引用的 Skill 不存在时灰显并标注"未找到"，避免误导
- **新增工具函数**：`server/utils/yamlUtils.ts` 新增 `parseYamlList` 公共函数

#### 模块 4：场景智能搜索

- **场景搜索**：AI 语义搜索能力（描述使用场景，自动匹配最合适的 Skill）

### Changed

- **README.md**：功能概览表格新增"Skills 工程化"模块说明
- **server/services/fileService.ts**：`parseSkillMeta` 增加 `relatedSkills` 字段提取
- **src/types/index.ts**：`FileTreeNode` 增加 `relatedSkills?: string[]` 字段
- **src/components/skills/FileTree.tsx**：扩展 props 支持健康度徽章 + 软依赖徽章 + 跳转回调
- **src/pages/SkillsRadarPage.tsx**：顶部新增 Tab 切换层，雷达概览与测试沙箱解耦

---

## [1.3.1] - 2026-04-22

### Added

- **Skills 雷达 Tab 切换**：AI 语义搜索区域新增"Skills 库检索"和"ClawHub 检索"Tab 切换，ClawHub 检索暂置灰预留入口
- **Skills 雷达文案优化**：副标题文案优化，更清晰地传达功能价值

### Fixed

- **导入过滤模式 Bug**：修复通过 GitHub 导入 Skills 时，选择"仅有效 Skill"过滤模式后，导入按钮显示数量不对、实际导入所有文件的 bug
  - 切换到"仅有效 Skill"模式时自动取消选中非有效项
  - 全选/全不选只作用于当前显示列表
  - 导入执行只导入当前过滤模式下被选中的 Skill

---

## [1.3.0] - 2026-04-21

### Added

- **Skills 雷达增强**：
  - 数据范围优化：Skills 全景数据范围改为扫描所有 Skills 库目录（支持多库），不再限于单个活跃库
  - 版本信息展示：Skills 全景列表从版本索引中读取并展示每个 Skill 的最新版本号
  - 模糊搜索：Skills 全景新增搜索框，支持按名称、描述、标签进行实时模糊搜索
  - 能力总览 hover 展示：鼠标悬停在能力总览的分类卡片和技能名称上时，展示完整的 description 信息
  - 超长文本 hover 提示：Skills 全景表格中被截断的名称和描述，hover 时展示完整内容
  - 数据本地持久化：tags 和 summary 数据从浏览器 localStorage 迁移到服务端文件存储（`~/.skills-manager/radar-tags.json`、`radar-summary.json`），清除浏览器缓存不会丢失数据
  - 缓存 API：新增 `GET/PUT /api/radar/cache/tags` 和 `GET/PUT /api/radar/cache/summary` 四个端点
- **默认模型配置**：
  - 模型配置弹窗新增"默认使用模型"下拉选择，已测试通过的模型可设为默认
  - AI 生成技能和 AI 优化技能弹窗中显示当前使用的默认模型信息
  - 删除模型时自动清除默认选择

### Changed

- **AI 生成/优化技能**：移除弹窗中的"使用模型"选择器，统一使用默认模型，简化操作流程
- **AI 优化技能文案**：文案从"选择一个模型来优化"改为"AI 将分析并优化"
- **Skills 全景表格**：从 CSS Grid 布局改为 HTML Table 布局（`table-fixed` + `colgroup` 固定列宽 + `sticky` 表头），解决列错位和边框显示 bug
- **AI 操作超时**：前端 fetch 调用统一增加 `AbortSignal.timeout` 设置（search: 120s, summary/tags: 180s），后端 summary/tags 超时从 120s 调大到 180s

### Fixed

- **默认模型不持久化**：修复 `configService.ts` 中 `updateConfig` 参数类型缺少 `defaultModelId`、`saveConfig` 构建 `userConfig` 时遗漏 `defaultModelId` 的 bug，导致选择默认模型后重新打开弹窗不显示
- **Skills 全景列错位**：修复表头和表体使用两个独立 `<table>` 导致列宽无法对齐的 bug
- **Skills 全景版本不显示**：修复 `scanDirForSkills` 未从版本索引（`~/.skills-manager/versions/index.json`）读取版本号的 bug
- **Skills 全景列表不全**：修复仅扫描当前活跃 Skills 库（1个）而非所有 Skills 库目录的 bug
- **Skills 全景滚动失效**：将 `ScrollArea` 组件替换为原生 `overflow-y-auto` 容器，解决与 `<table>` 嵌套导致的滚动失效问题
- **能力总览超时**：修复前端 fetch 调用无超时设置导致的 `The operation was aborted due to timeout` 错误

---

## [1.2.0] - 2026-04-20

### Added

- **扩展插件管理**：设置中 Provider 注册模式下新增导入/删除扩展插件功能，支持从本地选择 `.js` 文件安装到 `~/.skills-manager/extensions/`
- **Aone 开放平台导入**：新增 Aone 开放平台导入扩展插件（`aone-provider.js`），支持从 `https://open.aone.alibaba-inc.com/skill/` 导入 Skills
  - 支持 `@scope/name` 和无 scope 两种 URL 格式
  - 支持版本号指定（`?version=x.x.x`）
  - 从 SKILL.md 的 `name` 字段读取 Skill 名称
- **扩展插件 API**：新增 `GET /api/import/extensions`、`POST /api/import/extensions/upload`、`DELETE /api/import/extensions/:name` 三个端点
- **Skills 雷达**：新增独立页面，聚合 Skills 库 + 项目 + 导入历史的所有 Skills
  - AI 语义搜索：描述使用场景，AI 匹配最相关的 Skills 并解释推荐理由
  - 能力总览：AI 自动分析所有 Skills 并按功能领域分类统计
  - 自动标签分类：AI 为每个 Skill 生成 2-4 个分类标签，支持按标签筛选
  - Skills 全景列表：表格视图，支持按来源/标签筛选
- **Skills 雷达 API**：新增 `GET /api/radar/skills`、`POST /api/radar/search`、`POST /api/radar/summary`、`POST /api/radar/tags` 四个端点
- **导入历史版本号 badge**：所有有版本号的导入记录都显示版本号标签，不再限制为特定来源
- **Skills 库版本号**：文件树中显示订阅来源的版本号 badge（`v1.0.1` 等）
- **Header 快捷键提示优化**：导入快捷键按钮文案改为"快速导入"，增加详细的 tooltip 说明
- **扩展认证配置保存按钮**：设置中扩展认证配置增加显式保存按钮，替代实时保存模式

### Changed

- **ImportSource 类型扩展**：`ImportSource` 类型支持任意字符串，兼容扩展 provider ID 作为导入来源
- **导入历史来源名称**：扩展 provider 导入的记录正确显示 provider 名称（如"Aone开放平台"），不再固定显示"本地文件"
- **导入历史筛选**：来源筛选下拉框动态包含已注册的自定义 provider
- **导入历史订阅能力**：扩展 provider 来源的导入记录支持订阅功能（有 sourceUrl 即可订阅）
- **ExtensionProviderPane**：扫描成功后正确设置 `importSource`、`sourceUrl`、`repoInfo`，确保导入记录和版本号正确传递

### Fixed

- **订阅版本号不同步**：修复 `applyUpdate` 方法在更新完成后没有将 `latestVersion` 写入 `version` 字段的 bug，导致 `checkUpdate` 永远认为有更新
- **版本号不显示**：修复 `subscriptions.json` 中字段是 `latestVersion` 而非 `version` 时，Skills 库文件树不显示版本号的问题
- **导入历史白屏**：修复 `getSourceLabel` 和 `isSubscribable` 函数定义丢失导致的 `ReferenceError` 白屏错误

---

## [1.1.0] - 2026-04-19

### Added

- **导入中心**：全新的多渠道导入功能
  - GitHub 仓库导入：输入仓库地址，自动扫描并导入 Skills，支持指定分支
  - ClawHub 集成：从 ClawHub 技能市场直接导入 OpenClaw Skills
  - 本地文件导入：支持文件夹选择器，扫描本地目录中的 Skills
  - ZIP 压缩包导入：上传 ZIP 文件，自动解压并扫描 Skills
  - 剪贴板导入：粘贴 SKILL.md 内容直接导入
  - 批量导入：多个 URL 批量导入
  - CSV/JSON 导入导出：支持导入历史的 CSV/JSON 格式导入导出
- **导入进度实时展示**：通过 SSE 实时推送导入进度，前端展示进度条和当前处理的 Skill 名称
- **导入历史**：完整记录每次导入操作，支持按来源过滤、删除、清空
- **订阅管理**：订阅 GitHub/ClawHub 来源的 Skills，支持批量检查更新、一键更新
- **全局拖放导入**：拖拽文件/文件夹到浏览器窗口，自动跳转导入中心并触发导入流程
- **快捷键支持**：Ctrl+I / Cmd+I 快速跳转到导入中心
- **扩展系统**：Provider 注册模式 + 文件级扩展加载机制
  - 导入 Provider 注册：通过 `.js` 扩展文件注册自定义导入源
  - 发布 Target 注册：通过 `.js` 扩展文件注册自定义发布目标
  - 扩展目录：`~/.skills-manager/extensions/`（用户级）和 `{project}/extensions/`（项目级）
- **发布集成**：Publish Target 机制，支持将 Skills 发布到云端 AI 平台
  - 内置软链接同步目标
  - 云端平台发布（悟空智能体平台等）
  - 审核状态追踪
- **工具同步优化**
  - 工具特性数据库：记录各 AI 工具的生效方式和已知问题
  - 编辑后生效提示：保存 Skill 后自动提示关联工具的生效方式
  - 项目卡片工具标签：展示工具生效方式标签
  - 导入后自动同步：导入 Skills 后可自动触发软链接同步
- **使用分析**：轻量级本地分析仪表盘
  - 概览卡片：总事件数、追踪 Skills 数、今日活动
  - 热门 Skills 排行
  - 最近活动时间线
- **冲突检测**：导入前自动检测命名冲突，支持跳过/覆盖/重命名/合并策略
- **自动更新**：订阅的 Skills 支持配置自动更新频率（每天/每周/每月）

### Changed

- **侧边栏**：新增导入中心、使用分析导航入口
- **配置分离**：敏感信息（Git Token、模型密钥等）迁移到 `~/.skills-manager/user-config.json`

---

## [1.0.0] - 2026-04-14

### Added

- **项目管理**：添加/管理本地项目，自动检测 AI 工具配置（`.claude/`、`.cursor/`、`.codebuddy/` 等）
- **Skills 库**
  - 树形文件浏览：有效 Skill 目录带标识
  - Monaco Editor 在线编辑：语法高亮、智能提示
  - Markdown 实时预览
  - 全文搜索
  - AI 生成技能：描述需求，AI 自动生成 SKILL.md
  - AI 优化技能：DiffEditor 对比原始内容与优化建议
  - Skill 自定义别名：为 Skill 设置自定义展示名称
  - 版本管理：快照/对比/回滚，AI 优化前自动备份
  - 导出 ZIP
- **软链接同步**：一键将 Skills 同步到各项目的 AI 工具配置目录
- **多源目录管理**：支持配置多个 Skills 源目录，灵活切换
- **多主题支持**：浅色/深色/像素风格切换
- **帮助中心**：内置使用指南
- **npm 发布**：支持 `npx ahang-skills-manager` 一键启动
- **CLI 工具**：支持 `--port`、`--no-open`、`-v`、`-h` 参数
- **安装/卸载脚本**：`install.sh` 一键安装，`uninstall.sh` 一键卸载
- **支持 7 种 AI 工具**：Claude、Cursor、CodeBuddy、GitHub Copilot、Qoder、Codex、QoderWork
- **自定义工具路径**：支持用户手动新增自定义工具路径

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-04-20

### Added

- **扩展插件管理**：设置中 Provider 注册模式下新增导入/删除扩展插件功能，支持从本地选择 `.js` 文件安装到 `~/.skills-manager/extensions/`
- **Aone 开放平台导入**：新增 Aone 开放平台导入扩展插件（`aone-provider.js`），支持从 `https://open.aone.alibaba-inc.com/skill/` 导入 Skills
  - 支持 `@scope/name` 和无 scope 两种 URL 格式
  - 支持版本号指定（`?version=x.x.x`）
  - 从 SKILL.md 的 `name` 字段读取 Skill 名称
- **扩展插件 API**：新增 `GET /api/import/extensions`、`POST /api/import/extensions/upload`、`DELETE /api/import/extensions/:name` 三个端点
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

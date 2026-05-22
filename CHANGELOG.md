# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.1] - 2026-05-21

### Security — 闭口 v2.1.0 review 暴露的剩余漏洞

- **pathGuard 真正挂载**：v2.1.0 引入了 `pathGuard` 中间件但**从未在 `server/index.ts` 注册**，导致接受 `skillPath` 的接口仍可访问任意绝对路径。`/api` 现在统一走 `app.use('/api', pathGuard())`，并把 `skillPathA` / `skillPathB` 加入 `PATH_FIELDS` 覆盖 `/api/compare`。
- **关闭 SSRF + Bearer 外泄**：`/api/fresh/suggestions`、`/api/compare/skills`、`/api/skill-rubric/{evaluate,batch}` 不再接受请求体里的 `baseUrl` / `apiKey` / `modelName`。服务端通过 `getDefaultModelConfig()` 从 `user-config.json` 自动选用模型，前端只发 `includeAI: true` 这种开关位。封堵 `baseUrl: "http://169.254.169.254/..."` 把 `Authorization` header 打到云元数据接口的攻击面。
- **鉴权收紧**：`SM_AUTH_DISABLE` 必须同时配合 loopback `SM_HOST` 才豁免；`crypto.timingSafeEqual` 替代手写常时比较；token 仅接受 `X-SM-Token` / `Authorization: Bearer`，不再读 `?token=` query。`~/.skills-manager` 父目录改为 `chmod 0700`，`security.json` 保持 `chmod 0600`。
- **解压炸弹防护**：`safeUnzip` 引入 `SAFE_UNZIP_LIMITS`（50000 entries / 2 GiB 总解压量 / 单文件 1 GiB）。pre-flight 校验 zip 头里的 `uncompressedSize`，post-decode 计数作为 backstop；非 `File`/`Directory` 类型 entry 一律 `autodrain`。
- **per-IP 速率限制**：`/api` 全局 300/min、`/api/fresh/*` 10/min、`/api/backup/*` 5/min；`express.json` body 上限从 50mb 下调到 1mb。
- **备份导出过滤升级**：`security.json` 排除从根级精确匹配改为 `endsWith('/security.json')` / `endsWith('\\security.json')`，防止嵌套层级里的 token 副本随导出泄出。
- **保鲜检测私网防御**：`freshService.checkUrl` 从 `redirect: 'follow'` 改为 `redirect: 'manual'`，逐跳验证。所有 RFC1918 / loopback / `169.254.0.0/16` / IPv6 ULA / link-local（fc00::/fd00::/fe80::）都拒绝。

### Reliability — 数据正确性

- **`usage_stats` / `rubric_cache` → SQLite UPSERT**：之前用 JSON 文件做 read-modify-write，并发 `POST /api/radar/usage/increment` 会丢计数。现在两张表都进 `~/.skills-manager/db.sqlite`，用 `INSERT ... ON CONFLICT DO UPDATE`。启动时一次性从旧 JSON 迁移，原文件改名 `.bak-*`。
- **`restoreVersion` 原子化**：先做 backup snapshot；再把目标快照写到 `<skillPath>.restore-tmp-*`；用 `rename` 把原目录挪到 `<skillPath>.old-*` 并 swap；任意环节失败回滚 `.old-*`。隐藏文件（`.git`、`.skill-meta` 等）跨 swap 保留。`versions/index.json` 改为 `tmp + rename` 原子写。
- **`compareService` LCS 限界**：超过 5000 行直接 throw（200MB DP 表内存上限）。错误能从 `compareSkills` 透传，不再被外层 `try/catch` 静默吞掉。

### Performance

- `aggregateAllSkills` 内层 `fs.realpath` 原本 O(N²)（10k+ syscall on 100 skills × 100 versions），现在外层预建 `Map<realpath, version>`，内层 O(1)。
- `analyticsService.parseSkillMeta` 加 mtime 感知缓存（模块级），`/api/analytics/dashboard` 不再每次重读全部 SKILL.md。
- `analytics` / `feedback` 的 `autoClean` 限频到每 24h 一次（之前每个读请求都跑 DELETE）。

### Frontend

- `src/api/client.ts` 新增 `compareApi` / `lifecycleApi` / `skillRubricApi`，三处裸 `fetch('/api/...')` 调用（`SkillComparePanel`、`SkillHealthDialog`、`LifecyclePage`）下沉到统一封装。
- `SkillsRadarPage.tsx` 855 → 513 行：抽出 `src/components/radar/AISearchSection.tsx`、`badges.tsx`。
- `SkillComparePanel.tsx`：删除 render-time `setState` 反模式，改 `useEffect`；Dialog `onOpenChange` 现在尊重 `nextOpen` 参数。
- `LifecyclePage.tsx`：`stageOverrides` 切换不再触发整页 refetch（拆开原始数据 fetch + `useMemo` 合并阶段 override）；localStorage 反序列化校验枚举值。
- `SkillHealthDialog.tsx`：effect 依赖从 `report` 改为 `report?.skillPath`，避免父组件每次 render 传新对象时丢失展开态。
- a11y：`<select>` 加 `id` + `<label htmlFor>`；`DialogContent` 补 `DialogDescription`；`LifecyclePage` 库选择器加 `aria-label`。
- `radarStore` 的 `saveCachedSummary` / `saveCachedTags` 不再 fire-and-forget，失败 `toast.error`；`__all__` 抽常量 `ALL_DIRS_KEY`。

### Hardening — 小修

- `validation.ts`：`sanitizePath` 改为 `throw`（原实现 `replace(/\.\./g, '')` 是已知坏 sanitizer，被 `....//` 绕过）；`validateFileName` 拒绝 Windows 保留名（`CON`/`PRN`/`NUL`/`COM1-9`/`LPT1-9`）。
- `safeParseJsonRecord` 抽到 `server/utils/json.ts`，`analyticsService` / `feedbackService` 复用。
- `DELETE /api/feedback`（清空全部）现在要求 `?confirm=true`。

### Tests

- 测试数 44 → **87**（12 test files），`npm test` 一键全绿。
- 新增回归测试锁住 v2.1.0 引入的安全不变量：
  - `server/__regression__/pathGuard.integration.test.ts` — supertest 验证 `/api/fresh`、`/api/compare/skills`（A 端 + B 端）、`/api/feedback` 都对越界路径返回 `403`
  - `server/__regression__/cors.test.ts` — 白名单 + dev loopback 正则 + 拒陌生 origin
  - `server/__regression__/sql-params.test.ts` — 静态扫描所有 `db.prepare()`，禁止 `${...}` 模板字符串插值
  - `server/__regression__/backup-no-token.test.ts` — `security.json` 排除谓词在根 / POSIX 嵌套 / Windows 嵌套都生效，且不过匹配
- 扩展 `server/utils/safeUnzip.test.ts`：解压炸弹三类边界（entries / 总量 / 单文件）
- 扩展 `server/middleware/auth.test.ts`：`security.json` 0600 + 父目录 0700 + Bearer 接受 + query token 拒绝
- 新增 `server/services/{compare,feedback,fresh}Service.test.ts` 与 `versionService.test.ts` 扩展（restore 原子性 + UTF-8 中文不被误判二进制）

### Migration Notes

- 升级后首次启动会一次性把 `~/.skills-manager/usage-stats.json` 与 `rubric-cache.json` 导入 SQLite，原文件改名 `.bak-*` 保留。无需手工操作。
- 接入方注意：`/api/fresh/suggestions`、`/api/compare/skills`、`/api/skill-rubric/{evaluate,batch}` 不再接受 body 里的 `baseUrl` / `apiKey` / `modelName`，请改用服务端 `defaultModelId` 配置；前端只发 `includeAI: true`。
- 接入方注意：clear 全部反馈现在要求 `DELETE /api/feedback?confirm=true`。
- 接入方注意：所有 `/api/*` 调用必须带 `X-SM-Token` 或 `Authorization: Bearer`，`?token=` 查询参数不再生效（首次浏览器打开除外）。

---

## [2.1.0] - 2026-05-13

### Security — 关键漏洞修复（P0）

- **API 鉴权**：所有 `/api/*` 端点现在要求 `X-SM-Token` header 或 `?token=` 查询参数。token 在首次启动时自动生成并写入 `~/.skills-manager/security.json`（chmod 0600），CLI 启动时会打印 token 并自动拼到打开浏览器的 URL 中。删除 `security.json` 即可重置。
- **监听地址默认 127.0.0.1**：服务器不再绑定 `0.0.0.0`，避免暴露到局域网。如需自定义请用 `SM_HOST` 环境变量。
- **CORS 收紧**：仅允许 `http://127.0.0.1:{3001,5173,5174}`（及 localhost 等价项）来源；不再使用 `cors()` 默认全开放配置。
- **helmet 安全头**：添加 helmet 中间件提供常见安全响应头。
- **路径白名单**：所有 `/api/skills/*` 文件操作（read/write/rename/delete/folder-contents）现通过 `pathGuard` 中间件校验路径必须在用户配置的 sourceDirs / projects / `~/.skills-manager` 之内。`/etc/passwd` 类越界访问返回 403。
- **扩展上传沙箱化**：`/api/import/extensions/upload` 强制对 `originalname` 调用 `path.basename` + 字符校验，仅允许 `.js` / `.mjs`，写入路径必须在 `~/.skills-manager/extensions/` 之内。multer fileFilter 错误返回 400 而非 500。
- **ZipSlip 防护**：所有 ZIP 解压改走新增的 `safeUnzip` 工具，按 entry 校验解压目标路径不会逃逸 extractDir，covers GitHub/Gitee/GitLab/ClawHub/Bitbucket 仓库下载、ZIP 导入、备份恢复全路径。

### Reliability — 数据完整性

- **版本快照保留二进制文件**：`VersionFile` 新增 `encoding: 'utf-8' | 'base64'` 字段。`createVersion` 自动检测二进制文件并以 base64 存储，`restoreVersion` 按 encoding 还原；diff 视图对二进制文件展示 `binary` 状态。修复了之前回滚后 PNG/字体/zip 被静默丢失的 bug。
- **JSONL → SQLite**：analyticsService 与 feedbackService 改用 `better-sqlite3`（WAL 模式 + 单事务）持久化，消除并发写时的半行 JSON 损坏。启动时自动从旧 `events.jsonl` / `feedback.jsonl` 一次性导入到 `~/.skills-manager/db.sqlite`，旧文件重命名为 `.bak-*` 保留。

### Added

- **数据备份与恢复**：HomePage 新增「导出全量备份」和「从备份恢复」按钮。后端 `POST /api/backup/export` 流式导出 `~/.skills-manager/`（自动排除 `security.json`），`POST /api/backup/import` 通过 safeUnzip 解压并替换数据，恢复前自动备份当前数据为 `~/.skills-manager.bak-*`。
- **ClawHub 检索 Tab 启用**：SkillsRadar 的 ClawHub Tab 不再是 `alert("开发中")`，现支持输入 ClawHub 仓库地址扫描 Skills，并跳转到导入中心完成导入。
- **结构化日志**：新增 `server/utils/logger.ts`（pino + pino-pretty）。开发模式彩色易读，生产 JSON。可通过 `LOG_LEVEL` 环境变量控制级别。

### Changed

- 启动顺序：ensureToken → migrateLegacyJsonl → loadExtensions → listen。
- CLI 启动信息现在会显示访问令牌和带 token 的 URL，便于复制。
- `server/cli.ts` 的浏览器打开命令从 `exec(\`open "${url}"\`)` 改为 `spawn` + 数组参数，规避未来潜在的命令注入。

### Tests

- 新增 `vitest` 测试框架，44 个测试覆盖：
  - `server/utils/validation.test.ts` — 路径校验各种 traversal payload
  - `server/utils/safeUnzip.test.ts` — ZipSlip 防护核心判断 + 端到端解压
  - `server/middleware/auth.test.ts` — 鉴权中间件豁免 / 401 / 正确 token 路径
  - `server/services/versionService.test.ts` — 含 PNG 的 Skill 回滚 / 二进制 diff
  - `server/services/analyticsService.test.ts` — 100 并发写 + 元数据完整性
- `npm test` 一键运行。

### Migration Notes

- 升级后首次启动会创建 `~/.skills-manager/security.json` 并显示 token；如果脚本化对接 API，请在所有请求加 `X-SM-Token` header。
- 旧 JSONL 数据会自动迁移到 SQLite，原文件保留为 `.bak-*`。无需手工操作。
- 如需远程访问（不推荐），设置 `SM_HOST=0.0.0.0` 并通过反向代理 + token 鉴权使用。

---

## [2.0.0] - 2026-04-28

### Added — Skill Harness 平台完整闭环（v1.5 ~ v2.0，8 大模块）

#### v1.5 — Rubric 评测体系 + 评测改进循环

##### 模块 1：Rubric 四维评测引擎

- **结构化评测**：四维度加权评分系统（L1 结构完整性 × 0.30 / L2 描述质量 × 0.30 / L3 内容深度 × 0.25 / L4 安全规范 × 0.15），输出 0-100 分 + A/B/C/D/F 等级
- **AI 评估集成**：description 质量评估、内容深度评估（可选调用 LLM）
- **自定义 Rubric 模板**：支持团队定义自己的评测标准，存储到 `~/.skills-manager/rubric-templates/`
- **UI 升级**：健康度弹框从单一评分卡改为四维雷达图 + 逐项 Rubric 报告
- **新增 API**：`POST /api/skill-rubric/evaluate`、`POST /api/skill-rubric/batch`、`GET /api/skill-rubric/templates`、`PUT /api/skill-rubric/templates`
- **新增文件**：`server/services/rubricService.ts`、`server/routes/skill-rubric.ts`

##### 模块 2：评测-改进循环（Eval Loop）

- **自动化循环**：Rubric 评测 → AI 分析薄弱维度 → AI 生成优化版本 → 自动创建版本快照 → 再评测
- **退出条件自适应**：达到目标分 / 达到最大轮次 / 连续两轮提升 < 2 分
- **SSE 实时进度**：前端实时展示当前轮次、评分变化、改进内容
- **评分趋势图**：折线图展示每轮评分变化
- **历史持久化**：存储到 `~/.skills-manager/eval-loop-history.json`
- **新增 API**：`POST /api/eval-loop/start`（SSE）、`POST /api/eval-loop/stop`、`GET /api/eval-loop/history`、`GET /api/eval-loop/active`
- **新增文件**：`server/services/evalLoopService.ts`、`server/routes/eval-loop.ts`、`src/components/skills/EvalLoopPanel.tsx`

#### v1.6 — 场景匹配增强 + 质量排名

##### 模块 3：智能推荐排名

- **综合排名算法**：语义匹配度 × 0.6 + Rubric 质量分 × 0.3 + 使用热度 × 0.1
- **质量分徽章**：搜索结果卡片展示 A/B/C/D/F 等级徽章和使用频次
- **等级筛选器**：按质量等级筛选搜索结果
- **修改文件**：`server/services/radarService.ts`、`src/pages/SkillsRadarPage.tsx`

##### 模块 4：Skill 对比评测

- **并排对比**：选择两个 Skill 进行 Rubric 对比评测
- **可视化对比**：并排雷达图 + 内容 Diff + 触发率对比
- **新增文件**：`server/services/compareService.ts`、`src/components/skills/SkillComparePanel.tsx`

#### v1.7 — 使用记忆 + 自动保鲜

##### 模块 5：使用反馈采集

- **反馈类型**：有效 / 无效 / 部分有效 / 建议四种反馈类型
- **JSONL 存储**：`~/.skills-manager/feedback.jsonl`，高性能追加写入
- **快捷反馈**：Skills 库文件树右键菜单一键提交反馈
- **反馈统计**：使用分析页新增 FeedbackStatsCard 组件（总反馈数、有效率、Top 5 排行）
- **新增 API**：`POST /api/feedback`、`GET /api/feedback`、`GET /api/feedback/stats`、`DELETE /api/feedback/:id`、`DELETE /api/feedback`
- **新增文件**：`server/services/feedbackService.ts`、`server/routes/feedback.ts`

##### 模块 6：自动保鲜机制

- **四维检测**：URL 有效性（HEAD 请求）、引用路径存在性、反馈趋势分析、最后修改时间（90 天阈值）
- **保鲜等级**：fresh（绿）/ stale（黄）/ expired（红），文件树保鲜度指示器圆点
- **AI 保鲜建议**：分析过期内容并生成具体改进建议
- **自动批量检测**：页面加载后自动获取保鲜度数据，localStorage 缓存
- **新增 API**：`POST /api/fresh/check`、`POST /api/fresh/batch`、`POST /api/fresh/suggestions`
- **新增文件**：`server/services/freshService.ts`、`server/routes/fresh.ts`

#### v2.0 — Skill Harness 完整闭环

##### 模块 7：生命周期看板

- **6 阶段看板**：草稿 → 评测中 → 已发布 → 使用中 → 待优化 → 已归档
- **智能推断**：根据质量分、反馈数据、保鲜度自动推断 Skill 所处阶段
- **数据聚合**：每个 Skill 卡片展示质量分徽章 + 反馈数 + 保鲜度指示器
- **阶段切换**：下拉菜单切换阶段，localStorage 持久化用户覆盖
- **新增文件**：`src/pages/LifecyclePage.tsx`
- **修改文件**：`src/components/layout/Sidebar.tsx`（新增导航项）、`src/App.tsx`（注册路由）

##### 模块 8：创建流程增强（品质锚定）

- **品质定位**：AI 生成 Skill 时选择品质定位（MVP ≥60 / 精打磨 ≥75 / 生产级 ≥90）
- **品质注入**：品质定位信息注入 AI 系统提示，影响生成内容的深度和完整度
- **自动评测**：生成后自动触发 Rubric 评测，对比目标分并 toast 提示结果
- **修改文件**：`src/components/skills/AISkillGenerator.tsx`

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

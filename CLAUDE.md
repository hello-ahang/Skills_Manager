# Skills_Manager — AI 协作守则

> 写给下次进来的 AI（人类直接看 [README.md](README.md)）。本文件只列**违反就会让代码出错**的硬规则，详细机制都在 docs / 代码里。

## 项目一句话

Vite + React 18 前端 / Express + tsx 后端 / better-sqlite3 + JSON 混合存储的 **Skills 统一管理平台**。当前版本 v2.1.1，安全加固完成（pathGuard 真挂载 + SSRF 关闭 + 速率限制 + 解压炸弹防御）。

主要部署形态：开发者本机 `127.0.0.1:3001`，全部 `/api/*` 强制鉴权。

## 命令速查

```bash
sm                    # 启动（npm run dev 等价）
sm-stop               # 停止 + 清端口
npm test              # vitest 全跑（87 tests, 12 files）
npm run build         # 生产构建

npx tsc -p tsconfig.server.json --noEmit   # 后端类型检查
npx tsc -p tsconfig.app.json    --noEmit   # 前端类型检查
npx vitest run server/path/to/file.test.ts  # 跑单个测试
```

提交前最低守门：上面的 server tsc + vitest 都必须 0 错 / 全绿。

## 关键路径

```
server/index.ts                 # 中间件链：helmet → cors → json(1mb) → auth → pathGuard → rateLimit → routers
server/middleware/{auth,pathGuard,rateLimit}.ts
server/db/sqlite.ts             # better-sqlite3 单例 + ensureSchema + JSONL 迁移
server/services/configService.ts   # getConfig() / getDefaultModelConfig()
server/utils/safeUnzip.ts       # ZipSlip + 炸弹防护
src/api/client.ts               # 前端 API 封装（compareApi / lifecycleApi / skillRubricApi 等）
~/.skills-manager/              # 用户数据：security.json / db.sqlite / user-config.json / extensions/ / rubric-templates/
```

## 红线（违反 = 安全/正确性事故）

1. **新增接受路径的路由字段**：字段名（`path` / `skillPath` / 自定义）必须加进 `server/middleware/pathGuard.ts:PATH_FIELDS`。否则路径穿越校验会被跳过。
2. **服务端永不接受 body 里的 `baseUrl` / `apiKey` / `modelName`**：所有需要调 LLM 的端点必须 `getDefaultModelConfig()` 从 user-config 读。前端只发 `includeAI: true`。这是 SSRF + Authorization header 外泄的封堵线。
3. **token 仅 header**：`X-SM-Token` 或 `Authorization: Bearer`，绝不读 `req.query.token`（query 会进 access log 和 Referer）。`server/middleware/auth.ts` 已强制；新增鉴权相关路径不要绕开。
4. **`db.prepare()` 不准用模板字符串插值**：`db.prepare(\`SELECT ... WHERE x = ${x}\`)` 是 SQL 注入。永远 `db.prepare('SELECT ... WHERE x = ?').run(x)`。`server/__regression__/sql-params.test.ts` 静态扫描会在 CI 抓住这个。
5. **`db.prepare()` 写入禁用 RMW**：并发场景下 read-modify-write 会丢更新。用 `INSERT ... ON CONFLICT DO UPDATE`（参考 `radarService.ts:incrementUsage`）。
6. **目录级别破坏性操作必须原子化**：先写 tmp dir，再 `fs.rename` 原目录到 `.old-*`，再 `fs.rename` tmp 到位，失败回滚。`versionService.restoreVersion` 是范例。
7. **不准 `console.log` / `console.error`**：用 `import { log } from './utils/logger.js'`（pino）。生产模式日志要可解析。
8. **不准新增 `any` 类型**：app 代码里 `any` 数量已经在收口（`src/api/client.ts` 是历史遗留，新增代码必须显式类型）。

## 提交流程

- **测试纪律**：写新代码必须自己补单测覆盖刚改的路径；修 bug 必须留 regression test。回归测试统一放 `server/__regression__/`，单元测试和 service 同目录。
- **commit 前**：跑 `npx tsc -p tsconfig.server.json --noEmit` + `npx vitest run`。两者 0 错才提。
- **文件大小**：文件 < 800 行（`SkillsPage.tsx` / `AISkillGenerator.tsx` 已超且在 TODO 上，新增前先看下文「Tech debt」）。
- **不动 `package-lock.json` 之外的 npm 操作除非用户要求**：本仓没用 pnpm/yarn。
- **远端**：`github`（公开 hello-ahang/Skills_Manager）+ `origin`（gitlab 内仓 wyj234673/Skills_Manager）。`git push` 默认推 `github`，`git push origin develop` 推内仓。两边都要推。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `SM_HOST` | `127.0.0.1` | 监听地址；改 `0.0.0.0` 必须配 token 鉴权 |
| `SM_AUTH_DISABLE` | 未设 | 设为 `1` 才禁用鉴权，**且**必须 `SM_HOST` 是 loopback |
| `SM_DB_PATH` | `~/.skills-manager/db.sqlite` | SQLite 文件位置（测试用） |
| `SM_PKG_ROOT` | `process.cwd()` | npm 全局安装时由 `cli.ts` 设置 |
| `LOG_LEVEL` | `info` | pino 级别 |
| `NODE_ENV` | `development` | `production` 启用静态文件服务 |

## 深入文档

| 想知道 | 看哪 |
|---|---|
| 怎么接入这个服务 / 鉴权 / 速率限制 / API 列表 | [README.md](README.md) |
| 安全模型 / pathGuard / 备份机制 | [README.md](README.md) §安全与运维 |
| 自定义 Rubric 模板格式 | [README.md](README.md) §自定义 Rubric 模板 |
| 历次版本变更 | [CHANGELOG.md](CHANGELOG.md) |
| 写扩展 provider | [extensions-guide/provider-guide.md](extensions-guide/provider-guide.md) |
| 编码规约 | [docs/spec_coding.md](docs/spec_coding.md) |
| 后续路线图 | [docs/future-features-plan.md](docs/future-features-plan.md) |

## Tech debt（已知，但本次会话没动）

- `src/pages/SkillsPage.tsx`（1080 行）、`src/components/skills/AISkillGenerator.tsx`（930 行）超 800 行 cap，需要拆分。`SkillsRadarPage.tsx` 已拆到 513 行，`skillCardService.ts` 已拆到 523 行（模板抽到 `skillCardTemplate.ts`）。
- `src/api/client.ts` 仍有 ~25 处 `any`（review 报告 H13），新增代码请显式类型。
- `tsconfig.app.json` 的 `"ignoreDeprecations": "6.0"` 在 tsc 5.9 报警但不阻塞构建（exit 0）；升级 tsc 6.x 后改回。
- **safeUnzip race（已知,跟踪中）**：`server/utils/safeUnzip.ts` 的 `'close'` 事件可能在 `fs.ensureDir.then(...)` 还在 microtask 队列时触发，导致 `'single entry exceeds limit'` 类的 fail() 抢不过 resolve()，promise 提前 resolve 为 `{written:0,skipped:[]}`。表现为 `safeUnzip.test.ts` 的「single entry exceeds limit」测试在 vitest 默认 worker 并发模式下间歇失败,`vitest run --no-file-parallelism` 稳定通过。临时缓解：CI 用串行模式跑测试；根因修复：在 `safeUnzipFromStream` 加 in-flight write counter,所有 writer `finish` 之前不让 'close' resolve。

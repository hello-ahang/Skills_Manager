# Provider 注册与扩展加载 — 用户指南

> 本文档面向 Skills Manager 用户，介绍如何通过扩展机制添加自定义导入源和发布目标。如需了解完整的 API 参考，请查看 [extensions.md](./extensions.md)。

---

## 什么是 Provider 注册模式？

Skills Manager 内置了 GitHub、ClawHub、本地文件等多种导入方式。但在某些场景下，你可能需要：

- 从公司内部的 Git 平台导入 Skills
- 从内部 Skills 商店/市场下载 Skills
- 将 Skills 发布到云端 AI 智能体平台（如悟空）

**Provider 注册模式**允许你通过放置一个简单的 `.js` 扩展文件来注册这些自定义能力，**完全不需要修改 Skills Manager 的源代码**。

### 与传统方式的区别

| 方式 | 修改源码 | 维护成本 | 适用场景 |
|------|---------|---------|---------|
| 硬编码 | 需要 fork 并修改 | 每次升级需合并 | 不推荐 |
| **Provider 注册模式** | **不需要** | **零额外成本** | **推荐** |

---

## 扩展文件放在哪里？

Skills Manager 启动时会自动扫描以下两个目录中的 `.js` / `.mjs` 文件：

| 目录 | 说明 | 优先级 |
|------|------|--------|
| `~/.skills-manager/extensions/` | 用户级扩展，对所有项目生效 | 先加载 |
| `{Skills Manager 项目根}/extensions/` | 项目级扩展 | 后加载 |

> **推荐**：将扩展文件放在 `~/.skills-manager/extensions/` 目录下，这样不会影响开源仓库。

---

## 如何创建一个导入扩展

### 第 1 步：创建扩展目录

```bash
mkdir -p ~/.skills-manager/extensions
```

### 第 2 步：编写扩展文件

创建文件 `~/.skills-manager/extensions/my-import-provider.js`：

```javascript
/**
 * 自定义导入源扩展示例
 * 
 * 每个扩展文件必须导出一个 setup(context) 函数。
 * context 提供了 registerImportProvider 和 registerPublishTarget 两个注册方法。
 */
export function setup(context) {
  context.registerImportProvider({
    // 唯一标识符
    id: 'my-source',
    
    // 在导入中心左侧导航中显示的名称
    name: 'My Source',
    
    // 图标名称（使用 Lucide React 图标库）
    // 常用图标：Github, GitBranch, Package, Store, Cloud, Building, Globe
    icon: 'Package',
    
    // 分组：必须设为 'custom'，会在导入中心的"扩展"分区中显示
    group: 'custom',
    
    // 是否需要认证（可选）
    requiresAuth: true,
    
    // 认证配置字段（可选，用于在设置页面生成表单）
    authFields: [
      { key: 'token', label: 'Access Token', type: 'password', placeholder: '输入你的访问令牌' },
    ],
    
    // 扫描函数：解析用户输入，返回可导入的 Skills 列表
    async scan(input, options) {
      // input: 用户在输入框中填写的 URL 或关键词
      // options: 包含认证信息等，如 { token: '...' }
      
      const response = await fetch(`https://my-api.example.com/skills?q=${encodeURIComponent(input)}`, {
        headers: { 'Authorization': `Bearer ${options?.token}` },
      });
      const data = await response.json();
      
      return {
        skills: data.items.map(item => ({
          name: item.name,
          path: item.downloadUrl,
          description: item.description,
          fileCount: item.fileCount || 1,
          totalSize: item.size || 0,
          isValid: true,
          files: [],
          selected: true,
        })),
      };
    },
    
    // URL 匹配函数（可选）：判断一个 URL 是否属于此导入源
    matchUrl(url) {
      return url.includes('my-api.example.com');
    },
  });
}
```

### 第 3 步：重启 Skills Manager

```bash
# 如果使用 npm 全局安装
ahang-skills-manager

# 如果使用源码安装
sm
```

启动时你会在终端看到加载日志：

```
[Extensions] Loaded: my-import-provider.js
[Extensions] 1 extension(s) loaded successfully
```

### 第 4 步：验证

打开导入中心，在左侧导航的"扩展"分区中应该能看到你注册的导入源。点击它，输入 URL 或关键词，点击扫描即可。

---

## 如何创建一个发布扩展

发布扩展允许你将 Skills 发布到外部平台（如云端 AI 智能体平台）。

### 示例：发布到云端平台

创建文件 `~/.skills-manager/extensions/my-publish-target.js`：

```javascript
import fs from 'fs';
import path from 'path';

export function setup(context) {
  context.registerPublishTarget({
    // 唯一标识符
    id: 'my-platform',
    
    // 显示名称
    name: 'My AI Platform',
    
    // 图标
    icon: 'Cloud',
    
    // 分组
    group: 'custom',
    
    // 描述
    description: '发布 Skills 到 My AI Platform（需要审核）',
    
    // 认证配置
    requiresAuth: true,
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password' },
    ],
    
    // 发布函数
    async publish(skillPath, options) {
      // skillPath: Skill 目录的绝对路径
      // options: { targetId, authToken, metadata, ... }
      
      // 1. 读取 SKILL.md 内容
      const skillMd = fs.readFileSync(path.join(skillPath, 'SKILL.md'), 'utf-8');
      
      // 2. 转换格式（根据目标平台要求）
      const payload = {
        name: path.basename(skillPath),
        content: skillMd,
        // ... 其他字段
      };
      
      // 3. 调用平台 API 上传
      const response = await fetch('https://my-platform.example.com/api/skills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${options.authToken}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      
      return {
        success: true,
        publishId: result.id,
        status: 'pending_review',  // 'published' | 'pending_review' | 'failed'
        message: '已提交审核，预计 1-2 个工作日内完成',
        url: `https://my-platform.example.com/skills/${result.id}`,
      };
    },
    
    // 查询审核状态（可选）
    async getStatus(publishId) {
      const response = await fetch(`https://my-platform.example.com/api/skills/${publishId}/status`);
      const data = await response.json();
      return {
        publishId,
        status: data.status,  // 'pending_review' | 'approved' | 'rejected'
        reviewComment: data.comment,
        updatedAt: data.updatedAt,
      };
    },
  });
}
```

发布扩展注册后，在 Skills 库的文件树中右键点击 Skill 目录，选择"发布到..."即可看到你注册的发布目标。

---

## 扩展文件格式要求

| 要求 | 说明 |
|------|------|
| 文件格式 | `.js` 或 `.mjs` |
| 模块类型 | ES Module（使用 `export function`） |
| 必须导出 | `setup(context)` 函数 |
| context 可用方法 | `registerImportProvider(provider)` 和 `registerPublishTarget(target)` |

### 可用的 Node.js 模块

扩展文件可以使用 Node.js 内置模块：

```javascript
import fs from 'fs';
import path from 'path';
import os from 'os';
// 也可以使用全局的 fetch API
```

---

## 验证扩展是否加载成功

### 方法 1：查看终端日志

启动 Skills Manager 后，终端会输出扩展加载信息：

```
[Extensions] Scanning: /Users/yourname/.skills-manager/extensions/
[Extensions] Loaded: my-import-provider.js
[Extensions] Loaded: my-publish-target.js
[Extensions] 2 extension(s) loaded successfully
```

### 方法 2：检查导入中心

打开导入中心，左侧导航底部的"扩展"分区应显示你注册的导入源。

### 方法 3：调用 API

```bash
# 查看已注册的导入 Provider
curl http://localhost:3001/api/import/providers

# 查看已注册的发布目标
curl http://localhost:3001/api/publish/targets
```

---

## 常见问题

### 扩展文件放了但没有生效？

1. **确认文件位置**：文件必须放在 `~/.skills-manager/extensions/` 目录下
2. **确认文件后缀**：必须是 `.js` 或 `.mjs`
3. **确认导出函数**：文件必须导出 `setup` 函数（`export function setup(context) { ... }`）
4. **重启服务**：扩展在启动时加载，修改后需要重启 Skills Manager

### 图标不显示？

扩展使用 [Lucide React](https://lucide.dev/icons/) 图标库。常用图标名称：

| 场景 | 推荐图标 |
|------|---------|
| Git 平台 | `Github`, `GitBranch`, `GitMerge` |
| 商店/市场 | `Store`, `Package`, `ShoppingBag` |
| 云端平台 | `Cloud`, `CloudUpload`, `Upload` |
| 企业/内部 | `Building`, `Building2` |
| 通用扩展 | `Puzzle`, `Blocks` |

如果指定的图标名称不在映射表中，会显示默认的 `Puzzle` 图标。

### 认证信息存储在哪里？

通过 `authFields` 配置的认证信息存储在 `~/.skills-manager/user-config.json` 中，不会随代码提交到 Git。

### 一个扩展文件可以注册多个 Provider 吗？

可以。在 `setup` 函数中多次调用 `context.registerImportProvider()` 和 `context.registerPublishTarget()` 即可。

---

## 内置扩展示例

Skills Manager 在 `~/.skills-manager/extensions/` 目录下提供了三个示例扩展文件模板：

| 文件 | 说明 |
|------|------|
| `internal-git-provider.js` | 内部 Git 平台导入扩展 |
| `internal-store-provider.js` | 内部 Skills 商店导入扩展 |
| `wukong-publish-target.js` | 悟空智能体平台发布扩展 |

这些文件中标注了 `TODO` 的部分需要替换为实际的 API 地址和认证逻辑。

此外，`docs/aone-provider.js` 是一个完整的实战扩展示例，可作为开发参考。

---

## scan 返回值详解

`scan(input, options)` 函数是导入扩展的核心，它接收用户输入和认证选项，返回扫描结果。

### 返回值结构

```javascript
return {
  // 必须：扫描到的 Skills 列表
  skills: [
    {
      name: 'my-skill',           // Skill 名称（显示在预览列表中）
      path: '/tmp/extracted/my-skill',  // Skill 文件所在的本地路径
      description: 'A useful skill',    // 可选：描述
      fileCount: 5,               // 文件数量
      totalSize: 12345,           // 总大小（字节）
      isValid: true,              // 是否有效（包含 SKILL.md）
      files: [                    // 文件列表
        { relativePath: 'SKILL.md', size: 1024 },
        { relativePath: 'README.md', size: 512 },
      ],
      selected: true,             // 默认是否选中
    },
  ],

  // 可选但推荐：仓库/来源信息
  repoInfo: {
    name: '@scope/skill-name',    // 来源名称
    description: 'Skill description',  // 来源描述
    defaultBranch: 'main',        // 默认分支（Git 来源）或 'latest'
    url: 'https://example.com/skill/xxx',  // 来源 URL
    version: '1.0.0',            // 当前版本号（关键！）
  },
};
```

### repoInfo.version 与订阅系统的联动

当 `scan` 返回的 `repoInfo` 中包含 `version` 字段时，Skills Manager 会自动：

1. **导入时记录版本号**：导入历史中显示版本号 badge（如 `v1.0.0`）
2. **订阅时保存版本号**：用户点击"订阅"后，版本号写入 `subscriptions.json`
3. **Skills 库显示版本号**：文件树中对应的 Skill 目录旁显示版本号标签
4. **更新检测**：后续检查更新时，对比 `version` 和 `latestVersion` 判断是否有新版本

> **建议**：如果你的导入源支持版本管理，务必在 `repoInfo` 中返回 `version` 字段，这样用户可以享受完整的版本追踪和订阅更新体验。

---

## 认证机制详解

### authFields 完整链路

扩展插件通过 `authFields` 声明需要的认证字段，Skills Manager 会自动处理整个认证流程：

```
扩展声明 authFields → 前端渲染输入框 → 用户填写并保存 → localStorage 存储 → 扫描时传入 options
```

#### 第 1 步：扩展声明认证字段

```javascript
context.registerImportProvider({
  id: 'my-source',
  name: 'My Source',
  requiresAuth: true,
  authFields: [
    {
      key: 'token',        // 字段标识（传入 options 时的 key）
      label: 'Access Token',  // 显示标签
      type: 'password',    // 输入类型：'text' 或 'password'
      placeholder: '输入你的访问令牌',  // 占位文本
    },
    {
      key: 'cookie',
      label: 'Cookie',
      type: 'password',
      placeholder: '从浏览器复制 Cookie',
    },
  ],
  // ...
});
```

#### 第 2 步：前端自动渲染

Skills Manager 会在两个地方自动渲染认证输入框：

1. **导入中心**：选择该扩展导入源时，输入框显示在扫描按钮上方
2. **设置页面**：在"扩展认证配置"区域，集中管理所有扩展的认证信息

#### 第 3 步：存储机制

认证信息存储在浏览器的 `localStorage` 中：

```
Key:   ext-auth-{provider.id}
Value: {"token": "xxx", "cookie": "yyy"}
```

- 数据仅存储在用户本地浏览器中，不会上传到服务器
- 不会随代码提交到 Git
- 用户可以在设置页面随时修改和保存

#### 第 4 步：扫描时传入

当用户点击"扫描"时，前端会从 `localStorage` 读取认证信息，作为 `options` 参数传入 `scan` 函数：

```javascript
async scan(input, options) {
  // options 包含 authFields 中声明的所有字段
  const token = options?.token;
  const cookie = options?.cookie;

  if (!token) {
    throw new Error('请先配置 Access Token');
  }

  // 使用认证信息调用 API
  const response = await fetch('https://api.example.com/skills', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  // ...
}
```

---

## URL 自动检测

### matchUrl 的作用

`matchUrl(url)` 是一个可选函数，用于判断一个 URL 是否属于该导入源。当用户在导入中心的"智能输入框"中粘贴 URL 时，Skills Manager 会遍历所有已注册的 Provider，调用 `matchUrl` 找到匹配的 Provider 并自动切换。

```javascript
context.registerImportProvider({
  id: 'my-source',
  // ...

  matchUrl(url) {
    // 返回 true 表示该 URL 属于此导入源
    return url.includes('my-platform.example.com/skill/');
  },
});
```

### 自动检测流程

```
用户粘贴 URL → 前端调用 POST /api/import/scan/auto-detect
             → 后端遍历所有 Provider 的 matchUrl()
             → 找到匹配的 Provider
             → 自动调用该 Provider 的 scan()
             → 返回扫描结果 + providerId
```

### 最佳实践

1. **精确匹配**：`matchUrl` 应该尽可能精确，避免误匹配其他来源的 URL
2. **域名匹配**：通常检查 URL 中是否包含特定域名即可
3. **路径匹配**：如果同一域名下有多种资源，可以进一步检查路径

```javascript
// 好的示例：精确匹配域名 + 路径
matchUrl(url) {
  return url.includes('open.aone.alibaba-inc.com/skill/');
}

// 不好的示例：过于宽泛
matchUrl(url) {
  return url.includes('alibaba');  // 可能误匹配其他阿里巴巴服务
}
```

---

## 完整实战示例

以下是一个真实的导入扩展插件的核心结构（以 Aone 开放平台为例），展示了完整的下载、解压、扫描流程：

```javascript
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';

const TEMP_DIR = path.join(os.tmpdir(), 'skills-manager-import');

export function setup(context) {
  context.registerImportProvider({
    id: 'my-platform',
    name: 'My Platform',
    icon: 'Package',
    group: 'custom',
    requiresAuth: true,
    authFields: [
      { key: 'token', label: 'API Token', type: 'password', placeholder: '输入 API Token' },
    ],

    async scan(input, options) {
      const token = options?.token;
      if (!token) {
        throw new Error('请先配置 API Token。');
      }

      // 1. 解析用户输入（URL 或关键词）
      const skillName = parseInput(input);

      // 2. 调用平台 API 获取元数据
      const metadata = await fetch(`https://api.example.com/skills/${skillName}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(r => r.json());

      // 3. 下载 ZIP 到临时目录
      const tempDir = path.join(TEMP_DIR, `my-platform-${Date.now()}`);
      await fsp.mkdir(tempDir, { recursive: true });

      const zipResponse = await fetch(metadata.downloadUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
      const zipPath = path.join(tempDir, 'archive.zip');
      await fsp.writeFile(zipPath, zipBuffer);

      // 4. 解压 ZIP
      const { execSync } = await import('child_process');
      execSync(`unzip -o "${zipPath}" -d "${tempDir}"`, { stdio: 'ignore' });

      // 5. 扫描解压后的目录，查找包含 SKILL.md 的子目录
      const skills = await scanForSkills(tempDir);

      if (skills.length === 0) {
        // 清理临时目录
        await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        throw new Error(`未找到有效的 Skill。`);
      }

      // 6. 返回扫描结果（包含 repoInfo 以支持版本追踪）
      return {
        skills,
        repoInfo: {
          name: metadata.name,
          description: metadata.description,
          defaultBranch: 'latest',
          url: `https://example.com/skill/${skillName}`,
          version: metadata.latestVersion,  // 关键：返回版本号
        },
      };
    },

    matchUrl(url) {
      return url.includes('example.com/skill/');
    },
  });
}

// 辅助函数：扫描目录中的 Skills
async function scanForSkills(dir) {
  const skills = [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

    const skillDir = path.join(dir, entry.name);
    const skillMdPath = path.join(skillDir, 'SKILL.md');

    try {
      await fsp.access(skillMdPath);
    } catch {
      continue;  // 没有 SKILL.md，跳过
    }

    // 读取 SKILL.md 提取名称和描述
    const content = await fsp.readFile(skillMdPath, 'utf-8');
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const descMatch = content.match(/^description:\s*(.+)$/m);

    // 统计文件
    let fileCount = 0;
    let totalSize = 0;
    const files = [];

    async function walk(d) {
      const items = await fsp.readdir(d, { withFileTypes: true });
      for (const item of items) {
        if (item.name.startsWith('.')) continue;
        const fullPath = path.join(d, item.name);
        if (item.isDirectory()) {
          await walk(fullPath);
        } else {
          const stat = await fsp.stat(fullPath);
          fileCount++;
          totalSize += stat.size;
          files.push({ relativePath: path.relative(skillDir, fullPath), size: stat.size });
        }
      }
    }
    await walk(skillDir);

    skills.push({
      name: nameMatch ? nameMatch[1].trim() : entry.name,
      path: skillDir,
      description: descMatch ? descMatch[1].trim() : undefined,
      fileCount,
      totalSize,
      isValid: true,
      files,
      selected: true,
    });
  }

  return skills;
}
```

> 完整的 Aone 开放平台扩展源码见 `docs/aone-provider.js`，包含 URL 解析、Cookie 认证、下载凭证获取、ZIP 解压等完整实现。

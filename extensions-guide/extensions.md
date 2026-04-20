# Skills Manager Extensions Guide

## Overview

Skills Manager supports a lightweight extension mechanism that allows you to register additional **Import Providers** and **Publish Targets** without modifying the core codebase. This is ideal for:

- Adding company-internal skill sources (private Git platforms, internal skill stores)
- Integrating with cloud-based AI agent platforms (e.g., Wukong)
- Supporting custom import/publish workflows

## Extension File Location

Extensions are loaded from two directories (in order):

1. **User-level**: `~/.skills-manager/extensions/` — personal extensions
2. **Project-level**: `{project-root}/extensions/` — project-specific extensions

Each extension is a `.js` or `.mjs` file that exports a `setup(context)` function.

## Quick Start

### 1. Create an Extension File

Create a file at `~/.skills-manager/extensions/my-provider.js`:

```javascript
export function setup(context) {
  // Register a custom import provider
  context.registerImportProvider({
    id: 'my-internal-store',
    name: 'Internal Skill Store',
    icon: 'Store',
    group: 'custom',
    requiresAuth: true,
    authFields: [
      { key: 'token', label: 'Access Token', type: 'password', placeholder: 'Your API token' },
    ],

    async scan(input, options) {
      // input: URL or search query from user
      // options: { token: '...', branch: '...', ... }
      
      // Call your internal API to search/list skills
      const response = await fetch(`https://internal-store.example.com/api/skills/search?q=${input}`, {
        headers: { 'Authorization': `Bearer ${options?.token}` },
      });
      const data = await response.json();

      return {
        skills: data.skills.map(s => ({
          name: s.name,
          path: s.downloadUrl,
          description: s.description,
          fileCount: s.fileCount || 1,
          totalSize: s.size || 0,
          isValid: true,
          files: [],
          selected: true,
        })),
        repoInfo: {
          name: 'Internal Store',
          defaultBranch: 'latest',
          url: 'https://internal-store.example.com',
        },
      };
    },

    matchUrl(url) {
      return url.includes('internal-store.example.com');
    },
  });

  // Register a custom publish target
  context.registerPublishTarget({
    id: 'my-agent-platform',
    name: 'My Agent Platform',
    icon: 'Cloud',
    group: 'custom',
    description: 'Publish skills to My Agent Platform (requires review)',
    requiresAuth: true,
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password' },
      { key: 'appId', label: 'App ID', type: 'text', placeholder: 'Target app ID' },
    ],

    async publish(skillPath, options) {
      // Read skill content, convert format, upload via API
      // Return publish result
      return {
        success: true,
        publishId: 'pub_12345',
        status: 'pending_review',
        message: 'Skill submitted for review',
        url: 'https://my-platform.example.com/skills/pub_12345',
      };
    },

    async getStatus(publishId) {
      // Query review status from platform API
      return {
        publishId,
        status: 'pending_review',
        updatedAt: new Date().toISOString(),
      };
    },

    async listPublished() {
      // List all published skills
      return [];
    },
  });
}
```

### 2. Restart Skills Manager

After placing the extension file, restart Skills Manager. You should see:

```
[Extensions] Loaded: my-provider.js
[Extensions] 1 extension(s) loaded successfully
```

The new import provider will appear in the Import Center under the "Extensions" section, and the publish target will be available in the "Publish to..." menu.

## API Reference

### `context.registerImportProvider(provider)`

Register a custom import provider.

#### Provider Interface

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier (e.g., `'internal-git'`) |
| `name` | `string` | Yes | Display name |
| `icon` | `string` | Yes | Lucide icon name (e.g., `'Github'`, `'Store'`, `'Cloud'`) |
| `group` | `'builtin' \| 'custom'` | Yes | Always use `'custom'` for extensions |
| `requiresAuth` | `boolean` | No | Whether authentication is needed |
| `authFields` | `AuthField[]` | No | Auth config fields for settings UI |
| `scan` | `Function` | Yes | Scan function (see below) |
| `matchUrl` | `Function` | No | URL auto-detection function |

#### `scan(input, options)` Function

- **input** (`string`): URL, path, or search query from user
- **options** (`Record<string, string>`): Additional options including auth tokens
- **Returns**: `Promise<{ skills: ScannedSkill[], repoInfo?: RepoInfo }>`

#### ScannedSkill Object

```typescript
{
  name: string;          // Skill directory name
  path: string;          // Source path (for download)
  description?: string;  // Short description
  fileCount: number;     // Number of files
  totalSize: number;     // Total size in bytes
  isValid: boolean;      // Has valid SKILL.md
  files: { relativePath: string; size: number }[];
  selected?: boolean;    // Pre-selected for import
}
```

### `context.registerPublishTarget(target)`

Register a custom publish target.

#### PublishTarget Interface

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier |
| `name` | `string` | Yes | Display name |
| `icon` | `string` | Yes | Lucide icon name |
| `group` | `'builtin' \| 'custom'` | Yes | Always use `'custom'` |
| `description` | `string` | Yes | Short description |
| `requiresAuth` | `boolean` | No | Whether authentication is needed |
| `authFields` | `AuthField[]` | No | Auth config fields |
| `publish` | `Function` | Yes | Publish function |
| `getStatus` | `Function` | No | Status query function (for review-based platforms) |
| `listPublished` | `Function` | No | List published skills |

#### `publish(skillPath, options)` Function

- **skillPath** (`string`): Absolute path to the skill directory
- **options** (`PublishOptions`): `{ targetId, authToken?, metadata?, ... }`
- **Returns**: `Promise<PublishResult>`

#### PublishResult Object

```typescript
{
  success: boolean;
  publishId?: string;      // For tracking review status
  status: 'published' | 'pending_review' | 'failed';
  message: string;
  url?: string;            // Link to published skill
}
```

## Available Icons

Extensions can use any [Lucide React](https://lucide.dev/icons/) icon name. Common choices:

- `Github`, `GitBranch`, `GitMerge` — Git platforms
- `Store`, `Package`, `ShoppingBag` — Marketplaces
- `Cloud`, `CloudUpload`, `Upload` — Cloud platforms
- `Building`, `Building2` — Enterprise/internal
- `Puzzle`, `Blocks` — Generic extensions
- `Globe`, `Link` — Web-based sources

## Tips

- Extensions are loaded once at server startup. Changes require a restart.
- Use `group: 'custom'` to visually separate your providers from built-in ones.
- Auth tokens configured via `authFields` are stored in `~/.skills-manager/user-config.json`.
- For error handling, throw errors with descriptive messages — they will be shown to the user.
- Extension files can import Node.js built-in modules (`fs`, `path`, `os`, etc.) and use `fetch` for HTTP requests.

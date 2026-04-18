#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve package root: in compiled output, cli.js is at dist/server/server/cli.js
// So package root is 3 levels up
const PKG_ROOT = path.resolve(__dirname, '..', '..', '..');

// Parse CLI arguments
const args = process.argv.slice(2);
let port = 3001;
let shouldOpen = true;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    port = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--no-open') {
    shouldOpen = false;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Skills Manager - 多 AI 工具 Skills 统一管理平台

Usage:
  ahang-skills-manager [options]

Options:
  --port <number>   指定服务端口 (默认: 3001)
  --no-open         启动后不自动打开浏览器
  -h, --help        显示帮助信息
  -v, --version     显示版本号
`);
    process.exit(0);
  } else if (args[i] === '--version' || args[i] === '-v') {
    const pkg = await fs.readJson(path.join(PKG_ROOT, 'package.json'));
    console.log(pkg.version);
    process.exit(0);
  }
}

// Set environment
process.env.NODE_ENV = 'production';
process.env.PORT = String(port);
process.env.SM_PKG_ROOT = PKG_ROOT;

// Initialize user data directory
const userDataDir = path.join(os.homedir(), '.skills-manager');
await fs.ensureDir(userDataDir);
if (!(await fs.pathExists(path.join(userDataDir, 'user-config.json')))) {
  await fs.writeJson(
    path.join(userDataDir, 'user-config.json'),
    {
      sourceDir: '',
      sourceDirs: [],
      activeSourceDirId: '',
      llmModels: [],
      projects: [],
      dismissedPaths: [],
    },
    { spaces: 2 }
  );
  console.log('✓ 已创建用户配置 (~/.skills-manager/user-config.json)');
}

// Initialize project data directory (in package root)
const dataDir = path.join(PKG_ROOT, 'data');
await fs.ensureDir(dataDir);
if (!(await fs.pathExists(path.join(dataDir, 'config.json')))) {
  const examplePath = path.join(PKG_ROOT, 'data', 'config.example.json');
  if (await fs.pathExists(examplePath)) {
    await fs.copy(examplePath, path.join(dataDir, 'config.json'));
  } else {
    await fs.writeJson(path.join(dataDir, 'config.json'), {}, { spaces: 2 });
  }
  console.log('✓ 已创建项目配置');
}

// Start server
console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║     Skills Manager - 启动中...           ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');

// Dynamic import to ensure env vars are set before server loads
await import('./index.js');

// Open browser
if (shouldOpen) {
  const url = `http://localhost:${port}`;
  const { exec } = await import('child_process');
  const platform = process.platform;
  const cmd =
    platform === 'darwin' ? `open "${url}"` :
    platform === 'win32' ? `start "${url}"` :
    `xdg-open "${url}"`;

  setTimeout(() => {
    exec(cmd, (err) => {
      if (err) {
        console.log(`  请手动打开浏览器访问: ${url}`);
      }
    });
  }, 1000);
}

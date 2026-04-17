import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { AppConfig, ToolDefinition, AppPreferences, SourceDir, LLMModel } from '../../src/types/index.js';

// Project-level config (safe to commit to git)
const DATA_DIR = path.resolve(process.cwd(), 'data');
const PROJECT_CONFIG_PATH = path.join(DATA_DIR, 'config.json');

// User-level config (contains sensitive data like API keys, stored in home dir)
const USER_CONFIG_DIR = path.join(os.homedir(), '.skills-manager');
const USER_CONFIG_PATH = path.join(USER_CONFIG_DIR, 'user-config.json');

// Fields that belong to project-level config (non-sensitive)
const PROJECT_FIELDS = ['tools', 'preferences'] as const;

// Fields that belong to user-level config (sensitive / user-specific)
const USER_FIELDS = ['sourceDir', 'sourceDirs', 'activeSourceDirId', 'llmModels', 'projects', 'dismissedPaths'] as const;

interface ProjectConfig {
  tools: ToolDefinition[];
  preferences: AppPreferences;
}

interface UserConfig {
  sourceDir: string;
  sourceDirs: SourceDir[];
  activeSourceDirId: string;
  llmModels: LLMModel[];
  projects: any[];
  dismissedPaths: string[];
}

const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  tools: [
    {
      type: 'claude',
      name: 'Claude',
      configDir: '.claude',
      skillsDir: 'skills',
      enabled: true,
    },
    {
      type: 'cursor',
      name: 'Cursor',
      configDir: '.cursor',
      skillsDir: 'skills',
      enabled: true,
    },
    {
      type: 'codebuddy',
      name: 'CodeBuddy',
      configDir: '.codebuddy',
      skillsDir: 'skills',
      enabled: true,
    },
    {
      type: 'copilot',
      name: 'GitHub Copilot',
      configDir: '.github',
      skillsDir: 'copilot/skills',
      enabled: false,
    },
  ],
  preferences: {
    theme: 'system',
    autoSync: false,
    backupBeforeReplace: true,
  },
};

const DEFAULT_USER_CONFIG: UserConfig = {
  sourceDir: '',
  sourceDirs: [],
  activeSourceDirId: '',
  llmModels: [],
  projects: [],
  dismissedPaths: [],
};

/**
 * Migrate legacy sourceDir (single string) to sourceDirs array format.
 */
function migrateSourceDirs(data: any): any {
  if (data.sourceDir && (!data.sourceDirs || data.sourceDirs.length === 0)) {
    const id = uuidv4();
    const dirName = path.basename(data.sourceDir) || 'Default';
    data.sourceDirs = [{ id, name: dirName, path: data.sourceDir }];
    data.activeSourceDirId = id;
  }
  if (!data.sourceDirs) data.sourceDirs = [];
  if (!data.activeSourceDirId) data.activeSourceDirId = '';
  if (data.activeSourceDirId && data.sourceDirs.length > 0) {
    const active = data.sourceDirs.find((s: SourceDir) => s.id === data.activeSourceDirId);
    if (active) {
      data.sourceDir = active.path;
    }
  }
  return data;
}

/**
 * Migrate user-specific data from project config (data/config.json) to user config (~/.skills-manager/user-config.json).
 * This runs once when user data is detected in the project config.
 */
async function migrateToUserConfig(): Promise<void> {
  try {
    if (!(await fs.pathExists(PROJECT_CONFIG_PATH))) return;

    const projectData = await fs.readJson(PROJECT_CONFIG_PATH);

    // Check if project config contains user-level data that needs migration
    const hasUserData = projectData.llmModels?.length > 0 ||
      projectData.sourceDirs?.length > 0 ||
      projectData.projects?.length > 0 ||
      projectData.sourceDir ||
      projectData.dismissedPaths?.length > 0;

    if (!hasUserData) return;

    console.log('[ConfigService] Migrating user data from project config to ~/.skills-manager/user-config.json ...');

    // Read existing user config (if any)
    await fs.ensureDir(USER_CONFIG_DIR);
    let existingUserConfig: any = {};
    if (await fs.pathExists(USER_CONFIG_PATH)) {
      existingUserConfig = await fs.readJson(USER_CONFIG_PATH);
    }

    // Merge: project data takes precedence only if user config doesn't already have data
    const migratedUserConfig: UserConfig = {
      sourceDir: existingUserConfig.sourceDir || projectData.sourceDir || '',
      sourceDirs: existingUserConfig.sourceDirs?.length > 0 ? existingUserConfig.sourceDirs : (projectData.sourceDirs || []),
      activeSourceDirId: existingUserConfig.activeSourceDirId || projectData.activeSourceDirId || '',
      llmModels: existingUserConfig.llmModels?.length > 0 ? existingUserConfig.llmModels : (projectData.llmModels || []),
      projects: existingUserConfig.projects?.length > 0 ? existingUserConfig.projects : (projectData.projects || []),
      dismissedPaths: existingUserConfig.dismissedPaths?.length > 0 ? existingUserConfig.dismissedPaths : (projectData.dismissedPaths || []),
    };

    // Save user config
    await fs.writeJson(USER_CONFIG_PATH, migratedUserConfig, { spaces: 2 });

    // Clean user data from project config, keep only project-level fields
    const cleanedProjectConfig: any = {
      tools: projectData.tools || DEFAULT_PROJECT_CONFIG.tools,
      preferences: projectData.preferences || DEFAULT_PROJECT_CONFIG.preferences,
    };
    await fs.writeJson(PROJECT_CONFIG_PATH, cleanedProjectConfig, { spaces: 2 });

    console.log('[ConfigService] Migration complete. User data saved to ~/.skills-manager/user-config.json');
  } catch (error) {
    console.error('[ConfigService] Migration failed:', error);
  }
}

// Run migration on module load
let migrationDone = false;
async function ensureMigration(): Promise<void> {
  if (!migrationDone) {
    await migrateToUserConfig();
    migrationDone = true;
  }
}

/**
 * Read project-level config from data/config.json
 */
async function getProjectConfig(): Promise<ProjectConfig> {
  try {
    await fs.ensureDir(DATA_DIR);
    if (await fs.pathExists(PROJECT_CONFIG_PATH)) {
      const data = await fs.readJson(PROJECT_CONFIG_PATH);
      return {
        tools: data.tools || DEFAULT_PROJECT_CONFIG.tools,
        preferences: { ...DEFAULT_PROJECT_CONFIG.preferences, ...data.preferences },
      };
    }
    await fs.writeJson(PROJECT_CONFIG_PATH, DEFAULT_PROJECT_CONFIG, { spaces: 2 });
    return { ...DEFAULT_PROJECT_CONFIG };
  } catch (error) {
    console.error('Error reading project config:', error);
    return { ...DEFAULT_PROJECT_CONFIG };
  }
}

/**
 * Read user-level config from ~/.skills-manager/user-config.json
 */
async function getUserConfig(): Promise<UserConfig> {
  try {
    await fs.ensureDir(USER_CONFIG_DIR);
    if (await fs.pathExists(USER_CONFIG_PATH)) {
      let data = await fs.readJson(USER_CONFIG_PATH);
      data = migrateSourceDirs(data);
      return { ...DEFAULT_USER_CONFIG, ...data };
    }
    await fs.writeJson(USER_CONFIG_PATH, DEFAULT_USER_CONFIG, { spaces: 2 });
    return { ...DEFAULT_USER_CONFIG };
  } catch (error) {
    console.error('Error reading user config:', error);
    return { ...DEFAULT_USER_CONFIG };
  }
}

/**
 * Save project-level config
 */
async function saveProjectConfig(config: ProjectConfig): Promise<void> {
  await fs.ensureDir(DATA_DIR);
  await fs.writeJson(PROJECT_CONFIG_PATH, config, { spaces: 2 });
}

/**
 * Save user-level config
 */
async function saveUserConfig(config: UserConfig): Promise<void> {
  await fs.ensureDir(USER_CONFIG_DIR);
  // Keep sourceDir in sync with active source dir
  if (config.activeSourceDirId && config.sourceDirs.length > 0) {
    const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
    if (active) {
      config.sourceDir = active.path;
    }
  }
  await fs.writeJson(USER_CONFIG_PATH, config, { spaces: 2 });
}

/**
 * Get merged config (project + user)
 */
export async function getConfig(): Promise<AppConfig> {
  await ensureMigration();
  const projectConfig = await getProjectConfig();
  const userConfig = await getUserConfig();

  return {
    ...userConfig,
    ...projectConfig,
  };
}

/**
 * Save full config (splits into project and user configs)
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  const projectConfig: ProjectConfig = {
    tools: config.tools,
    preferences: config.preferences,
  };

  const userConfig: UserConfig = {
    sourceDir: config.sourceDir,
    sourceDirs: config.sourceDirs,
    activeSourceDirId: config.activeSourceDirId,
    llmModels: config.llmModels,
    projects: config.projects,
    dismissedPaths: (config as any).dismissedPaths || [],
  };

  await Promise.all([
    saveProjectConfig(projectConfig),
    saveUserConfig(userConfig),
  ]);
}

export async function updateConfig(updates: {
  sourceDir?: string;
  sourceDirs?: SourceDir[];
  activeSourceDirId?: string;
  llmModels?: LLMModel[];
  tools?: { type: string; enabled: boolean }[];
  preferences?: Partial<AppPreferences>;
}): Promise<AppConfig> {
  const config = await getConfig();

  if (updates.sourceDirs !== undefined) {
    config.sourceDirs = updates.sourceDirs;
  }

  if (updates.activeSourceDirId !== undefined) {
    config.activeSourceDirId = updates.activeSourceDirId;
    const active = config.sourceDirs.find(s => s.id === updates.activeSourceDirId);
    if (active) {
      config.sourceDir = active.path;
    }
  }

  if (updates.sourceDir !== undefined && !updates.sourceDirs) {
    config.sourceDir = updates.sourceDir;
    if (config.activeSourceDirId) {
      const active = config.sourceDirs.find(s => s.id === config.activeSourceDirId);
      if (active) {
        active.path = updates.sourceDir;
      }
    }
  }

  if (updates.llmModels !== undefined) {
    config.llmModels = updates.llmModels;
  }

  if (updates.tools) {
    for (const toolUpdate of updates.tools) {
      const tool = config.tools.find((t: ToolDefinition) => t.type === toolUpdate.type);
      if (tool) {
        tool.enabled = toolUpdate.enabled;
      }
    }
  }

  if (updates.preferences) {
    config.preferences = { ...config.preferences, ...updates.preferences };
  }

  await saveConfig(config);
  return config;
}

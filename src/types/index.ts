// ==================== Tool Types ====================

export type ToolType = 'claude' | 'cursor' | 'codebuddy' | 'copilot' | 'custom';
export type LinkStatus = 'linked' | 'unlinked' | 'conflict' | 'missing' | 'broken';

// ==================== Project Management ====================

export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  tools: ToolConfig[];
}

export interface ToolConfig {
  type: ToolType;
  configPath: string;
  skillsPath: string;
  linkStatus: LinkStatus;
  linkedTo?: string;
}

// ==================== Skills Files ====================

export interface SkillFile {
  id: string;
  name: string;
  path: string;
  content: string;
  category: string;
  tags: string[];
  updatedAt: string;
  size: number;
}

export interface SkillTemplate {
  id: string;
  name: string;
  description: string;
  category: 'code-style' | 'testing' | 'documentation' | 'architecture' | 'custom';
  content: string;
  variables: TemplateVariable[];
}

export interface TemplateVariable {
  key: string;
  label: string;
  defaultValue: string;
  description: string;
}

// ==================== File Tree ====================

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  description?: string;
  isValidSkill?: boolean;
}

// ==================== Link Management ====================

export interface LinkOperation {
  projectId: string;
  projectPath: string;
  tool: string;
  sourcePath: string;
  targetPath: string;
  action: 'create' | 'remove' | 'repair';
  status: 'pending' | 'success' | 'failed' | 'conflict';
  error?: string;
}

export interface ConflictResolution {
  strategy: 'backup-replace' | 'skip' | 'merge';
  backupPath?: string;
}

export interface SyncConfig {
  sourceDir: string;
  tools: {
    type: string;
    enabled: boolean;
    targetDir: string;
  }[];
}

// ==================== Tools ====================

export interface FormatConverter {
  from: ToolType;
  to: ToolType;
  convert: (content: string) => string;
}

export interface ValidationResult {
  path: string;
  valid: boolean;
  errors: { line: number; message: string }[];
  warnings: { line: number; message: string }[];
}

export interface DiffHunk {
  oldStart: number;
  newStart: number;
  lines: { type: 'add' | 'remove' | 'normal'; content: string }[];
}

// ==================== LLM Model ====================

export interface LLMModel {
  id: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  displayName: string;
  tested: boolean;
  testedAt?: string;
}

// ==================== Source Directory ====================

export interface SourceDir {
  id: string;
  name: string;
  path: string;
}

// ==================== Config ====================

export interface AppConfig {
  sourceDir: string; // Legacy compat: equals active source dir path
  sourceDirs: SourceDir[];
  activeSourceDirId: string;
  llmModels: LLMModel[];
  projects: Project[];
  tools: ToolDefinition[];
  preferences: AppPreferences;
}

export interface ToolDefinition {
  type: string;
  name: string;
  configDir: string;
  skillsDir: string;
  enabled: boolean;
}

export type UIStyle = 'default' | 'pixel';

export interface AppPreferences {
  theme: 'light' | 'dark' | 'system';
  uiStyle: UIStyle;
  autoSync: boolean;
  backupBeforeReplace: boolean;
}

// ==================== Version Management ====================

export interface SkillVersion {
  id: string;
  skillPath: string;
  version: string;
  label?: string;
  createdAt: string;
  fileCount: number;
  totalSize: number;
}

export interface VersionFile {
  relativePath: string;
  content: string;
  size: number;
}

export interface VersionDetail {
  id: string;
  skillPath: string;
  version: string;
  label?: string;
  createdAt: string;
  files: VersionFile[];
}

export interface VersionDiff {
  relativePath: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  currentContent?: string;
  versionContent?: string;
}

// ==================== Analytics ====================

export type AnalyticsEventType = 'view' | 'edit' | 'save' | 'link' | 'unlink' | 'ai-optimize' | 'ai-generate' | 'export' | 'version-create' | 'version-restore';

export interface AnalyticsEvent {
  id: string;
  skillPath: string;
  skillName: string;
  eventType: AnalyticsEventType;
  timestamp: string;
  metadata?: Record<string, string>;
}

export interface SkillUsageStats {
  skillPath: string;
  skillName: string;
  folderName: string;
  description?: string;
  totalViews: number;
  totalEdits: number;
  totalLinks: number;
  aiOptimizeCount: number;
  aiGenerateCount: number;
  exportCount: number;
  versionCount: number;
  lastActivityAt?: string;
}

export interface AnalyticsDashboard {
  overview: {
    totalEvents: number;
    totalSkillsTracked: number;
    mostActiveSkill?: { name: string; folderName: string; description?: string; count: number };
    todayEvents: number;
  };
  skillStats: SkillUsageStats[];
  recentActivity: AnalyticsEvent[];
}

// ==================== API Request/Response Types ====================

export interface AddProjectRequest {
  path: string;
  name?: string;
}

export interface ScanProjectResponse {
  tools: ToolConfig[];
}

export interface GetSkillsResponse {
  tree: FileTreeNode[];
  sourceDir: string;
}

export interface GetFileResponse {
  content: string;
  updatedAt: string;
}

export interface SaveFileRequest {
  path: string;
  content: string;
}

export interface CreateFileRequest {
  path: string;
  content?: string;
  templateId?: string;
  variables?: Record<string, string>;
}

export interface SearchResponse {
  results: {
    path: string;
    matches: { line: number; text: string }[];
  }[];
}

export interface GetLinkStatusResponse {
  projects: {
    projectId: string;
    links: {
      tool: string;
      status: LinkStatus;
      targetPath: string;
      linkedTo?: string;
    }[];
  }[];
}

export interface SyncLinksRequest {
  projectIds: string[];
  tools?: string[];
  conflictStrategy?: 'backup-replace' | 'skip';
}

export interface SyncLinksResponse {
  results: LinkOperation[];
}

export interface RemoveLinksRequest {
  projectIds: string[];
  tools?: string[];
  restoreAsDirectory?: boolean;
}

export interface VerifyLinksResponse {
  broken: { projectId: string; tool: string; path: string }[];
}

export interface ConvertRequest {
  files: string[];
  from: ToolType;
  to: ToolType;
  outputDir: string;
}

export interface ValidateRequest {
  paths: string[];
}

export interface ExportRequest {
  paths: string[];
  format: 'zip';
}

export interface DiffRequest {
  file1: string;
  file2: string;
}

export interface DiffResponse {
  hunks: DiffHunk[];
}

export interface ConfigResponse {
  sourceDir: string;
  tools: ToolDefinition[];
  preferences: AppPreferences;
}

export interface UpdateConfigRequest {
  sourceDir?: string;
  tools?: { type: string; enabled: boolean }[];
  preferences?: Partial<AppPreferences>;
}

// ==================== Import Center ====================

export type ImportSource = 'github' | 'gitee' | 'gitlab' | 'bitbucket' | 'clawhub' | 'local' | 'zip' | 'clipboard' | 'batch' | 'csv' | 'json';
export type ImportMode = 'copy' | 'move' | 'symlink';
export type ImportConflictStrategy = 'overwrite' | 'rename' | 'skip' | 'merge';

export interface ImportOptions {
  targetSourceDirId?: string;
  conflictStrategy: ImportConflictStrategy;
  importMode: ImportMode;
  autoSnapshot: boolean;
}

export interface ScannedSkill {
  name: string;
  path: string;
  description?: string;
  fileCount: number;
  totalSize: number;
  isValid: boolean;
  files: { relativePath: string; size: number }[];
  hasConflict?: boolean;
  conflictAction?: ImportConflictStrategy;
  selected?: boolean;
}

export interface ImportResult {
  source: ImportSource;
  sourceUrl?: string;
  totalCount: number;
  successCount: number;
  skipCount: number;
  failCount: number;
  importedSkills: { name: string; path: string }[];
  skippedSkills: { name: string; reason: string }[];
  failedSkills: { name: string; error: string }[];
  duration: number;
}

export interface ImportHistoryItem {
  id: string;
  source: ImportSource;
  sourceUrl?: string;
  timestamp: string;
  result: ImportResult;
  version?: string;
  subscribed?: boolean;
}

export interface Subscription {
  id: string;
  skillPath: string;
  skillName: string;
  source: ImportSource;
  sourceUrl: string;
  branch?: string;
  version?: string;
  latestVersion?: string;
  hasUpdate?: boolean;
  subscribedAt: string;
  lastCheckedAt?: string;
  lastUpdatedAt?: string;
  autoUpdate: boolean;
}

export interface ImportSettings {
  defaultSourceDirId: string;
  defaultConflictStrategy: ImportConflictStrategy;
  defaultImportMode: ImportMode;
  autoSnapshotOnImport: boolean;
  clipboardDetection: boolean;
  autoCleanTempFiles: boolean;
  autoUpdateInterval: 'daily' | 'weekly' | 'monthly' | 'disabled';
}

export interface ImportStats {
  totalImports: number;
  bySource: { source: ImportSource; count: number }[];
  successRate: number;
  avgDuration: number;
  recentTrend: { date: string; count: number }[];
}

export interface RepoInfo {
  name: string;
  description?: string;
  stars?: number;
  defaultBranch: string;
  branches?: string[];
  url: string;
  version?: string;
}

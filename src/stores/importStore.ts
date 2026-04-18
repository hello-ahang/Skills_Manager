import { create } from 'zustand';
import type {
  ImportSource,
  ImportOptions,
  ScannedSkill,
  ImportResult,
  ImportHistoryItem,
  Subscription,
  ImportSettings,
  RepoInfo,
} from '@/types';

type ImportMethod = 'git' | 'local' | 'zip' | 'clipboard' | 'batch' | 'clawhub';
type GitPlatform = 'github' | 'gitee' | 'gitlab';

interface ImportState {
  // Wizard state
  importStep: number; // 1=input, 2=preview, 3=executing, 4=result
  importSource: ImportSource | null;
  sourceUrl: string;
  selectedImportMethod: ImportMethod;
  selectedGitPlatform: GitPlatform;

  // Scan results
  scanning: boolean;
  scanError: string | null;
  scannedSkills: ScannedSkill[];
  repoInfo: RepoInfo | null;

  // Import options
  importOptions: ImportOptions;

  // Import execution
  importing: boolean;
  importProgress: string;
  importResult: ImportResult | null;

  // History
  importHistory: ImportHistoryItem[];
  historyLoading: boolean;

  // Subscriptions
  subscriptions: Subscription[];
  subscriptionsLoading: boolean;

  // Settings
  importSettings: ImportSettings;

  // Active tab
  activeTab: 'import' | 'history' | 'subscriptions' | 'settings' | 'stats';

  // Actions
  setImportStep: (step: number) => void;
  setImportSource: (source: ImportSource | null) => void;
  setSourceUrl: (url: string) => void;
  setSelectedImportMethod: (method: ImportMethod) => void;
  setSelectedGitPlatform: (platform: GitPlatform) => void;
  setScanning: (scanning: boolean) => void;
  setScanError: (error: string | null) => void;
  setScannedSkills: (skills: ScannedSkill[]) => void;
  setRepoInfo: (info: RepoInfo | null) => void;
  setImportOptions: (options: Partial<ImportOptions>) => void;
  setImporting: (importing: boolean) => void;
  setImportProgress: (progress: string) => void;
  setImportResult: (result: ImportResult | null) => void;
  setImportHistory: (history: ImportHistoryItem[]) => void;
  setSubscriptions: (subs: Subscription[]) => void;
  setImportSettings: (settings: Partial<ImportSettings>) => void;
  setActiveTab: (tab: 'import' | 'history' | 'subscriptions' | 'settings' | 'stats') => void;
  toggleSkillSelection: (index: number) => void;
  selectAllSkills: (selected: boolean) => void;
  setSkillConflictAction: (index: number, action: string) => void;
  resetWizard: () => void;
}

const DEFAULT_OPTIONS: ImportOptions = {
  conflictStrategy: 'skip',
  importMode: 'copy',
  autoSnapshot: true,
};

const DEFAULT_SETTINGS: ImportSettings = {
  defaultSourceDirId: '',
  defaultConflictStrategy: 'skip',
  defaultImportMode: 'copy',
  autoSnapshotOnImport: true,
  clipboardDetection: true,
  autoCleanTempFiles: true,
  autoUpdateInterval: 'disabled',
};

export const useImportStore = create<ImportState>((set, get) => ({
  // Initial state
  importStep: 1,
  importSource: null,
  sourceUrl: '',
  selectedImportMethod: 'git',
  selectedGitPlatform: 'github',
  scanning: false,
  scanError: null,
  scannedSkills: [],
  repoInfo: null,
  importOptions: { ...DEFAULT_OPTIONS },
  importing: false,
  importProgress: '',
  importResult: null,
  importHistory: [],
  historyLoading: false,
  subscriptions: [],
  subscriptionsLoading: false,
  importSettings: { ...DEFAULT_SETTINGS },
  activeTab: 'import',

  // Actions
  setImportStep: (step) => set({ importStep: step }),
  setImportSource: (source) => set({ importSource: source }),
  setSourceUrl: (url) => set({ sourceUrl: url }),
  setSelectedImportMethod: (method) => set({ selectedImportMethod: method }),
  setSelectedGitPlatform: (platform) => set({ selectedGitPlatform: platform }),
  setScanning: (scanning) => set({ scanning }),
  setScanError: (error) => set({ scanError: error }),
  setScannedSkills: (skills) => set({ scannedSkills: skills }),
  setRepoInfo: (info) => set({ repoInfo: info }),
  setImportOptions: (options) =>
    set({ importOptions: { ...get().importOptions, ...options } }),
  setImporting: (importing) => set({ importing }),
  setImportProgress: (progress) => set({ importProgress: progress }),
  setImportResult: (result) => set({ importResult: result }),
  setImportHistory: (history) => set({ importHistory: history }),
  setSubscriptions: (subs) => set({ subscriptions: subs }),
  setImportSettings: (settings) =>
    set({ importSettings: { ...get().importSettings, ...settings } }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleSkillSelection: (index) => {
    const skills = [...get().scannedSkills];
    if (skills[index]) {
      skills[index] = { ...skills[index], selected: !skills[index].selected };
      set({ scannedSkills: skills });
    }
  },

  selectAllSkills: (selected) => {
    const skills = get().scannedSkills.map(s => ({ ...s, selected }));
    set({ scannedSkills: skills });
  },

  setSkillConflictAction: (index, action) => {
    const skills = [...get().scannedSkills];
    if (skills[index]) {
      skills[index] = { ...skills[index], conflictAction: action as any };
      set({ scannedSkills: skills });
    }
  },

  resetWizard: () =>
    set({
      importStep: 1,
      importSource: null,
      sourceUrl: '',
      selectedImportMethod: 'git',
  selectedGitPlatform: 'github',
      scanning: false,
      scanError: null,
      scannedSkills: [],
      repoInfo: null,
      importing: false,
      importProgress: '',
      importResult: null,
    }),
}));
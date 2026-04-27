const importProviders = new Map();
/** 注册一个导入 Provider */
export function registerImportProvider(provider) {
    importProviders.set(provider.id, provider);
}
/** 获取所有已注册的 Provider */
export function getImportProviders() {
    return Array.from(importProviders.values());
}
/** 根据 URL 自动匹配 Provider */
export function detectProvider(url) {
    for (const provider of importProviders.values()) {
        if (provider.matchUrl?.(url))
            return provider;
    }
    return null;
}

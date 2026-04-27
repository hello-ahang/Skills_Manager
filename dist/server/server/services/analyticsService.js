import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
const USER_CONFIG_DIR = path.join(os.homedir(), '.skills-manager');
const ANALYTICS_DIR = path.join(USER_CONFIG_DIR, 'analytics');
const EVENTS_PATH = path.join(ANALYTICS_DIR, 'events.jsonl');
const MAX_AGE_DAYS = 90;
// ==================== Helpers ====================
async function ensureDir() {
    await fs.ensureDir(ANALYTICS_DIR);
}
/**
 * Read all events from JSONL file.
 */
async function readAllEvents() {
    await ensureDir();
    if (!await fs.pathExists(EVENTS_PATH))
        return [];
    try {
        const raw = await fs.readFile(EVENTS_PATH, 'utf-8');
        const lines = raw.trim().split('\n').filter(Boolean);
        const events = [];
        for (const line of lines) {
            try {
                events.push(JSON.parse(line));
            }
            catch {
                // Skip malformed lines
            }
        }
        return events;
    }
    catch {
        return [];
    }
}
/**
 * Auto-clean events older than MAX_AGE_DAYS.
 */
async function autoClean(events) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
    const cutoffTime = cutoff.getTime();
    const filtered = events.filter(e => new Date(e.timestamp).getTime() >= cutoffTime);
    if (filtered.length < events.length) {
        // Rewrite file with cleaned events
        const content = filtered.map(e => JSON.stringify(e)).join('\n') + (filtered.length > 0 ? '\n' : '');
        await fs.writeFile(EVENTS_PATH, content, 'utf-8');
    }
    return filtered;
}
/**
 * Extract skill name from path (last directory segment).
 */
function extractSkillName(skillPath) {
    return path.basename(skillPath) || skillPath;
}
/**
 * Normalize a file path to its Skill directory level.
 * e.g. "/path/to/my-skill/SKILL.md" → "/path/to/my-skill"
 *      "/path/to/my-skill" → "/path/to/my-skill" (already a dir)
 */
function normalizeToSkillDir(filePath) {
    // If path ends with a file extension, take its parent directory
    const ext = path.extname(filePath);
    if (ext) {
        return path.dirname(filePath);
    }
    return filePath;
}
/**
 * Parse SKILL.md frontmatter to extract name and description.
 */
async function parseSkillMeta(skillDir) {
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    try {
        if (!await fs.pathExists(skillMdPath))
            return {};
        const content = await fs.readFile(skillMdPath, 'utf-8');
        // Parse YAML frontmatter between --- markers
        const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (!match)
            return {};
        const frontmatter = match[1];
        let name;
        let description;
        for (const line of frontmatter.split('\n')) {
            const nameMatch = line.match(/^name:\s*(.+)/);
            if (nameMatch)
                name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
            const descMatch = line.match(/^description:\s*(.+)/);
            if (descMatch)
                description = descMatch[1].trim().replace(/^["']|["']$/g, '');
        }
        return { name, description };
    }
    catch {
        return {};
    }
}
// ==================== Public API ====================
/**
 * Record a usage event.
 */
export async function recordEvent(skillPath, skillName, eventType, metadata) {
    await ensureDir();
    const event = {
        id: uuidv4(),
        skillPath,
        skillName: skillName || extractSkillName(skillPath),
        eventType,
        timestamp: new Date().toISOString(),
        metadata,
    };
    // Append to JSONL file
    await fs.appendFile(EVENTS_PATH, JSON.stringify(event) + '\n', 'utf-8');
}
/**
 * Get dashboard data (overview + top skills + recent activity).
 */
export async function getDashboard() {
    let events = await readAllEvents();
    events = await autoClean(events);
    const today = new Date().toISOString().slice(0, 10);
    const todayEvents = events.filter(e => e.timestamp.slice(0, 10) === today).length;
    // Aggregate by skill directory (normalize file paths to skill-level directory)
    const skillMap = new Map();
    for (const e of events) {
        const key = normalizeToSkillDir(e.skillPath);
        const folderName = extractSkillName(key);
        const skillName = e.skillName || folderName;
        if (!skillMap.has(key)) {
            skillMap.set(key, {
                name: skillName,
                count: 0,
                stats: {
                    skillPath: key,
                    skillName: skillName,
                    folderName,
                    totalViews: 0,
                    totalEdits: 0,
                    totalLinks: 0,
                    aiOptimizeCount: 0,
                    aiGenerateCount: 0,
                    exportCount: 0,
                    versionCount: 0,
                },
            });
        }
        const entry = skillMap.get(key);
        entry.count++;
        switch (e.eventType) {
            case 'view':
                entry.stats.totalViews++;
                break;
            case 'edit':
            case 'save':
                entry.stats.totalEdits++;
                break;
            case 'link':
            case 'unlink':
                entry.stats.totalLinks++;
                break;
            case 'ai-optimize':
                entry.stats.aiOptimizeCount++;
                break;
            case 'ai-generate':
                entry.stats.aiGenerateCount++;
                break;
            case 'export':
                entry.stats.exportCount++;
                break;
            case 'version-create':
            case 'version-restore':
                entry.stats.versionCount++;
                break;
        }
        // Track last activity
        if (!entry.stats.lastActivityAt || e.timestamp > entry.stats.lastActivityAt) {
            entry.stats.lastActivityAt = e.timestamp;
        }
    }
    // Sort skills by total activity count (descending)
    const skillStats = Array.from(skillMap.values())
        .map(e => e.stats)
        .sort((a, b) => {
        const aTotal = a.totalViews + a.totalEdits + a.aiOptimizeCount + a.aiGenerateCount + a.exportCount + a.versionCount;
        const bTotal = b.totalViews + b.totalEdits + b.aiOptimizeCount + b.aiGenerateCount + b.exportCount + b.versionCount;
        return bTotal - aTotal;
    });
    // Enrich each skill with SKILL.md metadata (name, description)
    await Promise.all(skillStats.map(async (stat) => {
        const meta = await parseSkillMeta(stat.skillPath);
        if (meta.name)
            stat.skillName = meta.name;
        if (meta.description)
            stat.description = meta.description;
    }));
    // Find most active skill (after enrichment)
    let mostActiveSkill;
    for (const entry of skillMap.values()) {
        if (!mostActiveSkill || entry.count > mostActiveSkill.count) {
            const stat = skillStats.find(s => s.skillPath === entry.stats.skillPath);
            mostActiveSkill = {
                name: stat?.skillName || entry.name,
                folderName: entry.stats.folderName,
                description: stat?.description,
                count: entry.count,
            };
        }
    }
    // Recent activity (last 30 events, newest first)
    // Enrich with SKILL.md metadata for display
    const recentRaw = [...events].reverse().slice(0, 30);
    const metaCache = new Map();
    const recentActivity = await Promise.all(recentRaw.map(async (e) => {
        const dir = normalizeToSkillDir(e.skillPath);
        if (!metaCache.has(dir)) {
            metaCache.set(dir, await parseSkillMeta(dir));
        }
        const meta = metaCache.get(dir);
        return {
            ...e,
            skillName: meta.name || e.skillName || extractSkillName(dir),
            metadata: {
                ...e.metadata,
                ...(meta.description ? { description: meta.description } : {}),
            },
        };
    }));
    return {
        overview: {
            totalEvents: events.length,
            totalSkillsTracked: skillMap.size,
            mostActiveSkill,
            todayEvents,
        },
        skillStats,
        recentActivity,
    };
}
/**
 * Get stats for a single skill.
 */
export async function getSkillStats(skillPath) {
    const dashboard = await getDashboard();
    return dashboard.skillStats.find(s => s.skillPath === skillPath) || null;
}
/**
 * Get recent activity events.
 */
export async function getRecentActivity(limit = 30) {
    let events = await readAllEvents();
    events = await autoClean(events);
    return [...events].reverse().slice(0, limit);
}
/**
 * Clear all analytics data.
 */
export async function clearAll() {
    await ensureDir();
    if (await fs.pathExists(EVENTS_PATH)) {
        await fs.remove(EVENTS_PATH);
    }
}

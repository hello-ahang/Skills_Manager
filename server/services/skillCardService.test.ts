/**
 * Unit tests for skillCardService — static extraction, HTML rendering,
 * XSS escape, AI mock path.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Mock configService BEFORE importing the service under test so that
// getDefaultModelConfig is replaceable per-test. configService uses
// os.homedir() (set at module load), so env-based overrides don't work.
vi.mock('./configService.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./configService.js')>();
  return {
    ...original,
    getDefaultModelConfig: vi.fn(async () => null),
  };
});
// Mock radarService.loadRubricCache and versionService.getVersionHistory to
// avoid pulling in the real SQLite/disk dependencies on each test run.
vi.mock('./radarService.js', () => ({
  loadRubricCache: vi.fn(async () => ({})),
}));
vi.mock('./versionService.js', () => ({
  getVersionHistory: vi.fn(async () => []),
}));

import {
  extractStaticCardData,
  callAIForCardCopy,
  renderCardHtml,
  escapeHtml,
  generateSkillCard,
  type SkillCardData,
} from './skillCardService.js';
import { getDefaultModelConfig } from './configService.js';

const mockedGetDefaultModelConfig = vi.mocked(getDefaultModelConfig);

function makeParsed(opts: {
  name?: string;
  description?: string;
  body?: string;
  related?: string[];
}) {
  return {
    raw: '---\n---\n' + (opts.body || ''),
    frontmatter: '',
    body: opts.body || '',
    name: opts.name,
    description: opts.description,
    related: opts.related || [],
  };
}

describe('escapeHtml', () => {
  it('escapes the five XSS-relevant characters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
    expect(escapeHtml("a & b 'c'")).toBe('a &amp; b &#39;c&#39;');
  });

  it('is a no-op on safe text', () => {
    expect(escapeHtml('hello world 你好')).toBe('hello world 你好');
  });
});

describe('extractStaticCardData', () => {
  it('uses description first sentence as title fallback', () => {
    const parsed = makeParsed({
      name: 'demo-skill',
      description: '这是第一句话。这是第二句话。',
      body: '',
    });
    const data = extractStaticCardData(parsed, [], 'demo-skill');
    expect(data.title.startsWith('这是第一句话')).toBe(true);
  });

  it('falls back to ## headings for capabilities', () => {
    const parsed = makeParsed({
      name: 'x',
      description: 'd',
      body: '\n## 能力A\n## 能力B\n## 能力C\n',
    });
    const data = extractStaticCardData(parsed, [], 'x');
    expect(data.capabilities).toEqual(['能力A', '能力B', '能力C']);
  });

  it('falls back to top-level list items when no headings', () => {
    const parsed = makeParsed({
      name: 'x',
      description: 'd',
      body: '\n- 列表项一\n- 列表项二\n',
    });
    const data = extractStaticCardData(parsed, [], 'x');
    expect(data.capabilities).toContain('列表项一');
    expect(data.capabilities).toContain('列表项二');
  });

  it('extracts scenarios from 触发词 pattern', () => {
    const parsed = makeParsed({
      name: 'x',
      description: '触发词：写文章、续写、扩写',
      body: '',
    });
    const data = extractStaticCardData(parsed, [], 'x');
    expect(data.scenarios).toEqual(['写文章', '续写', '扩写']);
  });

  it('extracts examples from ## 示例 section', () => {
    const parsed = makeParsed({
      name: 'x',
      description: 'd',
      body: '\n## 示例\n\n### 第一个例子\n这是说明文字\n\n### 第二个例子\n另一段说明\n',
    });
    const data = extractStaticCardData(parsed, [], 'x');
    expect(data.examples.length).toBeGreaterThan(0);
    expect(data.examples[0].title).toBe('第一个例子');
  });

  it('passes references through unchanged', () => {
    const parsed = makeParsed({ body: '' });
    const refs = [{ name: 'guide.md' }, { name: 'patterns.md' }];
    const data = extractStaticCardData(parsed, refs, 'x');
    expect(data.references).toEqual(refs);
  });
});

describe('renderCardHtml', () => {
  function baseData(overrides: Partial<SkillCardData> = {}): SkillCardData {
    return {
      name: 'test-skill',
      title: '一句话价值',
      capabilities: ['能力A', '能力B'],
      scenarios: ['场景1'],
      examples: [{ title: '示例', description: '说明' }],
      related: [],
      references: [],
      aiUsed: false,
      ...overrides,
    };
  }

  it('includes all key fields in the HTML output', () => {
    const html = renderCardHtml(baseData());
    expect(html).toContain('test-skill');
    expect(html).toContain('一句话价值');
    expect(html).toContain('能力A');
    expect(html).toContain('能力B');
    expect(html).toContain('场景1');
    expect(html).toContain('示例');
  });

  it('escapes XSS payloads in user content', () => {
    const html = renderCardHtml(baseData({
      name: '<script>alert(1)</script>',
      title: 'on"event',
      capabilities: ['<img src=x>'],
    }));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;');
    expect(html).toContain('&lt;img');
  });

  it('embeds dark-mode media query in inline style', () => {
    const html = renderCardHtml(baseData());
    expect(html).toContain('prefers-color-scheme: dark');
  });

  it('renders inline SVG gauge when rubric is provided', () => {
    const html = renderCardHtml(baseData({
      rubric: { overall: 87, grade: 'B' },
    }));
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox="0 0 140 140"');
    expect(html).toContain('>87<');
  });

  it('omits gauge when no rubric', () => {
    const html = renderCardHtml(baseData());
    expect(html).not.toContain('<svg');
  });

  it('renders empty placeholders when sections are empty', () => {
    const html = renderCardHtml(baseData({
      capabilities: [],
      scenarios: [],
      examples: [],
    }));
    expect(html).toMatch(/尚未提取到能力清单/);
    expect(html).toMatch(/尚未提取到使用场景/);
    expect(html).toMatch(/暂无示例/);
  });

  it('shows AI generation label when aiUsed', () => {
    const html = renderCardHtml(baseData({ aiUsed: true }));
    expect(html).toContain('AI 提炼');
  });

  it('shows static label when AI not used', () => {
    const html = renderCardHtml(baseData({ aiUsed: false }));
    expect(html).toContain('静态提取');
  });
});

describe('callAIForCardCopy', () => {
  const originalFetch = global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;
    mockedGetDefaultModelConfig.mockReset();
    mockedGetDefaultModelConfig.mockResolvedValue({
      baseUrl: 'https://example.test/v1',
      apiKey: 'sk-test',
      modelName: 'test-model',
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns null when AI not configured', async () => {
    mockedGetDefaultModelConfig.mockResolvedValueOnce(null);
    const parsed = makeParsed({ name: 'x', description: 'd', body: '' });
    const result = await callAIForCardCopy(parsed, []);
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends prompt to baseUrl and parses valid JSON response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          title: 'AI 标题',
          capabilities: ['c1', 'c2', 'c3'],
          scenarios: ['s1', 's2'],
          examples: [{ title: 'ex', description: 'desc' }],
        }) } }],
      }),
    });

    const parsed = makeParsed({ name: 'x', description: 'desc', body: 'body' });
    const result = await callAIForCardCopy(parsed, []);

    expect(result).not.toBeNull();
    expect(result?.title).toBe('AI 标题');
    expect(result?.capabilities).toEqual(['c1', 'c2', 'c3']);

    // Verify the request did NOT include apiKey in body (header only).
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe('https://example.test/v1/chat/completions');
    const reqInit = callArgs[1];
    expect(reqInit.headers['Authorization']).toBe('Bearer sk-test');
    const bodyStr = reqInit.body as string;
    expect(bodyStr).not.toContain('sk-test'); // not in body
    expect(bodyStr).not.toContain('apiKey');
    expect(bodyStr).not.toContain('baseUrl');
  });

  it('strips ```json fences before parsing', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '```json\n{"title":"x"}\n```' } }],
      }),
    });
    const parsed = makeParsed({ name: 'x', body: '' });
    const result = await callAIForCardCopy(parsed, []);
    expect(result?.title).toBe('x');
  });

  it('returns null on invalid JSON response (fallback path)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'this is not json' } }],
      }),
    });
    const parsed = makeParsed({ name: 'x', body: '' });
    const result = await callAIForCardCopy(parsed, []);
    expect(result).toBeNull();
  });

  it('returns null on non-OK HTTP status', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    const parsed = makeParsed({ name: 'x', body: '' });
    const result = await callAIForCardCopy(parsed, []);
    expect(result).toBeNull();
  });
});

describe('generateSkillCard (end-to-end with real filesystem)', () => {
  let tmpDir: string;
  let skillDir: string;

  beforeEach(async () => {
    mockedGetDefaultModelConfig.mockReset();
    mockedGetDefaultModelConfig.mockResolvedValue(null);

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sm-card-e2e-'));
    skillDir = path.join(tmpDir, 'skills', 'demo');
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(skillDir, 'SKILL.md'),
      '---\nname: demo-skill\ndescription: 这是一个演示 Skill，触发词：写文章、扩写。\n---\n\n# Demo\n\n## 能力一\n## 能力二\n\n## 示例\n\n### 第一个例子\n说明文字\n'
    );
    await fs.ensureDir(path.join(skillDir, 'references'));
    await fs.writeFile(path.join(skillDir, 'references', 'guide.md'), '# Guide\n\n第一段说明文字。');
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('produces html+data without AI', async () => {
    const result = await generateSkillCard(skillDir, { includeAI: false });
    expect(result.html).toContain('demo-skill');
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.data.name).toBe('demo-skill');
    expect(result.data.aiUsed).toBe(false);
    expect(result.data.capabilities.length).toBeGreaterThan(0);
    expect(result.data.references[0]?.name).toBe('guide.md');
  });

  it('throws when SKILL.md is missing', async () => {
    const emptyDir = path.join(tmpDir, 'empty');
    await fs.ensureDir(emptyDir);
    await expect(generateSkillCard(emptyDir, { includeAI: false })).rejects.toThrow(/SKILL.md not found/);
  });
});

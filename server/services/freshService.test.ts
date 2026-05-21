/**
 * freshService — unit tests for SSRF defense pieces and the markdown
 * file-path extractor. The HTTP/redirect path is exercised at integration
 * level (we'd need to mock fetch + DNS to fully cover it; the constituent
 * primitives below are pure and worth locking individually).
 */
import { describe, it, expect } from 'vitest';
import { isPrivateIp, extractFilePaths } from './freshService.js';

describe('isPrivateIp (SSRF defense)', () => {
  it('flags loopback', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('127.255.255.255')).toBe(true);
    expect(isPrivateIp('::1')).toBe(true);
  });

  it('flags RFC1918 private ranges', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('10.255.255.255')).toBe(true);
    expect(isPrivateIp('192.168.0.1')).toBe(true);
    expect(isPrivateIp('192.168.255.255')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
  });

  it('does NOT flag adjacent public ranges (regression: off-by-one in 172.x)', () => {
    expect(isPrivateIp('172.15.0.1')).toBe(false);
    expect(isPrivateIp('172.32.0.1')).toBe(false);
  });

  it('flags AWS metadata link-local (169.254.169.254)', () => {
    expect(isPrivateIp('169.254.169.254')).toBe(true);
    expect(isPrivateIp('169.254.0.1')).toBe(true);
  });

  it('flags IPv6 ULA + link-local', () => {
    expect(isPrivateIp('fc00::1')).toBe(true);
    expect(isPrivateIp('fd00::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
  });

  it('flags IPv4-mapped IPv6 addresses to private v4', () => {
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true);
  });

  it('does NOT flag public addresses', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
    expect(isPrivateIp('2001:4860:4860::8888')).toBe(false);
  });

  it('treats unparseable strings as suspicious (returns true)', () => {
    expect(isPrivateIp('not-an-ip')).toBe(true);
    expect(isPrivateIp('')).toBe(true);
  });
});

describe('extractFilePaths', () => {
  it('finds explicit relative + absolute file references', () => {
    const md = '查看 ./docs/intro.md 与 /usr/share/example.md';
    const paths = extractFilePaths(md);
    expect(paths).toContain('./docs/intro.md');
    expect(paths).toContain('/usr/share/example.md');
  });

  it('ignores URLs', () => {
    const md = '参考 https://example.com/path/to/file.md';
    const paths = extractFilePaths(md);
    expect(paths).not.toContain('https://example.com/path/to/file.md');
  });

  it('ignores // protocol-relative URLs', () => {
    const md = '参考 //cdn.example.com/lib.js';
    const paths = extractFilePaths(md);
    expect(paths.some(p => p.startsWith('//'))).toBe(false);
  });

  it('caps individual path length below 200 chars', () => {
    const longTail = 'a'.repeat(300);
    const md = `参考 ./${longTail}.md`;
    const paths = extractFilePaths(md);
    expect(paths).toEqual([]);
  });
});

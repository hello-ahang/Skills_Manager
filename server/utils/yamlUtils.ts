/**
 * Parse a YAML field that may use multiline block scalar (| or >).
 * Returns the field value as a single-line string with newlines replaced by spaces.
 * 
 * Supports:
 * - Single-line: `description: some text`
 * - Literal block: `description: |` (preserves newlines in YAML, we join them)
 * - Folded block: `description: >` (folds newlines to spaces)
 * - Quoted values: `description: "some text"` or `description: 'some text'`
 * - Chomping indicators: `|+`, `|-`, `>+`, `>-`
 */
export function parseYamlField(frontmatter: string, fieldName: string): string | undefined {
  const lines = frontmatter.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(new RegExp(`^${fieldName}:\\s*(.*)`));
    if (!match) continue;

    const value = match[1].trim();

    // Case 1: Empty value (shouldn't happen for valid YAML, but handle gracefully)
    if (!value) return undefined;

    // Case 2: Block scalar indicator (| or > with optional chomping)
    if (/^[|>][+-]?$/.test(value)) {
      // Collect indented continuation lines
      const contentLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        // Block ends at a non-indented, non-empty line (another YAML key at root level)
        if (nextLine.match(/^\S/)) break;
        // Empty lines within block
        if (nextLine.trim() === '') {
          contentLines.push('');
          continue;
        }
        contentLines.push(nextLine.trim());
      }
      // Join all lines with space, collapse multiple spaces, trim
      const joined = contentLines.join(' ').replace(/\s+/g, ' ').trim();
      return joined || undefined;
    }

    // Case 3: Single-line value (possibly quoted)
    return value.replace(/^['"]|['"]$/g, '');
  }

  return undefined;
}

/**
 * Parse a YAML field that contains a list (array) of strings.
 * Returns an array of strings (empty array if field absent or empty).
 *
 * Supports both flow style and block style:
 * - Flow style: `related: [skill-a, skill-b, "skill-c"]`
 * - Block style:
 *   ```
 *   related:
 *     - skill-a
 *     - skill-b
 *     - "skill-c"
 *   ```
 */
export function parseYamlList(frontmatter: string, fieldName: string): string[] {
  const lines = frontmatter.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(new RegExp(`^${fieldName}:\\s*(.*)`));
    if (!match) continue;

    const value = match[1].trim();

    // Case 1: Flow style - inline array `[a, b, c]`
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim();
      if (!inner) return [];
      return inner
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    }

    // Case 2: Block style - subsequent indented `- item` lines
    if (!value) {
      const items: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j];
        // End of block: non-indented non-empty line (next root key)
        if (next.match(/^\S/)) break;
        const itemMatch = next.match(/^\s*-\s+(.+)$/);
        if (itemMatch) {
          const item = itemMatch[1].trim().replace(/^['"]|['"]$/g, '');
          if (item) items.push(item);
        }
      }
      return items;
    }

    // Case 3: Single value (treat as 1-element list)
    return [value.replace(/^['"]|['"]$/g, '')];
  }

  return [];
}

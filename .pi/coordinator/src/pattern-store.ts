/**
 * Pattern Store — shared pattern library with versioning for real-time sync.
 */

export interface Pattern {
  id: string;
  description: string;
  trigger: string;
  solution: string;
  example_functions: string[];
}

export class PatternStore {
  #patterns: Pattern[];
  #version: number = 0;

  constructor(patterns: Pattern[]) {
    this.#patterns = patterns;
  }

  /**
   * Get all patterns.
   */
  getAll(): Pattern[] {
    return this.#patterns;
  }

  /**
   * Add a new pattern. Throws if ID already exists.
   */
  add(pattern: Pattern): void {
    if (this.#patterns.some((p) => p.id === pattern.id)) {
      throw new Error(`Pattern '${pattern.id}' already exists`);
    }
    this.#patterns.push(pattern);
    this.#version++;
  }

  /**
   * Search patterns by keyword (case-insensitive, checks trigger + solution + description).
   */
  search(keyword: string): Pattern[] {
    const lower = keyword.toLowerCase();
    return this.#patterns.filter(
      (p) =>
        p.trigger.toLowerCase().includes(lower) ||
        p.solution.toLowerCase().includes(lower) ||
        p.description.toLowerCase().includes(lower)
    );
  }

  /**
   * Find patterns relevant to a given assembly string by keyword overlap scoring.
   */
  getRelevantForAsm(asm: string, limit: number): Pattern[] {
    const asmLower = asm.toLowerCase();

    return this.#patterns
      .map((p) => {
        let score = 0;
        const triggerWords = p.trigger.toLowerCase().match(/[a-z_][a-z0-9_]+/g) || [];
        const matchingWords = triggerWords.filter((w) => w.length > 3 && asmLower.includes(w));
        score += matchingWords.length;

        const solWords = p.solution.toLowerCase().match(/[a-z_][a-z0-9_]+/g) || [];
        const solMatches = solWords.filter((w) => w.length > 4 && asmLower.includes(w));
        score += solMatches.length * 0.5;

        return { pattern: p, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.pattern);
  }

  /**
   * Get current version number.
   */
  getVersion(): number {
    return this.#version;
  }

  /**
   * Check if store has been updated since a given version.
   */
  hasUpdatedSince(version: number): boolean {
    return this.#version > version;
  }
}

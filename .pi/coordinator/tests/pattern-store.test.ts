import { describe, test, expect, beforeEach } from "bun:test";
import { PatternStore, type Pattern } from "../src/pattern-store";

describe("PatternStore", () => {
  let ps: PatternStore;

  const samplePatterns: Pattern[] = [
    { id: "pattern-1", description: "Test pattern 1", trigger: "beql branch-likely with store in delay slot", solution: "Use do-while with side effect", example_functions: ["func_A"] },
    { id: "pattern-2", description: "Test pattern 2", trigger: "sll subu addu chain for array offset", solution: "Declare as extern u8[]", example_functions: ["func_B"] },
  ];

  beforeEach(() => {
    ps = new PatternStore(structuredClone(samplePatterns));
  });

  describe("getAll", () => {
    test("returns all patterns", () => {
      expect(ps.getAll().length).toBe(2);
    });
  });

  describe("add", () => {
    test("adds a new pattern", () => {
      ps.add({ id: "pattern-3", description: "New", trigger: "x", solution: "y", example_functions: [] });
      expect(ps.getAll().length).toBe(3);
    });

    test("rejects duplicate IDs", () => {
      expect(() => ps.add({ id: "pattern-1", description: "Dup", trigger: "x", solution: "y", example_functions: [] })).toThrow(/exists/i);
    });
  });

  describe("search", () => {
    test("finds patterns by keyword in trigger", () => {
      const results = ps.search("branch-likely");
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("pattern-1");
    });

    test("finds patterns by keyword in solution", () => {
      const results = ps.search("do-while");
      expect(results.length).toBe(1);
    });

    test("case-insensitive search", () => {
      const results = ps.search("BEQL");
      expect(results.length).toBe(1);
    });

    test("returns empty for no match", () => {
      const results = ps.search("xyznonexistent");
      expect(results.length).toBe(0);
    });
  });

  describe("getRelevantForAsm", () => {
    test("scores patterns by keyword overlap with assembly", () => {
      const asm = "beql $t0, $zero, .L_END\naddiu $s0, $s0, 0xC";
      const relevant = ps.getRelevantForAsm(asm, 5);
      expect(relevant.length).toBeGreaterThan(0);
      expect(relevant[0].id).toBe("pattern-1"); // "beql" matches trigger
    });

    test("limits results to N", () => {
      const asm = "beql sll subu addu chain branch-likely";
      const relevant = ps.getRelevantForAsm(asm, 1);
      expect(relevant.length).toBe(1);
    });
  });

  describe("version tracking", () => {
    test("increments version on add", () => {
      const v1 = ps.getVersion();
      ps.add({ id: "pattern-new", description: "x", trigger: "y", solution: "z", example_functions: [] });
      const v2 = ps.getVersion();
      expect(v2).toBeGreaterThan(v1);
    });

    test("lanes can check if they need to refresh", () => {
      const v1 = ps.getVersion();
      ps.add({ id: "p-new", description: "x", trigger: "y", solution: "z", example_functions: [] });
      expect(ps.hasUpdatedSince(v1)).toBe(true);
      expect(ps.hasUpdatedSince(ps.getVersion())).toBe(false);
    });
  });
});

#!/usr/bin/env python3
"""Normalize MIPS assembly for matching comparison.

Reads two inputs:
  1. Target assembly file (from asm/nonmatchings/)
  2. Generated assembly (from objdump -dr output on stdin or file)

Outputs normalized versions suitable for line-by-line diff.
Normalization:
  - Strips address prefixes and hex offsets
  - Replaces relocation targets with symbolic placeholders
  - Normalizes branch labels to sequential numbers
  - Normalizes register names to canonical form
  - Strips comments and trailing whitespace
"""

import re
import sys
import json


def canonicalize_instruction(instr: str) -> str:
    """Canonicalize an instruction to a common format for comparison."""
    instr = instr.strip()
    if not instr:
        return instr

    # Strip $ prefix from registers
    instr = re.sub(r'\$([a-z][a-z0-9]*)', r'\1', instr)

    # Normalize whitespace: collapse multiple spaces/tabs to single space
    instr = re.sub(r'[\t ]+', ' ', instr)

    # Normalize hex: 0xNN → decimal for small immediates in offsets
    # But keep %hi/%lo symbolic
    def hex_to_dec(m):
        val = int(m.group(1), 16)
        return str(val)
    # Only convert bare hex in memory offsets like 0x4($sp) → 4(sp)
    instr = re.sub(r'0x([0-9A-Fa-f]+)\(', lambda m: f"{int(m.group(1),16)}(", instr)
    # Convert standalone 0x immediates: addiu $t6, $zero, 0x1 → addiu t6, zero, 1
    instr = re.sub(r',\s*0x([0-9A-Fa-f]+)$', lambda m: f", {int(m.group(1),16)}", instr)
    instr = re.sub(r',\s*0x([0-9A-Fa-f]+),', lambda m: f", {int(m.group(1),16)},", instr)
    # -0xNN → negative decimal
    instr = re.sub(r'-0x([0-9A-Fa-f]+)', lambda m: f"-{int(m.group(1),16)}", instr)

    # Normalize pseudo-instructions:
    # "or REG, REG2, zero" → "move REG, REG2"
    m2 = re.match(r'or (\w+), (\w+), zero$', instr)
    if m2:
        instr = f"move {m2.group(1)}, {m2.group(2)}"

    # "addiu REG, zero, IMM" → "li REG, IMM"
    m2 = re.match(r'addiu (\w+), zero, (.+)$', instr)
    if m2:
        instr = f"li {m2.group(1)}, {m2.group(2)}"

    # "or REG, zero, zero" → "move REG, zero"
    m2 = re.match(r'or (\w+), zero, zero$', instr)
    if m2:
        instr = f"move {m2.group(1)}, zero"

    # "beql REG, zero, ..." → "beqzl REG, ..."
    m2 = re.match(r'(beql|bnel) (\w+), zero, (.+)$', instr)
    if m2:
        op = 'beqzl' if m2.group(1) == 'beql' else 'bnezl'
        instr = f"{op} {m2.group(2)}, {m2.group(3)}"
    m2 = re.match(r'(beq|bne) (\w+), zero, (.+)$', instr)
    if m2:
        op = 'beqz' if m2.group(1) == 'beq' else 'bnez'
        instr = f"{op} {m2.group(2)}, {m2.group(3)}"

    # Normalize shifted-constant expressions from splat: (0xNNNNN >> 16) → decimal
    instr = re.sub(r'\(0x([0-9A-Fa-f]+)\s*>>\s*(\d+)\)', lambda m: str(int(m.group(1), 16) >> int(m.group(2))), instr)
    instr = re.sub(r'\(0x([0-9A-Fa-f]+)\s*&\s*0x([0-9A-Fa-f]+)\)', lambda m: str(int(m.group(1), 16) & int(m.group(2), 16)), instr)

    # Normalize %hi/%lo to just the symbol name
    instr = re.sub(r'%hi\(([^)]+)\)', r'HI(\1)', instr)
    instr = re.sub(r'%lo\(([^)]+)\)', r'LO(\1)', instr)

    # Normalize comma spacing: "sw a1, 4(sp)" → "sw a1,4(sp)" isn't right
    # Actually normalize to consistent: op arg1, arg2, arg3 (space after comma)
    instr = re.sub(r',\s*', ', ', instr)

    # Normalize space between op and operands
    parts = instr.split(None, 1)
    if len(parts) == 2:
        instr = f"{parts[0]} {parts[1]}"

    # Strip leading whitespace from delay-slot indicator
    instr = instr.lstrip()

    return instr


def normalize_target_line(line: str) -> str | None:
    """Normalize a line from the target .s file (splat format)."""
    line = line.strip()
    if not line or line.startswith("glabel") or line.startswith("."):
        # Keep .L labels as branch targets
        if line.startswith(".L"):
            return None  # handled by branch normalization
        return None

    # Format: /* ADDR VADDR HEX */ instruction
    m = re.match(r'/\*.*?\*/\s*(.*)', line)
    if m:
        instr = m.group(1).strip()
    else:
        instr = line

    # Strip trailing comments
    instr = re.sub(r'\s*//.*$', '', instr)
    instr = re.sub(r'\s*/\*.*?\*/', '', instr)
    instr = instr.strip()
    if not instr:
        return None
    return canonicalize_instruction(instr)


def normalize_objdump_line(line: str) -> str | None:
    """Normalize a line from objdump -dr output."""
    line = line.strip()
    if not line:
        return None

    # Skip function labels like "00001234 <func_name>:"
    if re.match(r'^[0-9a-f]+\s+<', line):
        return None

    # Skip relocation lines like "    1234: R_MIPS_..."
    if 'R_MIPS' in line:
        return None

    # Format: "    addr: hexbytes  instruction"
    m = re.match(r'\s*[0-9a-f]+:\s+[0-9a-f]+\s+(.*)', line)
    if m:
        instr = m.group(1).strip()
        if not instr:
            return None
        # objdump may have <label+offset> suffixes — strip them
        instr = re.sub(r'\s*<[^>]+>', '', instr)
        return canonicalize_instruction(instr)

    return None


def apply_relocations(lines: list[str], raw_text: str) -> list[str]:
    """Post-process objdump output to replace 0-value immediates with relocation symbols."""
    # Find relocation lines and map them to preceding instruction addresses
    reloc_map: dict[str, str] = {}  # addr -> symbol
    for m in re.finditer(r'\s*([0-9a-f]+):\s+R_MIPS_(?:HI16|LO16|26)\s+(\S+)', raw_text):
        reloc_map[m.group(1)] = m.group(2)

    if not reloc_map:
        return lines

    # For each instruction line in raw_text, check if its addr has a relocation
    result = []
    instr_addrs: list[str] = []
    for raw_line in raw_text.splitlines():
        m = re.match(r'\s*([0-9a-f]+):\s+[0-9a-f]+\s+', raw_line)
        if m and 'R_MIPS' not in raw_line:
            instr_addrs.append(m.group(1))

    # Now match instructions to their relocations
    idx = 0
    for line in lines:
        if idx < len(instr_addrs):
            addr = instr_addrs[idx]
            if addr in reloc_map:
                sym = reloc_map[addr]
                # Replace the 0 immediate with symbol reference
                # lui reg, 0 → lui reg, HI(SYM)
                line = re.sub(r'lui (\w+), 0$', f'lui \\1, HI({sym})', line)
                # lw/sw/etc reg, 0(reg) → reg, LO(SYM)(reg)
                line = re.sub(r', 0\((\w+)\)$', f', LO({sym})(\\1)', line)
                # addiu reg, reg, 0 → addiu reg, reg, LO(SYM)
                line = re.sub(r', 0$', f', LO({sym})', line)
                # jal 0 → jal SYM (R_MIPS_26)
                line = re.sub(r'jal 0$', f'jal {sym}', line)
        idx += 1
        result.append(line)

    return result


BRANCH_OPS_SET = {
    'beq', 'bne', 'beqz', 'bnez', 'blez', 'bgtz', 'bltz', 'bgez',
    'beql', 'bnel', 'beqzl', 'bnezl', 'blezl', 'bgtzl', 'bltzl', 'bgezl',
    'bc1t', 'bc1f', 'bc1tl', 'bc1fl', 'b', 'j',
}


def normalize_branch_labels(lines: list[str]) -> list[str]:
    """Replace branch targets with sequential labels."""
    label_map: dict[str, str] = {}
    counter = [0]

    def get_label(target: str) -> str:
        if target not in label_map:
            label_map[target] = f"L{counter[0]}"
            counter[0] += 1
        return label_map[target]

    result = []
    for line in lines:
        # Replace .L labels (from target asm): .L15168AE4 etc
        line = re.sub(r'\.L[0-9A-Fa-f]+', lambda m: get_label(m.group(0)), line)

        # Replace raw hex branch targets in branch instructions (from objdump)
        # Pattern: branch_op ..., <hex_addr> at end of line
        parts = line.split(None, 1)
        if len(parts) == 2:
            op = parts[0].rstrip(',')
            if op in BRANCH_OPS_SET:
                # The last operand might be a hex address
                line = re.sub(r'\b([0-9a-f]{2,8})$', lambda m: get_label(m.group(1)), line)

        result.append(line)

    return result


def normalize_relocs(lines: list[str]) -> list[str]:
    """Normalize %hi/%lo and relocation references."""
    result = []
    for line in lines:
        # %hi(SYMBOL) → %hi(SYM)
        # %lo(SYMBOL) → %lo(SYM)
        # These are already symbolic, keep as-is
        result.append(line)
    return result


def parse_target_asm(filepath: str) -> list[str]:
    """Parse target assembly file, return normalized instruction list."""
    lines = []
    with open(filepath) as f:
        for raw in f:
            norm = normalize_target_line(raw)
            if norm:
                lines.append(norm)
    return lines


def parse_objdump(text: str) -> list[str]:
    """Parse objdump output, return normalized instruction list."""
    lines = []
    for raw in text.splitlines():
        norm = normalize_objdump_line(raw)
        if norm:
            lines.append(norm)
    # Apply relocation symbols
    lines = apply_relocations(lines, text)
    return lines


def compute_score(target: list[str], generated: list[str]) -> dict:
    """Compute match score between normalized target and generated assembly."""
    if not target or not generated:
        return {"match": False, "score": 0.0, "reason": "empty"}

    if len(target) != len(generated):
        # Length mismatch — structural difference
        score = 1.0 - abs(len(target) - len(generated)) / max(len(target), len(generated))
        return {
            "match": False,
            "score": max(0.0, score * 0.5),
            "reason": f"length_mismatch (target={len(target)}, generated={len(generated)})",
        }

    # Line-by-line comparison
    matches = 0
    reg_only_diffs = 0
    other_diffs = 0
    diff_lines = []

    for i, (t, g) in enumerate(zip(target, generated)):
        if t == g:
            matches += 1
        else:
            # Check if only register names differ
            t_normed = re.sub(r'\$[a-z0-9]+', '$REG', t)
            g_normed = re.sub(r'\$[a-z0-9]+', '$REG', g)
            if t_normed == g_normed:
                reg_only_diffs += 1
                diff_lines.append({"line": i, "type": "register", "target": t, "generated": g})
            else:
                other_diffs += 1
                diff_lines.append({"line": i, "type": "structural", "target": t, "generated": g})

    total = len(target)
    if other_diffs == 0 and reg_only_diffs == 0:
        return {"match": True, "score": 1.0, "diffs": []}

    score = matches / total
    if other_diffs == 0:
        score = 0.95 + (0.05 * matches / total)  # reg-only diffs

    reasons = []
    if reg_only_diffs > 0:
        reasons.append(f"register_diffs={reg_only_diffs}")
    if other_diffs > 0:
        reasons.append(f"structural_diffs={other_diffs}")

    return {
        "match": False,
        "score": round(score, 4),
        "reason": ", ".join(reasons),
        "diffs": diff_lines[:20],  # cap at 20 for readability
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: conker-normalize-asm.py <target.s> [generated_objdump_file]")
        print("       If no second file, reads objdump from stdin")
        sys.exit(1)

    target_file = sys.argv[1]
    target_lines = parse_target_asm(target_file)

    if len(sys.argv) >= 3:
        with open(sys.argv[2]) as f:
            gen_text = f.read()
    else:
        gen_text = sys.stdin.read()

    gen_lines = parse_objdump(gen_text)

    # Normalize branch labels in both
    target_lines = normalize_branch_labels(target_lines)
    gen_lines = normalize_branch_labels(gen_lines)

    result = compute_score(target_lines, gen_lines)
    result["target_instructions"] = len(target_lines)
    result["generated_instructions"] = len(gen_lines)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

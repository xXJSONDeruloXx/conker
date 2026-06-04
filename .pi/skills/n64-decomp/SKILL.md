---
name: n64-decomp
description: IDO 5.3 matching decompilation patterns, codegen rules, diff interpretation, and register-shaping tactics for Conker's Bad Fur Day. Use when decompiling GLOBAL_ASM functions, interpreting assembly diffs, or debugging non-matching code shapes.
---

# N64 Matching Decompilation — IDO 5.3 Patterns

## Dynamic Pattern Library

Beyond this static guide, there are **122+ patterns** discovered during this project stored in `.pi/decomp/patterns.json`. These are auto-served with each candidate by `decomp_queue next` (matched by keywords in the target assembly). To browse the full library: `decomp_status detail="patterns"`. Patterns include specific IDO quirks like `sameline` effects, stack-array padding, negative-index outparams, and bitfield scheduling.

## Compiler: IDO 5.3

Conker was compiled with SGI IDO 5.3 (`cc -O2 -g3 -mips2 -o32`). Key behaviors:

### Register Allocation

- IDO allocates registers in **declaration order**. The first local variable gets the lowest available temp register.
- Changing the order of local variable declarations can swap `$t6`/`$t7` assignments.
- Function arguments use `$a0-$a3`. Arguments saved to the stack are reloaded from their stack slots, not kept in arg registers.
- `u8` parameters: IDO may reload the low byte from the stack (`lbu $reg, offset($sp)`) instead of keeping the full register.
- Unused function parameters still consume argument register slots.

### Expression Ordering

- The order of subexpressions in arithmetic affects which register gets which intermediate result.
- `(a * 12) + (b * 3)` allocates differently than `(b * 3) + (a * 12)`.
- Naming intermediates as local variables can force a specific evaluation order.

### Branch Shapes

- `if (x) { ... }` with a single statement often produces `beqzl` (branch-likely).
- `if (x != 0)` vs `if (x)` can produce different branch encodings.
- IDO uses `beql`/`bnel` (branch-likely) when there's useful work for the delay slot.
- `do { } while (cond)` produces tighter loops than `for` or `while` in many cases.

### Addressing and Globals

- **Critical**: Declare globals as `extern u8 TABLE[]` (byte-addressed) when the target uses manual stride math (`sll`/`subu`/`addu` chains). Pointer-array declarations (`extern struct *TABLE[]`) produce different multiplication sequences.
- `%hi(SYMBOL)` / `%lo(SYMBOL)` pairs: IDO hoists the `lui` early. The `addiu %lo` scheduling relative to branch/delay-slot can differ based on when the variable is first used.
- Symbols in `undefined_syms_auto.txt` need local `extern` declarations.

### Stack Frame

- Functions with calls always save `$ra` and allocate a frame.
- The number of saved registers (`$s0-$s7`) depends on how many locals survive across calls.
- Adding an unused `volatile` local or extra parameter can inflate the frame size (useful for matching).
- IDO sometimes saves `$s0` even when the function doesn't obviously need it — artificial register pressure.

### Floating Point

- FPR allocation follows declaration order of `f32`/`f64` locals.
- The order of loads from a float array (`arg0[0]`, `arg0[1]`, `arg0[2]`) directly maps to `$f2`, `$f12`, `$f14` etc.
- Naming float locals explicitly steers FPR assignment: `f32 temp_f2 = arg0[0]; f32 temp_f12 = arg0[1];`

## Common IDO Patterns

### Pattern: Byte-Addressed Table

**Trigger**: Target uses `sll`/`subu`/`addu` chain for array offset (not simple indexed load).

**Solution**: Declare the table as `extern u8 TABLE[]` and compute the byte offset manually:
```c
extern u8 D_800DCE50[];
struct12 **entry = (struct12 **)&D_800DCE50[(field1 * 0x1A0) + (field2 * 4)];
```

### Pattern: u8 Argument Stack Reload

**Trigger**: Target has `lbu` from a stack offset matching an argument position.

**Solution**: Change the parameter type to `u8`:
```c
void func(u8 arg0, ...) // NOT s32 arg0
```

### Pattern: Declaration-Order Register Swap

**Trigger**: Generated assembly uses the right instructions but wrong register numbers.

**Solution**: Reorder local variable declarations to match the target register assignment:
```c
// If target uses $v0 for count and $v1 for limit:
s8 temp_v0;  // allocated first → $v0 region
s8 temp_v1;  // allocated second → $v1 region
temp_v0 = 0;
temp_v1 = D_GLOBAL;
```

### Pattern: Implicit Argument (no-arg callers)

**Trigger**: Callers don't pass `$a0` explicitly but the callee uses it.

**Solution**: The callee should still declare the parameter. IDO's ABI passes `$a0` regardless:
```c
void func(struct102 *arg0) {  // $a0 is set by caller's context
    // use arg0 freely
}
```

### Pattern: Linked-List Traversal (branch-likely)

**Trigger**: Target uses `beql`/`bnel` for list walking with useful delay-slot work.

**Solution**: Use pointer-based `do { } while` with side effects in the condition:
```c
do {
    // work
    ptr = ptr->next;
} while (ptr != NULL);
```

### Pattern: Volatile Double-Store

**Trigger**: Target stores to the same address twice (mask then add).

**Solution**: Use a `volatile` cast or separate store statements:
```c
volatile s32 *word = (volatile s32 *)(ptr + 4);
s32 masked = *word & 0x00FFFFFF;
*word = masked;
*word = masked + offset;
```

## Diff Interpretation Guide

When `decomp_attempt` returns a non-match:

1. **Score 0.95+, register-only diffs**: Try reordering declarations or changing arg types.
2. **Score 0.8-0.95, same structure**: Likely scheduling/delay-slot issue — try assignment reordering.
3. **Score 0.5-0.8, branch shape differs**: Loop structure wrong — try `do/while` vs `for`, or `if` nesting changes.
4. **Score <0.5, structural mismatch**: Fundamentally wrong approach — re-read the target more carefully.

### Failure Reason Tags

- `register_diffs`: Only register names differ (high chance of fix with declaration reorder)
- `structural_diffs`: Instruction sequence differs (harder, may need expression reshaping)
- `length_mismatch`: Different instruction count (wrong control flow or extra/missing operations)
- `compile_error`: C didn't compile (syntax, missing symbols, type errors)

## Multi-Iteration Tactics

When stuck on a hard function after 2-3 attempts:

1. **Try the opposite loop form**: `for` → `do/while`, `while` → pointer increment
2. **Try explicit intermediates**: Break expressions into named locals
3. **Try removing intermediates**: Combine expressions
4. **Try volatile for multi-store**: `volatile` pointer for MMIO or deliberate double-store
5. **Try cast expressions**: `*(type *)((s32)ptr + offset)` for raw memory access
6. **Check the caller**: Sometimes the caller's codegen reveals the expected signature
7. **Skip after 5 attempts**: Move to next candidate, come back with fresh patterns later

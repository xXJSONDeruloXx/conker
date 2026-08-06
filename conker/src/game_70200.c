#include <ultra64.h>

#define func_15043BB8 func_15043BB8_header_mismatch
#include "functions.h"
#undef func_15043BB8
#include "variables.h"

#include "libc/stdarg.h"


void func_15042D50(void) {
    D_800CBD64 = 0;
    func_15043384(0);
}

void func_15042D78(u8 arg0) {
    D_800CBD74 = arg0;
}

void func_15042D94(s32 arg0, s32 arg1, u8 arg2, s32 arg3, ...) {
    va_list ap;
    s32 args[16];
    s32 i;

    D_800CBD74 = arg2;
    D_800CBD70 = arg0;
    D_800CBD72 = arg1;

    va_start(ap, arg3);
    for (i = 0; i < 16; i++) {
        args[i] = va_arg(ap, s32);
    }
    func_15042ECC(arg3, args);
}
void func_15042E3C(s32 arg0, ...) {
    va_list ap;
    s32 args[16];
    s32 i;

    va_start(ap, arg0);
    for (i = 0; i < 16; i++) {
        args[i] = va_arg(ap, s32);
    }
    func_15042ECC(arg0, args);
}
#pragma GLOBAL_ASM("asm/nonmatchings/game_70200/func_15042ECC.s")

void func_150432BC(f32 arg0) {
    D_800CBD80 = arg0;
}

void func_150432CC(s32 arg0, s32 arg1) {
    D_800CBD74 = D_800CBD74 | 1;
    D_800CBD74 = D_800CBD74;
    D_800CBD7C = arg1;
    D_800CBD78 = arg0;
}

void func_150432FC(s16 arg0, s16 arg1) {
    D_800CBD70 = arg0;
    D_800CBD72 = arg1;
}

void func_1504332C(u8 arg0, u8 arg1, u8 arg2, u8 arg3) {
    D_800CBD60 = arg0;
    D_800CBD61 = arg1;
    D_800CBD62 = arg2;
    D_800CBD63 = arg3;
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_70200/func_15043384.s")

void func_15043A00(struct105 *arg0, s32 arg1, s32 arg2) {
    if (arg0 != 0) {
        arg0->unk0 = arg1; // are these structs?
        arg0->unk4 = arg2;
        arg0->unkC = 0;
        arg0->unk8 = 0;
    }
}

// something with memcpy
s32 func_15043A20(void *arg0, s32 arg1, s32 arg2, void *arg3, s32 arg4) {
    s32 chunk;

    while (arg4 != 0) {
        if (arg1 < arg2 + arg4) {
            chunk = arg1 - arg2;
        } else {
            chunk = arg4;
        }
        memcpy((s8 *)arg0 + arg2, arg3, chunk);
        arg2 += chunk;
        arg3 = (s8 *)arg3 + chunk;
        arg4 -= chunk;
        if (arg2 >= arg1) {
            arg2 = 0;
        }
    }
    return arg2;
}
s32 func_15043AC8(void *arg0, s32 arg1, s32 arg2, void *arg3, s32 arg4) {
    s32 chunk;

    while (arg4 != 0) {
        if (arg1 < arg2 + arg4) {
            chunk = arg1 - arg2;
        } else {
            chunk = arg4;
        }
        memcpy(arg3, (s8 *)arg0 + arg2, chunk);
        arg2 += chunk;
        arg3 = (s8 *)arg3 + chunk;
        arg4 -= chunk;
        if (arg2 >= arg1) {
            arg2 = 0;
        }
    }
    return arg2;
}

s32 func_15043B70(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 temp_v0;

    while (arg3 != 0) {
        if (arg1 < arg2 + arg3) {
            temp_v0 = arg1 - arg2;
        } else {
            temp_v0 = arg3;
        }
        arg2 += temp_v0;
        arg3 -= temp_v0;
        if (arg2 >= arg1) {
            arg2 = 0;
        }
    }
    return arg2;
}

s32 func_15043BB8(struct105 *arg0, u8 *arg1, s32 arg2) {
    s32 head;
    s32 tail;

    if (arg2 != 0) {
        if (arg1 != 0) {
            arg2 += 4;
            arg2 = (arg2 + 3) & ~3;
            tail = arg0->unkC;
            head = arg0->unk8;
            if (tail < head) {
                if (tail + arg2 >= head) {
                    return 1;
                }
            } else if ((tail + arg2) - arg0->unk4 >= head) {
                return 1;
            }
            arg2 -= 4;
            arg0->unkC = func_15043A20((u8 *)arg0->unk0, arg0->unk4, func_15043A20((u8 *)arg0->unk0, arg0->unk4, tail, (u8 *)&arg2, 4), arg1, arg2);
        }
    }
    return 0;
}

s32 func_15043CA4(struct105 *arg0, u8 *arg1, s32 arg2) {
    s32 v1;
    s32 sp30;
    s32 head;
    s32 ret;

    sp30 = 0;
    head = arg0->unk8;
    if (head == arg0->unkC) {
        return 0;
    }
    ret = func_15043AC8((u8 *)arg0->unk0, arg0->unk4, head, (u8 *)&sp30, 4);
    v1 = sp30;
    if (arg2 < v1) {
        arg2 -= 1;
        ret = func_15043AC8((u8 *)arg0->unk0, arg0->unk4, ret, arg1, arg2);
        arg1[arg2] = 0;
        ret = func_15043B70((u8 *)arg0->unk0, arg0->unk4, ret, sp30 - arg2);
    } else if (v1 != 0) {
        ret = func_15043AC8((u8 *)arg0->unk0, arg0->unk4, ret, arg1, sp30);
    }
    arg0->unk8 = ret;
    return sp30;
}

#include <ultra64.h>
#include "functions.h"
#include "variables.h"

extern f32 D_800A45B0;

extern f32 D_800A461C;
extern f32 D_800A4620;
void func_15134908(void *, s32, u8, s32);

void func_151BC5A4(struct102 *, s32, u8);

void func_15145EA4(s32 *, s32 *, s32, s32);

extern f32 D_800A4828;

// requires jump table
#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15134070.s")

s32 func_1513416C(struct102 *arg0) {
    s16 temp_v0 = arg0->unk1C;
    if (temp_v0 < 32) {
        arg0->unk28 = temp_v0 * 8;
    }
    return 1;
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_1513418C.s")
// void *func_1513418C(s32 arg0, s32 arg1 /* size/offset */, u8 arg2, s32 arg3) {
//     void *sp24;
//     s32 temp_v1;
//     u8 temp_a0;
//     void *temp_ret;
//     void *temp_v0;
//     struct127 *temp_v0_2;
//
//     temp_ret = func_15167A68(0x28, arg3, arg1 + 0x58, 1, arg2, 1);
//     temp_v0 = temp_ret;
//     if (temp_v0 == 0) {
//         return NULL;
//     }
//     sp24 = temp_v0;
//     memcpy(&temp_v0->unk10, arg0, 0x30); //, temp_v0);
//     temp_a0 = temp_v0->unk3A;
//     if ((temp_a0 & 2) != 0) {
//         temp_v0_2 = temp_v0->unk1C;
//         if ((temp_v0_2->unk0 == 0) || (temp_v0->unk18 != temp_v0_2->unk3B)) {
//             func_1516972C(temp_v0);
//             return NULL;
//         }
//         temp_v1 = temp_v0_2->unk1D4;
//         if ((temp_v1 != 0) && ((temp_v0_2->unk74 & 0xF) != 0xF)) {
//             sp24 = temp_v0;
//             func_15143134(temp_v0->unk24, temp_v0->unk40, temp_v1 + (temp_v0->unk20 << 6), temp_v0);
//         } else {
//             temp_v0->unk3A = (u8) (temp_a0 | 8);
//         }
//     } else {
//         temp_v0->unk3A = (u8) (temp_a0 | 0x18);
//     }
//     temp_ret->unk50 = 0.0f;
//     temp_ret->unk4C = (f32) (1.0f / (2.0f * temp_ret->unk30));
//     return temp_ret;
// }

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_151342BC.s")

s32 func_151346D0(s32 arg0, struct102 *arg1, s32 arg2) {
    arg1->unk3A &= 0xFFEF;
    return arg0;
}

void func_151346EC(struct102 *arg0) {
    func_15169804(arg0);
}

void func_1513470C(struct102 *arg0) {
    func_15169824(arg0);
}

void func_1513472C(struct102 *arg0) {
    s32 idx = arg0->unk3D;
    if (idx < 0) {
        idx = 0;
    }
    if (idx >= 10) {
        idx = 0;
    }
    D_80089AAC[idx]();
}

void func_1513477C(struct102 *arg0) {
  s32 idx = arg0->unk3D;
  if (idx < 0) {
      idx = 0;
  }
  if (idx >= 10) {
      idx = 0;
  }
    D_80089AD4[idx]();
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_151347CC.s")

void func_151348F0(f32 arg0, f32 arg1, s32 arg2, s32 arg3) {
}


#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15134908.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_151349D0.s")

void func_15134C98(struct102 *arg0, s32 arg1, u8 arg2) {
    if (*(u8 *)((s32)arg0 + 0x28) == 1) {
        func_151BC5A4(arg0, arg1, arg2);
    }
}

void func_15134CD4(f32 arg0, f32 arg1, s32 arg2, s32 arg3) {
}


s32 func_15134CEC(void *arg0) {
    s32 temp_v1;

    *(f32 *)((s32)arg0 + 0x70) += 0.125f * D_800BE9A4;
    temp_v1 = *(u8 *)((s32)arg0 + 0x2E);
    *(f32 *)((s32)arg0 + 0x74) += D_800A45B0 * D_800BE9A4;
    *(f32 *)((s32)arg0 + 0x14) += *(f32 *)((s32)arg0 + 0x70) * D_800BE9A4;
    *(f32 *)((s32)arg0 + 0x1C) += *(f32 *)((s32)arg0 + 0x74) * D_800BE9A4;
    if (130.0f < *(f32 *)((s32)arg0 + 0x14)) {
        return 0;
    }
    temp_v1 -= D_800BE9E4 * 2;
    if (temp_v1 < 0) {
        return 0;
    }
    *(u8 *)((s32)arg0 + 0x2E) = temp_v1;
    return 1;
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15134DAC.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15134E48.s")

void func_151352EC(struct102 *arg0) {
    func_15169804(arg0);
}


void func_1513530C(struct102 *arg0) {
    func_15169824(arg0);
}


extern void (*D_80089B70[])(struct102 *);
void func_1513532C(struct102 *arg0) {
    u16 temp_a0;
    s32 idx = *(u8 *)((s32)arg0 + 0x50);
    if (idx < 0) {
        idx = 0;
    } else if (idx < 6) {
    } else {
        idx = 0;
    }
    temp_a0 = *(u16 *)((s32)arg0 + 0x44);
    if (temp_a0 != 0) {
        func_100111C8(temp_a0);
        *(u16 *)((s32)arg0 + 0x44) = 0;
    }
    D_80089B70[idx](arg0);
}

extern void (*D_80089B88[])(struct102 *);
void func_151353A8(struct102 *arg0) {
    u16 temp_a0;
    s32 idx = *(u8 *)((s32)arg0 + 0x50);
    if (idx < 0) {
        idx = 0;
    } else if (idx < 6) {
    } else {
        idx = 0;
    }
    temp_a0 = *(u16 *)((s32)arg0 + 0x44);
    if (temp_a0 != 0) {
        func_100111C8(temp_a0);
        *(u16 *)((s32)arg0 + 0x44) = 0;
    }
    D_80089B88[idx](arg0);
}

void func_15135424(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4) {
    s32 local1[2];
    s32 local2[2];
    
    local1[0] = arg1;
    local1[1] = arg2;
    local2[0] = arg3;
    local2[1] = arg4;
    func_15145EA4(local1, local2, arg0, 2);
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15135480.s")

void func_1513555C(struct102 *arg0, u8 *arg1, u8 arg2) {
    if (arg2 == 0 || arg2 == 0x12) {
        if (*(s32 *)arg1 == *(s32 *)((u8 *)arg0 + 0x1C) || arg1[4] == ((u8 *)arg0)[0x18]) {
            func_1516972C(arg0);
        }
    }
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_151355B8.s")

s32 func_15135658(struct259 *arg0) {
    arg0->unk74 = 1.0f;
    return 1;
}


f32 func_15135670(s32 arg0) {
    // "power", "../Effects/Blood/blood.c"
    return func_151422DC(0, &D_800A3FB4, 0, 2000, 1000, &D_800A3FBC, 2938) * D_800A45B4;
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_151356D4.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15135BF8.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15135DD0.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15136404.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15136698.s")

s32 func_151368A8(struct102 *arg0) {
    s16 temp_v0 = arg0->unk1C;
    f32 *temp_v1 = (f32 *)((s32)arg0 + 0x128);
    volatile f32 *temp_a1 = &D_800BE9A4;
    s32 temp;
    if (temp_v0 < 0x20) {
        temp = temp_v0 << 3;
        if (temp < *((u8 *)arg0 + 0x5C)) {
            *((u8 *)arg0 + 0x5C) = temp;
        }
    }
    *(f32 *)((s32)arg0 + 0x2C) += *temp_v1 * *temp_a1;
    *(f32 *)((s32)arg0 + 0x30) += *temp_v1 * *temp_a1;
    return 1;
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15136918.s")

s32 func_15136A1C(struct102 *arg0) {
    s16 temp_v0 = arg0->unk1C;
    s32 temp_v1;

    if (temp_v0 < 0x20) {
        temp_v1 = temp_v0 << 3;
        if (temp_v1 < arg0->unk28) {
            arg0->unk28 = temp_v1;
        }
    }
    return 1;
}


void func_15136A50(s32 arg0, s32 arg1, s32 arg2, s16 arg3, u8 arg4, s32 arg5) {
    u8 sp1C[0x1A];

    *(s32 *)&sp1C[0] = arg0;
    *(s32 *)&sp1C[4] = arg1;
    *(s32 *)&sp1C[8] = arg2;
    *(f32 *)&sp1C[0xC] = D_800A461C;
    *(f32 *)&sp1C[0x10] = D_800A4620;
    *(s16 *)&sp1C[0x14] = arg3;
    sp1C[0x16] = 5;
    sp1C[0x17] = 5;
    sp1C[0x18] = 2;
    *(s8 *)&sp1C[0x19] = -1;
    func_15134908(sp1C, 0, arg4, arg5);
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15136AE4.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15136C3C.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15136F50.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15137610.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_1513783C.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15137C64.s")

s32 func_15137E10(struct259 *arg0) {
    arg0->unk74 = ((func_150ADA68() * 50.0f) + 580.0f) * D_800A4828;
    return 1;
}


#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15137E60.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15137F30.s")

extern u8 D_800A3FD8[];
void func_15143134(void *, s32, s32);
s32 func_151380B4(u8 *arg0, s32 arg1, s32 arg2) {
    s32 temp_v0 = *(s32 *)(arg0 + 0x1D4);
    if (temp_v0 != 0) {
        goto nonzero;
    }
    return 0;
nonzero:
    if ((arg0[0x74] & 0xF) == 0xF) {
        return 0;
    }
    func_15143134(&D_800A3FD8[arg1 << 4], arg2, temp_v0 + 0x300);
    return 1;
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15138120.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_151382E0.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15138424.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_151389A8.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15138BC0.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15138C80.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15138E98.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15139578.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15139768.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15139D74.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_1513A24C.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_1513A48C.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_1513A594.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_1513A5E0.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_1513A6E0.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_1513ABB8.s")

void func_1513B0B8(void *arg0, s32 arg1, u8 arg2) {
    s32 *temp_v0 = (s32 *)((s32)arg0 + 0x170);

    if (arg2 == 0x45) {
        if (--(*temp_v0) < 0) {
            *(s32 *)((s32)arg0 + 0x60) |= 0x80;
        }
    }
}


#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_1513B0F8.s")

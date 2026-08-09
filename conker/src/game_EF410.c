#include <ultra64.h>

#include "functions.h"
#include "variables.h"

extern f32 D_800A0280;
extern f32 D_800A0284;
void func_15134908(void *, s32, u8, s32);


#pragma GLOBAL_ASM("asm/nonmatchings/game_EF410/func_150C1F60.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_EF410/func_150C2290.s")
// TODO: figure out this struct!
// void func_150C2290(s32 arg0) {
//     s16 sp9A;
//     s16 sp98;
//     s8 sp95;
//     s8 sp94;
//     ?32 sp90;
//     ?32 sp8C;
//     ?32 sp88;
//     ?32 sp84;
//     ?32 sp80;
//     ?32 sp7C;
//     ?32 sp78;
//     ?32 sp74;
//     ?32 sp70;
//     s8 sp6E;
//     s8 sp6D;
//     s8 sp6C;
//     ?32 sp68;
//     ?32 sp64;
//     ?32 sp60;
//     ?32 sp5C;
//     ?32 sp58;
//     ?32 sp54;
//     s8 sp52;
//     s8 sp51;
//     s8 sp50;
//     s16 sp4E;
//     s16 sp4C;
//     s16 sp4A;
//     s16 sp48;
//     s16 sp46;
//     s16 sp44;
//     s16 sp42;
//     s16 sp40;
//     s16 sp3E;
//     s16 sp3C;
//     f32 sp38;
//     f32 sp34;
//     f32 sp30;
//     f32 sp2C;
//     f32 sp28;
//     f32 sp24;
//     f32 sp20;
//     f32 sp1C;
//     f32 sp18;
//
//     sp18 = *(void *)0x800A0258;
//     sp1C = 40.0f;
//     sp3E = 3;
//     sp40 = -0x29;
//     sp44 = -0x16;
//     sp42 = 0x15;
//     sp46 = 0x16;
//     sp48 = 7;
//     sp4E = 0x15;
//     sp50 = 0xB;
//     sp20 = *(void *)0x800A025C;
//     sp3C = 2;
//     sp4C = 0x30;
//     sp52 = 0x28;
//     sp54 = 1;
//     sp58 = 4;
//     sp6C = 0xFF;
//     sp6D = 0xFF;
//     sp70 = 3;
//     sp4A = 0;
//     sp51 = 1;
//     sp5C = 0;
//     sp60 = 0;
//     sp64 = 0;
//     sp68 = 0;
//     sp6E = 0;
//     sp74 = 0xFF;
//     sp78 = 0;
//     sp7C = 0x220005;
//     sp80 = 0x1D0600;
//     sp84 = (?32) (u8)1;
//     sp88 = 0x3B;
//     sp8C = 0x80;
//     sp90 = 0x20;
//     sp94 = 0;
//     sp95 = 7;
//     sp98 = 0xC;
//     sp9A = 0x15;
//     sp34 = 100.0f;
//     sp38 = 57.5f;
//     sp24 = *(void *)0x800A0260;
//     sp28 = 39.0f;
//     sp2C = *(void *)0x800A0264;
//     sp30 = 1.0f;
//     func_15151A38(&sp18, arg0 & 0xFF, 1);
// }

#pragma GLOBAL_ASM("asm/nonmatchings/game_EF410/func_150C2424.s")
s32 func_150C251C(void *arg0) {
    void *temp_v0 = *(void **)((s32)arg0 + 0x98);
    s32 temp_v1 = *(s16 *)((s32)arg0 + 0x1C) << 3;
    s32 temp_t7;

    if (temp_v1 >= 0x100) {
        temp_v1 = 0xFF;
    }
    temp_t7 = temp_v1 & 0xFF;
    *(u8 *)((s32)temp_v0 + 0x1B) = temp_v1;
    if (temp_t7 < 0) {
        return 0;
    }
    return 1;
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_EF410/func_150C2558.s")
extern f32 D_800A0274;
extern f32 D_800A0278;
extern f32 D_800A027C;

typedef struct {
    s16 unk10;
    s16 unk12;
    s16 unk14;
    s16 unk16;
    f32 unk18[3];
    s16 unk24;
    s16 unk26;
    f32 unk28;
    f32 unk2C;
    s16 unk30;
    s16 unk32;
    f32 unk34;
    f32 unk38;
    u8 unk3C;
    s8 unk3D;
    u8 unk3E[2];
    f32 unk40;
    f32 unk44;
    s8 unk48;
    u8 unk49;
    u8 unk4A[2];
    f32 unk4C;
    s8 unk50;
    u8 pad51[3];
    f32 unk54;
} Struct150C2700;

void func_15150178(Struct150C2700 *arg0, f32 *arg1, s32 arg2, u8 arg3, s32 arg4);

s32 func_150C2700(s32 a0, s32 a1, f32 a2, f32 a3, f32 arg4,
                  s32 arg5, s32 arg6, s32 arg7, s32 arg8, s32 arg9,
                  s32 argA, s32 argB, s32 argC, s32 argD, u8 argE) {
    Struct150C2700 sp20;

    sp20.unk18[0] = a2;
    sp20.unk18[1] = a3;
    sp20.unk24 = 6;
    sp20.unk26 = 5;
    sp20.unk10 = 0x6B;
    sp20.unk12 = 0x46;
    sp20.unk14 = -0x1F;
    sp20.unk16 = 0x2E;
    sp20.unk30 = 0x64;
    sp20.unk32 = 0;
    sp20.unk3C = 0x9B;
    sp20.unk3D = 0x64;
    sp20.unk44 = 0.0f;
    sp20.unk48 = 1;
    sp20.unk49 = 6;
    sp20.unk4C = 0.0f;
    sp20.unk50 = 1;
    sp20.unk54 = 0.0f;
    sp20.unk18[2] = arg4;
    sp20.unk28 = 30.0f;
    sp20.unk2C = 35.0f;
    sp20.unk34 = D_800A0274;
    sp20.unk38 = D_800A0278;
    sp20.unk40 = D_800A027C;
    func_15150178(&sp20, sp20.unk18, 0, argE, 1);
    return 1;
}
void func_150C2804(s32 arg0, s32 arg1, s32 arg2, s16 arg3, u8 arg4, s32 arg5) {
    u8 sp1C[0x1A];

    *(s32 *)&sp1C[0] = arg0;
    *(s32 *)&sp1C[4] = arg1;
    *(s32 *)&sp1C[8] = arg2;
    *(f32 *)&sp1C[0xC] = D_800A0280;
    *(f32 *)&sp1C[0x10] = D_800A0284;
    *(s16 *)&sp1C[0x14] = arg3;
    sp1C[0x16] = 5;
    sp1C[0x17] = 6;
    sp1C[0x18] = 3;
    *(s8 *)&sp1C[0x19] = -1;
    func_15134908(sp1C, 0, arg4, arg5);
}
extern f32 D_800A0288;
extern f32 D_800A028C;
extern f32 D_800A0290;

void func_151D9014(void *arg0, f32 *arg1, u8 arg2, f32 arg3, s16 arg4, u8 arg5,
                   f32 arg6, u8 arg7, f32 arg8, f32 arg9, u8 argA, s32 argB,
                   u8 argC, u8 argD, u8 argE, s32 argF);

void func_150C2898(f32 a0, f32 a1, f32 a2, f32 a3, f32 a4, f32 a5, u8 *a6) {
    f32 sp6C[3];
    f32 sp60[3];
    f32 r;
    struct { f32 c; s32 a; u32 b; s32 pad; } sp4C;

    sp6C[0] = a0;
    sp6C[1] = a1;
    sp6C[2] = a2;
    r = (func_150ADA68() * 112.0f + 247.0f) * D_800A0288;
    sp60[0] = -a3 * r;
    sp60[1] = -a4 * r;
    sp60[2] = -a5 * r;
    sp4C.c = func_150ADA68();
    sp4C.a = func_150ADA20();
    sp4C.b = func_150ADA20();
    func_151D9014(sp6C, sp60, 6, sp4C.c * D_800A028C + D_800A0290,
                  (sp4C.a & 0xF) + 25, (sp4C.b % 101) + 155,
                  func_150ADA68() * 119.0f + 129.0f, 0, 1.0f, 1.0f, 1, 0, 1, 0,
                  a6[0xC], a6[1]);
}
#pragma GLOBAL_ASM("asm/nonmatchings/game_EF410/func_150C29F0.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_EF410/func_150C2C00.s")
s32 func_150C2FCC(f32 *arg0) {
    arg0[11] -= arg0[11] * arg0[84];
    arg0[12] -= arg0[12] * arg0[84];
    arg0[14] += (arg0[20] * D_800BE9A4) + (((0.5f * arg0[19]) * D_800BE9A4) * D_800BE9A4);
    arg0[20] += arg0[19] * D_800BE9A4;
    if ((arg0[11] < 10.0f) || (arg0[12] < 10.0f)) {
        return 0;
    }
    return 1;
}
s32 func_150C308C(void *arg0) {
    u8 ret;
    struct17 *temp_v0;
    f32 sum;

    ret = 0;
    if (*(s16 *)((s32)arg0 + 0x1C) >= 6) {
        temp_v0 = func_15144B34(D_80082FA4);
        sum = (temp_v0->unk0 * temp_v0->unk0) + (temp_v0->unk8 * temp_v0->unk8);
        if (sum < D_800A0310) {
            ret = 1;
        } else if (D_800A0314 < func_15144C8C(func_150484A0(temp_v0->unk0, temp_v0->unk8), *(f32 *)((s32)arg0 + 0x160))) {
            ret = 1;
        }
    }
    if (ret != 0) {
        *(s16 *)((s32)arg0 + 0x1C) = 5;
    }
    return 1;
}
// ? func_150C308C(void *arg0) {
//     u8 sp1F;
//     f32 temp_f0;
//     f32 temp_f2;
//     u8 temp_a1;
//     void *temp_v0;
//     u8 phi_a1;
//
//     phi_a1 = (u8)0U;
//     if ((s32) arg0->unk1C >= 6) {
//         sp1F = 0;
//         temp_v0 = func_15144B34(D_80082FA4, (u8)0U);
//         temp_f0 = temp_v0->unk0;
//         temp_f2 = temp_v0->unk8;
//         temp_a1 = sp1F;
//         if (((temp_f0 * temp_f0) + (temp_f2 * temp_f2)) < D_800A0310) {
// block_4:
//             phi_a1 = (u8)1U;
//         } else {
//             sp1F = temp_a1;
//             phi_a1 = temp_a1;
//             if (D_800A0314 < func_15144C8C(func_150484A0(temp_v0->unk0, temp_v0->unk8, temp_a1), arg0->unk160)) {
//                 goto block_4;
//             }
//         }
//     }
//     if (phi_a1 != 0) {
//         arg0->unk1C = (u16)5;
//     }
//     return 1;
// }

Gfx *func_150C3160(Gfx *arg0, void *arg1) {
    s32 temp_v0;
    s32 temp_v1;
    s32 temp_a0;
    f32 temp_f0;

    temp_v0 = *(s32 *)((s32)arg1 + 0x2E8);
    temp_f0 = (temp_v0 != 0) ? ((f32)*(s32 *)((s32)arg1 + 0x2E4) / (f32)temp_v0) : 1.0f;
    temp_f0 = 1.0f - temp_f0;
    temp_v1 = (s32)((500.0f * temp_f0) + 2.0f);
    temp_a0 = 2 - *(s32 *)((s32)arg1 + 0x2EC);
    *(s32 *)((s32)arg1 + 0x2EC) = temp_v1 / 3;
    while (temp_a0 < 0) {
        temp_a0 += 0x40;
    }
    gDPSetTileSize(arg0++, 4, temp_v1, temp_a0, 0x1FE, 0x03E);
    return arg0;
}
#pragma GLOBAL_ASM("asm/nonmatchings/game_EF410/func_150C3230.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_EF410/func_150C3574.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_EF410/func_150C3994.s")

s32 func_150C3D48(s32 arg0) {
    return arg0 + 0xEDCBA988;
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_EF410/func_150C3D5C.s")

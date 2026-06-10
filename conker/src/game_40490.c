#include <ultra64.h>

#include "functions.h"
#include "variables.h"

extern f32 D_800966B4;
void func_1510F800(s32);

extern u8 D_800C35E8;
extern f32 D_80096650;
extern void (*D_80082F28[])(struct16 *, f32);

void func_151A9390(s32, u8, struct134 *, s32, f32, f32, s32, s32, s32);

s32 func_151BE850(struct17 *arg0, s32 arg1, u8 arg2, u8 arg3, u8 arg4, u8 arg5, u8 arg6);


void func_15012FE0(void) {
    D_800BE570 = 0;
    D_800BE574 = 0;
    D_800BE575 = 0;
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_40490/func_15013000.s")
// requires jump table
#pragma GLOBAL_ASM("asm/nonmatchings/game_40490/func_150130B4.s")

s32 func_1501370C(struct16 *arg0) {
    u8 idx = arg0->unk17;
    void (*func)(void) = D_80082EA0[idx];

    if (func != NULL) {
        func();
    }
    return 1;
}

s32 func_1501374C(struct16 *arg0) {
    arg0->unk16 |= 4;
    func_1515D088(arg0);
    return 1;
}

// fat struct definition:
#pragma GLOBAL_ASM("asm/nonmatchings/game_40490/func_15013778.s")

s32 func_1501396C(struct16 *arg0) {
    u8 idx = arg0->unk17;
    void (*func)(void) = D_80082ECC[idx];

    if (func != NULL) {
        func();
    }
    return 1;
}

// another struct
#pragma GLOBAL_ASM("asm/nonmatchings/game_40490/func_150139AC.s")

s32 func_15013C38(struct16 *arg0) {
    s32 temp_v1;
    void (*func)(struct16 *, f32);
    s32 temp_v0;
    f32 temp_f0;

    arg0->unk16 |= 4;
    temp_v1 = *(s32 *)((s32)arg0 + 0x18);
    if (((*(u8 *)((s32)D_800D2E4C + 0x11)) & 4) && (D_800BE9F0 == 0x13)) {
        return 1;
    }
    if (D_800C35EA == 1) {
        temp_v0 = D_800C35E8;
        if ((temp_v0 == 0xF) || (temp_v0 == 0x10) || (temp_v0 == 0x11)) {
            return 1;
        }
    }
    if (temp_v1 >= 6) {
        return 1;
    }
    func = D_80082F28[temp_v1];
    if (func != NULL) {
        temp_f0 = (f32)arg0->unk1C * D_80096650;
        func(arg0, temp_f0);
    }
    return 1;
}

s32 func_15013D38(struct47 *arg0) {
    struct17 sp3C;
    s32 temp_v0;

    arg0->unk16 |= 4;
    sp3C.unk0 = arg0->unk0;
    sp3C.unk4 = arg0->unk2;
    sp3C.unk8 = arg0->unk4;
    temp_v0 = arg0->unk18;
    func_151BE850(&sp3C, arg0->unk10, (temp_v0 != 0) ? temp_v0 : 1, arg0->unk1F, 1, 0xFF, 1);
    return 1;
}
// #NON-MATCHING: looks close but think its wrong
// s32 func_151BE850(struct17 *arg0, s32 arg1, u8 arg2, u8 arg3, u8 arg4, u8 arg5, u8 arg6);
// s32 func_15013D38(struct47 *arg0) {
//     s32 tmp1;
//     s32 tmp2;
//     s32 tmp3;
//     s32 tmp4;
//     struct17 *tmp;
//
//     arg0->unk16 |= 4;
//
//     tmp->unk0 = arg0->unk0;
//     tmp->unk4 = arg0->unk2;
//     tmp->unk8 = arg0->unk4;
//
//     tmp4 = 1;
//     tmp1 = arg0->unk18;
//     if (tmp1) {
//         tmp4 = tmp1;
//     }
//
//     tmp2 = arg0->unk10;
//     tmp3 = arg0->unk1F;
//
//     func_151BE850(tmp, tmp2, tmp4, tmp3, 0xff, 1, 1);
//     return 1;
// }

#pragma GLOBAL_ASM("asm/nonmatchings/game_40490/func_15013DE8.s")

s32 func_15013F9C(s32 arg0) {
    func_151CD2C0(arg0, 0xFF, 1);
    return 1;
}

s32 func_15013FC4(struct133 *arg0) {
    u8 idx = arg0->unk1B;
    void (*func)(void) = D_80082F40[idx];

    if (func != NULL) {
        func();
    }
    return 1;
}

s32 func_15014004(struct134 *arg0) {
    s32 temp_v1 = arg0->unk1C;
    if (temp_v1 < 0) {
        return 1;
    }
    if (temp_v1 >= 6) {
        return 1;
    }
    D_800E0900[temp_v1] = arg0;
    return 1;
}

s32 func_15014040(struct134 *arg0) {
    s32 temp_v0 = arg0->unk18;
    arg0->unk16 |= 4;
    if (temp_v0 == 0) {
        D_800D9A20 = arg0;
    } else if (temp_v0 == 1) {
        D_800D9A24 = arg0;
    }
    return 1;
}

s32 func_1501407C(s32 arg0) {
    D_800D987C = (u8)0;
    return 1;
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_40490/func_15014094.s")
// NON-MATCHING: kinda right idea, but not executed correctly
// void func_15014094(struct134 *arg0) {
//     struct135 tmp;
//
//     tmp.unk0 = arg0;
//     // tmp.unk4 = tmp.unk0;
//     tmp.unk0->unk16 |= 4;
//     // tmp.unkC = tmp.unk0;
//     // arg0 = tmp.unk0;
//     tmp.unk10 = func_15144598(tmp.unk4); //, tmp.unk0);
//     tmp.unk14 = 0.0f;
//     func_1510F800(0);
//     tmp.unk18 = func_1510FD20(arg0->unk0, arg0->unk4, arg0);
//     tmp.unk1C = 0;
//     tmp.unk8 = func_15149130(0x12C, -1, 0x21, -1, 0, 0, 0x34, 0xFF, 1);
//     if (tmp.unk8 != 0) {
//         memcpy(tmp.unk8 + 0x28, &tmp, 0x34);
//     }
// }

s32 func_15014144(struct134 *arg0) {
    s32 temp_v0;
    s32 temp_t2;
    s32 temp_t1;
    s32 temp_v1;
    s32 temp_t0;
    s32 temp_v0_2;
    s32 temp_t7;
    s32 temp_t8;
    s32 temp_t9;
    s32 temp_t3;

    temp_v0 = arg0->unk18;
    if ((temp_v0 & 8) != 0) {
        temp_t2 = 8;
    } else {
        temp_t2 = 0;
    }
    if ((temp_v0 & 4) != 0) {
        temp_t1 = 4;
    } else {
        temp_t1 = 0;
    }
    if ((temp_v0 & 2) != 0) {
        temp_v1 = 0;
    } else {
        temp_v1 = 2;
    }
    if ((temp_v0 & 1) != 0) {
        temp_t0 = 1;
    } else {
        temp_t0 = 0;
    }
    temp_t8 = -1;
    if ((temp_v0 & 0x10) != 0) {
        temp_v0_2 = 0x10;
    } else {
        temp_v0_2 = 0;
    }
    temp_t7 = (temp_v0_2 | temp_t0 | temp_v1 | temp_t1 | temp_t2) & 0xFF;
    temp_t9 = 0xFF;
    temp_t3 = 1;
    func_151A9390(temp_t7, ((u8 *)arg0)[0x1F], arg0, 0, *(f32 *)&D_8009667C, 100.0f, temp_t8, temp_t9, temp_t3);
    return 1;
}

s32 func_15014220(struct134 *arg0) {
    s32 sp34[3];
    struct260 *temp_v0;

    arg0->unk16 |= 4;
    *(f32 *)&sp34[0] = 0.0f;
    sp34[1] = (s32) arg0;
    ((u8 *)sp34)[8] = 1;
    temp_v0 = func_15149130(0x12C, -1, 0x26, -1, 0, 0x24, (struct37 *)0xC, 0xFF, 0);
    if (temp_v0 != 0) {
        memcpy((u8 *)temp_v0 + 0x28, sp34, 0xC);
    }
    return 1;
}
s32 func_150142AC(struct134 *arg0) {
    s32 idx;

    idx = ((u8 *)arg0)[0x1B];
    arg0->unk16 |= 4;
    if ((idx < 0) || (idx >= 3)) {
        return 1;
    }
    D_800D9AA0[idx] = arg0;
    return 1;
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_40490/func_150142EC.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_40490/func_150144B8.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_40490/func_1501474C.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_40490/func_15014B60.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_40490/func_15014F6C.s")

s32 func_150150A4(void) {
    struct17 *temp_v0 = func_1515F1B0();
    if (temp_v0 == NULL) {
        return 1;
    }

    func_1515F25C(&D_800DCDC4, temp_v0);
    D_800DCD90 += temp_v0->unk8;
    return 1;
}

s32 func_15015104(struct134 *arg0) {
    s32 sp44[5];
    s32 pad;
    struct260 *temp_v0;
    s32 temp_v1;
    s32 temp_t0;
    s32 temp_v0_2;

    ((u8 *)arg0)[0x14] = 1;
    sp44[0] = (s32)arg0;
    ((u8 *)sp44)[4] = arg0->unk1C;
    func_1510F800(0);
    sp44[2] = func_1510FD20(arg0->unk0, arg0->unk4);
    temp_v1 = arg0->unk20;
    if (temp_v1 != 0) {
        temp_t0 = 1;
    } else {
        temp_t0 = 0;
    }
    if (temp_v1 != 0) {
        temp_v0_2 = 2;
    } else {
        temp_v0_2 = 0;
    }
    ((u8 *)sp44)[0xC] = temp_v0_2 | temp_t0;
    sp44[4] = 0;
    temp_v0 = func_15149130(0x12C, -1, -1, -1, 0, 0x2C, (struct37 *)0x14, 0xFF, 0);
    if (temp_v0 != 0) {
        memcpy((u8 *)temp_v0 + 0x28, sp44, 0x14);
    }
    return 1;
}
s32 func_150151D4(struct134 *arg0) {
    s32 sp38[18];
    struct260 *temp_v0;

    arg0->unk16 |= 4;
    ((u8 *)arg0)[0x14] = 1;
    sp38[0] = (s32)arg0;
    ((f32 *)sp38)[1] = 0.0f;
    ((s16 *)sp38)[4] = -1;
    ((f32 *)sp38)[3] = (f32)*(s16 *)((u8 *)arg0 + 0);
    ((f32 *)sp38)[4] = (f32)*(s16 *)((u8 *)arg0 + 2);
    ((f32 *)sp38)[5] = (f32)*(s16 *)((u8 *)arg0 + 4);
    ((f32 *)sp38)[6] = (f32)*(s16 *)((u8 *)arg0 + 6);
    ((f32 *)sp38)[7] = (f32)*(s16 *)((u8 *)arg0 + 8);
    ((f32 *)sp38)[8] = D_800966B4;
    sp38[16] = 0;
    ((u8 *)sp38)[0x3D] = 0;
    ((u8 *)sp38)[0x3C] = 0;
    sp38[14] = 0;
    func_1510F800(0);
    sp38[17] = func_1510FD20(arg0->unk0, arg0->unk4);
    temp_v0 = func_15149130(0x12C, -1, 0x3C, -1, 0, 0x2D, (struct37 *)0x48, 0xFF, 0);
    if (temp_v0 != NULL) {
        memcpy((u8 *)temp_v0 + 0x28, sp38, 0x48);
    }
    return 1;
}

s32 func_15015300(struct134 *arg0) {
    void (*func)(void);
    s32 idx = arg0->unk1C;

    if ((idx < 0) || (idx >= 2)) {
        return 1;
    }

    func = D_80082F70[idx];
    if (func != NULL) {
        func();
    }

    return 1;
}


#pragma GLOBAL_ASM("asm/nonmatchings/game_40490/func_15015354.s")
s32 func_15015644(struct134 *arg0) {
    s32 sp38[4];
    struct260 *temp_v0;

    arg0->unk16 |= 4;
    ((u8 *)arg0)[0x14] = 1;
    sp38[0] = (s32)arg0;
    *(f32 *)&sp38[1] = func_15144598(arg0);
    func_1510F800(0);
    sp38[2] = func_1510FD20(arg0->unk0, arg0->unk4);
    ((u8 *)sp38)[0xC] = 0;
    temp_v0 = func_15149130(0x12C, -1, 0x44, -1, 0, 0x2F, (struct37 *)0x10, 0xFF, 0);
    if (temp_v0 != 0) {
        memcpy((u8 *)temp_v0 + 0x28, sp38, 0x10);
    }
    return 1;
}
#pragma GLOBAL_ASM("asm/nonmatchings/game_40490/func_150156F4.s")

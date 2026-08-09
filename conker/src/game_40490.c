#include <ultra64.h>

#include "functions.h"
#include "variables.h"

extern void (*D_80082E30[])(struct178 *);

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

void func_15013000(void) {
    void (**table)(struct178 *);
    void (*func)(struct178 *);
    s32 base;
    struct178 *arg;
    u32 i;
    s32 offset;
    u32 count;
    u8 idx;

    D_800DCDC4 = 0;
    D_800DCD90 = 0.0f;
fence_15013000:
    count = D_800D3094;
    i = 0;
    offset = 0;
    if (count != 0) {
        table = D_80082E30;
        do {
            base = *(s32 *)&D_800D3098;
            idx = ((u8 *)base)[offset + 0x15];
            func = table[(u8)((s32)idx >> 2)];
            if (func != NULL) {
                arg = (struct178 *)(offset + base);
                func(arg);
            }
            i++;
            offset += sizeof(struct178);
        } while (i < (u32)D_800D3094);
    }
}
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
extern f32 D_80096648;
extern f32 D_8009664C;
extern struct {
    f32 unk0;
    f32 unk4;
    f32 unk8;
    f32 unkC;
    f32 unk10;
    s16 unk14;
    s16 unk16;
    f32 unk18;
    f32 unk1C;
    f32 unk20;
    f32 unk24;
    f32 unk28;
    f32 unk2C;
    u8 unk30;
    u8 unk31;
    u8 unk32;
    u8 unk33;
    u8 unk34;
    u8 pad35[3];
} D_80095FA0[];

typedef struct {
    struct16 *unk0;
    f32 unk4;
    f32 unk8;
    f32 unkC;
    f32 unk10;
    f32 unk14;
    f32 unk18;
    f32 unk1C;
    f32 unk20;
    s16 unk24;
    s16 unk26;
    f32 unk28;
    f32 unk2C;
    f32 unk30;
    f32 unk34;
    f32 unk38;
    f32 unk3C;
    u8 unk40;
    u8 unk41;
    u8 unk42;
    u8 pad43;
    u16 unk44;
    u8 pad46[2];
    f32 unk48;
    u8 pad4C[0x14];
    s32 unk60;
    u8 unk64;
    u8 unk65;
    u8 pad66[2];
    s32 unk68;
    s32 unk6C;
} Struct150139ACLocalCandidate;

s32 func_150139AC(struct16 *arg0, s32 idx) {
    Struct150139ACLocalCandidate tmp;
    struct {
        f32 unk0;
        f32 unk4;
        f32 unk8;
        f32 unkC;
        f32 unk10;
        s16 unk14;
        s16 unk16;
        f32 unk18;
        f32 unk1C;
        f32 unk20;
        f32 unk24;
        f32 unk28;
        f32 unk2C;
        u8 unk30;
        u8 unk31;
        u8 unk32;
        u8 unk33;
        u8 unk34;
        u8 pad35[3];
    } *entry;
    struct260 *temp_v0;

    idx = *(s32 *)&arg0->unk18;
    arg0->unk16 |= 4;
    tmp.unk0 = arg0;
    tmp.unkC = 0.0f;
    switch (arg0->unk15 & 3) {
    default:
        tmp.unk4 = 1.0f;
        tmp.unk10 = 1000.0f;
        break;
    case 2:
        tmp.unk4 = (f32)(((s16 *)arg0)[5] * ((s16 *)arg0)[3]) * 4.0f;
        tmp.unk10 = (f32)(((s16 *)arg0)[4] + ((s16 *)arg0)[1]);
        break;
    case 0:
    case 1:
        tmp.unk4 = (f32)(((s16 *)arg0)[3] * ((s16 *)arg0)[3]) * D_80096648;
        tmp.unk10 = (f32)(((s16 *)arg0)[4] + ((s16 *)arg0)[1]);
        break;
    }
    entry = &D_80095FA0[idx];
    tmp.unk14 = entry->unk4;
    tmp.unk18 = entry->unk8;
    tmp.unk1C = entry->unkC;
    tmp.unk20 = entry->unk10;
    tmp.unk28 = entry->unk18;
    tmp.unk2C = entry->unk1C;
    tmp.unk60 = 0;
    tmp.unk64 = 0;
    tmp.unk65 = 0;
    tmp.unk68 = 0;
    tmp.unk24 = entry->unk14;
    tmp.unk26 = entry->unk16;
    tmp.unk30 = entry->unk20;
    tmp.unk34 = entry->unk24;
    tmp.unk38 = entry->unk28;
    tmp.unk3C = entry->unk2C;
    tmp.unk8 = entry->unk0;
    tmp.unk40 = entry->unk30;
    tmp.unk41 = entry->unk31;
    tmp.unk42 = entry->unk32;
    tmp.unk48 = D_8009664C;
    if (entry->unk34 != 0) {
        func_1510F800(0);
        tmp.unk6C = func_1510FD20((s32)((s16 *)arg0)[0],
                                  (s32)((s16 *)arg0)[2]);
    } else {
        tmp.unk6C = 0;
    }
    if (entry->unk33 != 0) {
        tmp.unk44 = func_1000FA64(0x4D, ((s16 *)arg0)[0],
                                   ((s16 *)arg0)[1], ((s16 *)arg0)[2],
                                   0x5DC0, 0x3E8, 0x12C, 0, NULL, 0, 0, 0);
    } else {
        tmp.unk44 = 0;
    }
    temp_v0 = func_151491F4(0x12C, -1, 6, 0, 0xA, 0x70, 0xFF, 0);
    if (temp_v0 != NULL) {
        memcpy((u8 *)temp_v0 + 0x28, &tmp, sizeof(tmp));
    }
    return 1;
}

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

extern f32 D_80096654;
extern f32 D_80096658;
extern f32 D_8009665C;
extern f32 D_80096660;
extern f32 D_80096664;
extern f32 D_80096668;
extern f32 D_8009666C;
extern f32 D_80096670;
extern f32 D_80096674;
extern f32 D_80096678;
s32 func_15149550(void *, s32, s32, u8, u8, s32);

typedef struct {
    f32 unk0;
    f32 unk4;
    f32 unk8;
    f32 unkC;
    f32 unk10;
    f32 unk14;
    f32 unk18;
    f32 unk1C;
    s16 unk20;
    s16 unk22;
    s16 unk24;
    u8 unk26;
    u8 unk27;
    u8 unk28;
    u8 unk29;
    s16 unk2A;
    u8 unk2C;
    u8 unk2D;
    u8 unk2E;
    u8 unk2F;
    s32 unk30;
    u8 unk34;
    f32 unk38;
    f32 unk3C;
    f32 unk40;
    f32 unk44;
} Struct15013DE8Candidate;

s32 func_15013DE8(struct47 *arg0) {
    Struct15013DE8Candidate sp30;
    f32 tmpA;
    f32 tmpB;

    arg0->unk16 |= 4;
    tmpA = arg0->unk6 * D_80096654;
    tmpB = arg0->unk8 * D_80096658;
    sp30.unk22 = 0x1A4D + ((sp30.unk20 = 0x6231), 0);
    sp30.unk26 = 0;
    sp30.unk27 = 0;
    sp30.unk28 = 0;
    sp30.unk29 = 0xFF;
    sp30.unk2A = 0;
    sp30.unk2D = 0xFF;
    sp30.unk30 = 0;
    sp30.unk2E = 0;
    sp30.unk2F = 0;
    sp30.unk34 = 0;
    sp30.unk3C = D_8009665C;
    sp30.unk0 = arg0->unk0;
    sp30.unk4 = arg0->unk2;
    sp30.unk8 = arg0->unk4;
    sp30.unk24 = 0x12C;
    sp30.unk38 = 0.0f;
    sp30.unk40 = D_80096660;
    sp30.unk44 = D_80096664;
    sp30.unk2C = (func_150ADA20() % 0x38U) + 0xC8;
    sp30.unkC = D_80096668 * tmpA;
    sp30.unk14 = D_8009666C * tmpA;
    sp30.unk18 = (D_80096674 * tmpB) +
                 ((sp30.unk10 = D_80096670 * tmpB), 0);
    sp30.unk1C = D_80096678 * tmpB;
    func_15149550(&sp30, 0xA, 1, arg0->unk18 ? 2 : 1, 0xFF, 1);
    return 1;
}

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

s32 func_15014094(struct134 *arg0) {
    struct {
        struct134 *unk0;
        f32 unk4;
        f32 unk8;
        s32 unkC;
        u8 pad10[0x1C];
        s8 unk2C;
        u8 pad2D[7];
    } tmp;
    struct260 *temp_v0;

    arg0->unk16 |= 4;
    tmp.unk0 = arg0;
    tmp.unk4 = func_15144598(arg0);
    tmp.unk8 = 0.0f;

    func_1510F800(0);
    tmp.unkC = func_1510FD20(arg0->unk0, arg0->unk4);
    tmp.unk2C = 0;

    temp_v0 = func_15149130(0x12C, -1, 0x21, -1, 0, 0, (struct37 *)0x34, 0xFF, 1);
    if (temp_v0 != NULL) {
        memcpy((void *)((s32)temp_v0 + 0x28), &tmp, 0x34);
    }
}
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

extern f32 D_80096680, D_80096684;
typedef struct { struct134 *unk0; f32 unk4; f32 unk8; f32 unkC; f32 unk10; f32 unk14; } StructH40490;
s32 func_150142EC(struct134 *arg0) {
    StructH40490 tmp;
    struct37 *temp_v0;
    f32 a, b, c, d;
    f32 ret;

    arg0->unk16 |= 4;
    if (D_80082FA0 >= 2) {
        return 1;
    }
    if ((((u8 *) D_800D2E4C)[0x11] & 4) && (D_800BE9F0 == 0x13)) {
        return 1;
    }
    a = (f32) ((u32) arg0->unk1C & 0xFFFF) * D_80096680;
    b = (f32) (((u32) arg0->unk1C >> 16) & 0xFFFF) * D_80096680;
    c = (f32) ((u32) arg0->unk20 & 0xFFFF) * D_80096680;
    d = (f32) (((u32) arg0->unk20 >> 16) & 0xFFFF) * D_80096680;
    ret = func_1514462C((s32) arg0);
    tmp.unk0 = arg0;
    tmp.unk4 = (a * ret) * D_80096684;
    tmp.unk8 = (b * ret) * D_80096684;
    tmp.unkC = c;
    tmp.unk10 = d;
    tmp.unk14 = 0.0f;
    temp_v0 = func_15149130(0x12C, -1, 0x29, -1, 0, 0, 0x18, 0xFF, 0);
    if (temp_v0 != NULL) {
        memcpy(&temp_v0->unk28, &tmp, 0x18);
    }
    return 1;
}
#pragma GLOBAL_ASM("asm/nonmatchings/game_40490/func_150144B8.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_40490/func_1501474C.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_40490/func_15014B60.s")
typedef struct { struct134 *unk0; u32 unk4; u32 unk8; u32 unkC; f32 unk10[4][4]; u8 unk50; u8 unk51; u8 pad52[0x2]; } StructF40490;
s32 func_15014F6C(struct134 *arg0) {
    StructF40490 tmp;
    struct37 *temp_v0;
    u8 r;
    s32 v;

    arg0->unk16 |= 4;
    tmp.unk51 = arg0->unk20;
    v = (arg0->unk1C & 1) ? 1 : 0;
    tmp.unk50 = v;
    tmp.unk0 = arg0;
    tmp.unk4 = arg0->unk18 & 0xFFFF;
    tmp.unk8 = ((u32) arg0->unk18 >> 16) & 0xFFFF;
    r = func_150ADA20();
    tmp.unkC = r % (tmp.unk8 + 1) + tmp.unk4;
    func_150A8050(tmp.unk10, *(f32 *) &arg0->unkC, *(f32 *) &arg0->unk10, 0.0f);
    tmp.unk10[3][0] = (f32) ((s16 *) arg0)[0];
    tmp.unk10[3][1] = (f32) ((s16 *) arg0)[1];
    tmp.unk10[3][2] = (f32) ((s16 *) arg0)[2];
    temp_v0 = func_15149130(0x12C, -1, 0x31, -1, 0, 0x2A, 0x54, 0xFF, 0);
    if (temp_v0 != NULL) {
        memcpy(&temp_v0->unk28, &tmp, 0x54);
    }
    return 1;
}

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
extern void func_150A7960(f32 *, f32, f32, f32, f32 *, f32 *, f32 *);

typedef struct {
    s8 unk0;
    u8 pad1[3];
    struct17 unk4;
    struct17 unk10;
    f32 unk1C;
    s8 unk20;
    u8 pad21[3];
} Struct150156F4PayloadCandidate;

s32 func_150156F4(struct134 *arg0) {
    struct17 points[2];
    f32 mtx[4][4];
    Struct150156F4PayloadCandidate payload;

    if (D_800BE9F0 == 0xB) {
        if ((u32)arg0->unk18 < 6U) {
            return 1;
        }
    } else if (D_800BE9F0 == 0x2C) {
        if ((u32)arg0->unk18 < 7U) {
            return 1;
        }
    } else if (D_800BE9F0 == 0x26) {
        if ((u32)arg0->unk18 < 2U) {
            return 1;
        }
    }
    func_150A8050(mtx, *(f32 *)&arg0->unkC, *(f32 *)&arg0->unk10, 0.0f);
    mtx[3][0] = (f32)arg0->unk0;
    mtx[3][1] = (f32)(s16)arg0->unk2;
    mtx[3][2] = (f32)arg0->unk4;
    func_150A7960(mtx[0], 0.0f, (f32)(s16)arg0->unk8, 0.0f,
                  &points[1].unk0, &points[1].unk4, &points[1].unk8);
    points[0].unk0 = (f32)arg0->unk0;
    points[0].unk4 = (f32)(s16)arg0->unk2;
    points[0].unk8 = (f32)arg0->unk4;
    payload.unk0 = arg0->unk18;
    payload.unk4 = points[points[0].unk4 < points[1].unk4];
    payload.unk10 = points[points[1].unk4 < points[0].unk4];
    payload.unk20 = 0;
    payload.unk1C = fabsf(points[1].unk4 - points[0].unk4);
    func_151ACBD4(&payload, 0);
    return 1;
}

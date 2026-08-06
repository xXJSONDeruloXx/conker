#include <ultra64.h>
#include "functions.h"
#include "variables.h"

typedef struct {
    s32 unk0[4];
} Struct15136698Table;
extern Struct15136698Table D_80089BAC;
extern f32 D_800A4624;
extern f32 D_800A4628;
extern f32 D_800A462C;
extern u8 D_800A4058[];
extern u8 D_800A4068[];


typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
} Struct15136698Vec;


typedef struct {
    u8 unk0;
    u8 pad1;
    s16 unk2;
    s16 unk4;
    u8 pad6[2];
    s32 unk8;
    s32 unkC;
    u8 unk10;
    u8 unk11;
    u8 unk12;
    u8 unk13;
    f32 unk14;
    f32 unk18;
    Struct15136698Vec unk1C;
    f32 unk28;
    f32 unk2C;
    f32 unk30;
    f32 unk34;
    f32 unk38;
    f32 unk3C;
    s32 unk40;
    u8 unk44;
    u8 unk45;
    u8 pad46[0x12];
} Struct15136698Local;


typedef struct {
    u8 unk00;
    u8 pad01[3];
    struct127 *unk04;
    u8 unk08;
    u8 pad09[3];
    f32 unk0C;
    f32 unk10;
    f32 unk14;
    f32 unk18;
    f32 unk1C;
    f32 unk20;
    u8 unk24;
    u8 pad25;
    s16 unk26;
    s16 unk28;
    s16 unk2A;
    s16 unk2C;
    u8 unk2E;
    u8 unk2F;
    s8 unk30;
    u8 pad31[3];
    f32 unk34;
    u8 unk38;
    s8 unk39;
    u8 pad3A[2];
} Local15138120;


struct arg1_1513555C {
    s32 unk0;
    u8 unk4;
};


typedef struct {
    u8  pad0[0x18];
    u8  unk18;
    u8  pad19[0x3];
    s32 unk1C;
    u8  pad20[0x1D];
    u8  unk3D;
} SubA_151347CC;


typedef struct {
    s32 unk0;
    union {
        s32 w4;
        u8  b4;
    } u4;
    u8  unk8;
    u8  unk9;
} ArgB_151347CC;


void func_15143134(void *, s32, s32);

typedef struct {
    f32 x;
    f32 y;
    f32 z;
} Vec3f37F30;

typedef struct {
    u8  unk0;
    u8  unk1;
    u8  pad2[0xA];
    u8  unkC;
    u8  padD[0x67];
    f32 unk74;
} Struct37F30;

void func_15137F30(Vec3f37F30 *arg0, Vec3f37F30 *arg1, Vec3f37F30 *arg2, Vec3f37F30 *arg3, f32 arg4, Struct37F30 *arg5, Vec3f37F30 *arg6, Vec3f37F30 *arg7, Vec3f37F30 *arg8, f32 *arg9, s16 *arg10, u8 *arg11, f32 *arg12);
void func_151D9014(void *arg0, f32 *arg1, u8 arg2, f32 arg3, s16 arg4, u8 arg5, f32 arg6, u8 arg7, f32 arg8, f32 arg9, u8 argA, s32 argB, u8 argC, u8 argD, u8 argE, s32 argF);

s32 func_15134070(struct102 *);
void func_15138120(struct127 *, s32, u8);
void func_1504715C(void *, struct102 *);
void func_151382E0(void *, s32, void *, u8, s32);
void func_15138424(struct102 *, void *, s32, void *, u8, s32);

extern f32 D_800A45B0;

extern f32 D_800A461C;
extern f32 D_800A4620;
void func_15134908(void *, s32, u8, s32);

void func_151BC5A4(struct102 *, s32, u8);

void func_15145EA4(s32 *, s32 *, s32, s32);

extern f32 D_800A4828;
extern f32 D_800A482C;

// requires jump table
#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15134070.s")

s32 func_1513416C(struct102 *arg0) {
    s16 temp_v0 = arg0->unk1C;
    if (temp_v0 < 32) {
        arg0->unk28 = temp_v0 * 8;
    }
    return 1;
}

void *func_1513418C(void *arg0, s32 arg1, u8 arg2, s32 arg3) {
    void *ret;
    u8 temp_a0;
    void *temp_v0;
    s32 temp_v1;
    s32 temp_a2;

    ret = (void *)func_15167A68(0x28, arg3, arg1 + 0x58, 1, arg2, 1);
    if (ret == NULL) {
        return NULL;
    }
    memcpy((void *)((s32)ret + 0x10), arg0, 0x30);
    temp_a0 = *(u8 *)((s32)ret + 0x3A);
    if ((temp_a0 & 2) != 0) {
        temp_v0 = *(void **)((s32)ret + 0x1C);
        if ((*(s32 *)temp_v0 == 0) || (*(u8 *)((s32)ret + 0x18) != *(u8 *)((s32)temp_v0 + 0x3B))) {
            func_1516972C(ret);
            return NULL;
        }
        temp_v1 = *(s32 *)((s32)temp_v0 + 0x1D4);
        if ((temp_v1 != 0) && ((*(u8 *)((s32)temp_v0 + 0x74) & 0xF) != 0xF)) {
            temp_a2 = temp_v1;
            temp_a2 += *(u8 *)((s32)ret + 0x20) << 6;
            func_15143134((void *)((s32)ret + 0x24), (s32)ret + 0x40, temp_a2);
        } else {
            *(u8 *)((s32)ret + 0x3A) = temp_a0 | 8;
        }
    } else {
        *(u8 *)((s32)ret + 0x3A) = temp_a0 | 0x18;
    }
    *(f32 *)((s32)ret + 0x4C) = 1.0f / (*(f32 *)((s32)ret + 0x30) + *(f32 *)((s32)ret + 0x30));
    *(f32 *)((s32)ret + 0x50) = 0.0f;
    return ret;
}
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

void func_151347CC(void *arg0, s32 arg1, u8 arg2) {
    SubA_151347CC *a = (SubA_151347CC *)arg0;
    ArgB_151347CC *b = (ArgB_151347CC *)arg1;
    s32 t;

    if ((arg2 == 0) || (arg2 == 0x3)) {
        if ((b->unk0 == a->unk1C) || (b->u4.b4 == a->unk18)) {
            func_1516972C((struct102 *)arg0);
        }
    } else if (arg2 == 0x11) {
        if (a->unk3D == 0x5) {
            if ((b->unk0 == a->unk1C) || (b->u4.b4 == a->unk18)) {
                func_1516972C((struct102 *)arg0);
            }
        }
    } else if (arg2 == 0x16) {
        if (arg1 == a->unk1C) {
            func_1516972C((struct102 *)arg0);
        }
    } else if (arg2 == 0x2D) {
        t = b->unk0;
        if (a->unk1C == t) {
            a->unk1C = b->u4.w4;
            a->unk18 = b->unk9;
        } else {
            if (a->unk1C == b->u4.w4) {
                a->unk1C = t;
                a->unk18 = b->unk8;
            }
        dummy_label_151347CC: ;
        }
    }
}

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

void *func_15134DAC(void *arg0, s32 arg1) {
    void *temp_v1;

    temp_v1 = func_15167A68(0x29, 0, arg1 + 0x80, 1, 0xFF, 1);
    if (temp_v1 == 0) {
        return NULL;
    }
    memcpy((s32)temp_v1 + 0x18, arg0, 0x3C);
    *(s16 *)((s32)temp_v1 + 0x54) = -(*(s16 *)((s32)arg0 + 0x28));
    *(s32 *)((s32)temp_v1 + 0x10) = 1;
    *(s32 *)((s32)temp_v1 + 0x14) = 0;
    *(f32 *)((s32)temp_v1 + 0x70) = 0.0f;
    *(f32 *)((s32)temp_v1 + 0x74) = 0.0f;
    *(f32 *)((s32)temp_v1 + 0x78) = 0.0f;
    return temp_v1;
}

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

void func_151355B8(struct102 *arg0, struct arg1_1513555C *arg1, u8 arg2) {
    switch (arg2) {
    case 0:
        if (arg1->unk0 == *(s32 *)&arg0->unk1C || arg0->unk18 == arg1->unk4) {
            func_1516972C(arg0);
        }
        break;
    case 3:
        if (arg1->unk0 == *(s32 *)&arg0->unk1C || arg0->unk18 == arg1->unk4) {
            s32 *p = (s32 *)((u8 *)arg0 + 0x10);
            *p &= ~1;
            *p = *p;
        }
        break;
    }
}

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

s32 func_15136698(f32 arg0, f32 arg1, u8 arg2, u8 arg3, s16 arg4, s32 arg5, Struct15136698Vec *arg6, u8 arg7, u8 arg8, u8 arg9, s32 arg10) {
    s32 ret;
    Struct15136698Local sp7C;
    f32 sp78;
    Struct15136698Table sp68;
    s32 sp64;
    s32 sp60;
    s32 temp_v0;
    s32 sp54;
    s32 sp50;

    sp68 = D_80089BAC;
    sp78 = arg1;
    sp7C.unk0 = sp68.unk0[func_150ADA20() & 3];
    if (arg7 != 0) {
        temp_v0 = 2;
    } else {
        temp_v0 = 1;
    }
    sp7C.unk2 = temp_v0 + 0x300;
    sp7C.unk8 = 0;
    sp7C.unkC = 0;
    sp7C.unk10 = 0;
    sp7C.unk11 = 0;
    sp7C.unk12 = 0;
    sp7C.unk13 = 0xFF;
    sp7C.unk18 = arg0;
    sp7C.unk14 = arg0;
    sp7C.unk1C = *arg6;
    sp7C.unk40 = 0;
    sp7C.unk28 = 0.0f;
    sp7C.unk2C = 0.0f;
    sp7C.unk30 = 0.0f;
    sp7C.unk34 = 1.0f;
    sp7C.unk38 = 1.0f;
    sp7C.unk3C = 1.0f;
    if (arg4 == -1) {
        sp7C.unk4 = 0x12C;
    } else {
        sp7C.unk4 = arg4 + 0x20;
        sp7C.unk40 = 1;
    }
    sp7C.unk44 = arg2;
    sp7C.unk45 = arg3;
    if (arg8 != 0) {
        sp64 = 3;
        sp60 = 0xFF;
    } else {
        sp64 = 0;
        sp60 = 0;
    }

    sp50 = func_150ADA20();
    sp54 = func_150ADA20();
    temp_v0 = func_150ADA20();
    ret = func_1513D594((s32)&sp7C, 0, 0, 0x1A, 0, (sp54 & 1) + (sp50 & 1), temp_v0 & 0xFF, 500.0f, 500.0f, 0, arg5, sp64, sp60, 0, 4, arg9, arg10);
    if (ret != 0) {
        memcpy(ret + 0x128, &sp78, sizeof(sp78));
    }
    return ret;
}

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

void func_15136918(f32 arg0, u8 arg1, u8 arg2, s16 arg3, s16 arg4, s32 arg5, f32 *arg6, u8 arg7, s32 arg8) {
    s32 padHi[3];
    u8 sp48[0x1C];
    s32 padLo;

    sp48[6] = 0x55;
    *(s32 *)&sp48[0] = 0x300;
    *(s32 *)&sp48[8] = 0;
    *(s32 *)&sp48[0xC] = 0;
    sp48[0x10] = arg1;
    sp48[0x11] = arg2;
    sp48[0x12] = 0;
    sp48[0x13] = 0;
    sp48[0x14] = 0;
    sp48[0x15] = 0;
    *(s32 *)&sp48[0x18] = 0x280001;
    sp48[0x16] = 1;
    sp48[0x17] = 1;
    if (arg3 == -1) {
        *(s16 *)&sp48[4] = 0x12C;
    } else {
        *(s32 *)&sp48[0] = 0x301;
        *(s16 *)&sp48[4] = arg3 + 0x20;
    }
    func_1513C73C((s32)sp48, 0xD, 0, arg5, arg6[0], arg6[1], arg6[2], arg0, arg0, arg4, 0, 0, arg7, arg8);
}

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

void func_15136AE4(f32 a0, f32 a1, f32 a2, f32 a3, f32 a4, f32 a5, u8 *a6) {
    f32 sp6C[3];
    f32 sp60[3];
    f32 r;
    struct { f32 c; s32 a; u32 b; s32 pad; } sp4C;

    sp6C[0] = a0;
    sp6C[1] = a1;
    sp6C[2] = a2;
    r = (func_150ADA68() * 112.0f + 247.0f) * D_800A4624;
    sp60[0] = -a3 * r;
    sp60[1] = -a4 * r;
    sp60[2] = -a5 * r;
    sp4C.c = func_150ADA68();
    sp4C.a = func_150ADA20();
    sp4C.b = func_150ADA20();
    func_151D9014(sp6C, sp60, 0, sp4C.c * D_800A4628 + D_800A462C,
                    (sp4C.a & 0xF) + 25, (sp4C.b % 101) + 155,
                    func_150ADA68() * 119.0f + 129.0f, 0, 1.0f, 1.0f, 1, 0, 1, 0,
                    a6[0xC], a6[1]);
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15136C3C.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15136F50.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15137610.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_1513783C.s")

s32 func_15137C64(struct17 *arg0, struct17 *arg1, struct17 *arg2, struct17 *arg3,
                  struct17 *arg4, struct17 *arg5, struct17 *arg6, struct17 *arg7) {
    f32 sp2C;
    f32 sp28;

    if ((arg5 != NULL) && (arg6 != NULL)) {
        *arg0 = *arg5;
        *arg1 = *arg6;
    } else if (arg5 != NULL) {
        *arg0 = *arg5;
        *arg1 = *arg5;
    } else if (arg6 != NULL) {
        *arg0 = *arg6;
        *arg1 = *arg6;
    } else {
        return 0;
    }

    if (arg7 == NULL) {
        arg2->unk0 = arg1->unk0 - arg0->unk0;
        arg2->unk4 = arg1->unk4 - arg0->unk4;
        arg2->unk8 = arg1->unk8 - arg0->unk8;
        if (func_15145128(arg2, arg2, &sp2C, &sp28) == 0) {
            return 0;
        }
    } else {
        *arg2 = *arg7;
    }

    if (func_15146078(arg2, arg3, arg4) == 0) {
        return 2;
    }
    return 1;
}

s32 func_15137E10(struct259 *arg0) {
    arg0->unk74 = ((func_150ADA68() * 50.0f) + 580.0f) * D_800A4828;
    return 1;
}


void func_15137E60(s32 arg0, s32 arg1, s32 arg2, s32 arg3, f32 arg4, struct102 *arg5) {
    f32 sp6C[3];
    f32 sp60[3];
    f32 sp54[3];
    f32 sp50;
    s16 sp4E;
    u8 sp4D;
    f32 sp48;

    func_15137F30(arg0, arg1, arg2, arg3, arg4, arg5, sp6C, sp60, sp54, &sp50, &sp4E, &sp4D, &sp48);
    func_151D9014(sp6C, sp54, 0, sp50, sp4E, sp4D, sp48, 0, 1.0f, 1.0f, 1, 0, 1, 0, *(u8 *)((s32)arg5 + 0xC), arg5->unk1);
}

void func_15137F30(Vec3f37F30 *arg0, Vec3f37F30 *arg1, Vec3f37F30 *arg2, Vec3f37F30 *arg3, f32 arg4, Struct37F30 *arg5, Vec3f37F30 *arg6, Vec3f37F30 *arg7, Vec3f37F30 *arg8, f32 *arg9, s16 *argA, u8 *argB, f32 *argC) {
    arg6->x = arg0->x + arg2->x * arg4;
    arg6->y = arg0->y + arg2->y * arg4;
    arg6->z = arg0->z + arg2->z * arg4;
    arg7->x = arg1->x + arg3->x * arg4;
    arg7->y = arg1->y + arg3->y * arg4;
    arg7->z = arg1->z + arg3->z * arg4;
    arg8->x = (arg7->x - arg6->x) * arg5->unk74;
    arg8->y = (arg7->y - arg6->y) * arg5->unk74;
    arg8->z = (arg7->z - arg6->z) * arg5->unk74;
    *arg9 = (func_150ADA68() * 217.0f + -456.0f) * D_800A482C;
    *argA = (u32) func_150ADA20() % 0x1F + 0x1E;
    *argB = (u32) func_150ADA20() % 0x9C + 0x64;
    *argC = func_150ADA68() * 35.0f + 40.0f;
}

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

void func_15138120(struct127 *arg0, s32 arg1, u8 arg2) {
    Local15138120 tmp;

    if (D_800A3FD8[(arg1 << 4) + 0xE] != 2) {
        tmp.unk00 = arg0->unique_id;
        tmp.unk04 = arg0;
        if (arg2) {
            tmp.unk08 = 0xC;
        } else {
            tmp.unk08 = 1;
        }
        tmp.unk24 = 2;
        tmp.unk26 = 0x28;
        tmp.unk28 = 0x10;
        tmp.unk0C = 0.0f;
        tmp.unk10 = 0.0f;
        tmp.unk14 = 0.0f;
        tmp.unk18 = 0.0f;
        tmp.unk20 = 0.0f;
        tmp.unk1C = 20.0f;
        if ((D_800A4058 == &D_800A3FD8[arg1 << 4]) || (D_800A4068 == &D_800A3FD8[arg1 << 4])) {
            tmp.unk2A = (arg0->unk94 & 0xE) ? 0x78 : 0xF0;
        } else {
            tmp.unk2A = 0x258;
        }
        tmp.unk2E = 5;
        if (D_800A3FD8[(arg1 << 4) + 0xE] == 0) {
            tmp.unk2F = 5;
        } else {
            tmp.unk2F = 6;
        }
        tmp.unk30 = -1;
        tmp.unk38 = 0;
        tmp.unk39 = -1;
        tmp.unk34 = 1.0f;
        tmp.unk2C = func_1000FA64(0x4FE, (s16)(s32)arg0->x_position,
                                  (s16)(s32)arg0->y_position,
                                  (s16)(s32)arg0->z_position, 0x5DC0,
                                  0x258, 0x12C, (s32)func_1000EBC4,
                                  (void *)0x78, 0, 0, 0);
        func_15134DAC(&tmp, 0);
    }
}

typedef struct {
    s32 a;
    s32 b;
    s32 c;
} Vec3w382E0;

typedef struct {
    s16 unk0;
    s16 unk2;
    s16 unk4;
    s16 unk6;
    Vec3w382E0 unk8;
    f32 unk14;
    f32 unk18;
    f32 unk1C;
    f32 unk20;
    f32 unk24;
    f32 unk28;
    s16 unk2C;
    s16 unk2E;
    s16 unk30;
    s16 unk32;
    s16 unk34;
    s16 unk36;
    s16 unk38;
    s16 unk3A;
    u8  unk3C;
    u8  pad3D[3];
    f32 unk40;
    s16 unk44;
    s16 unk46;
    s32 unk48;
} Local151382E0;

extern f32 D_800A4830, D_800A4834, D_800A4838, D_800A483C, D_800A4840;
extern u8 D_800A3FE6[];
extern void func_15153F18(Local151382E0 *, Vec3w382E0 *, void *, u8, s32);

void func_151382E0(void *arg0, s32 arg1, void *arg2, u8 arg3, s32 arg4) {
    Local151382E0 sp24;

    if (D_800A3FE6[arg1 * 16] != 2) {
        sp24.unk8 = *(Vec3w382E0 *) arg0;
        sp24.unk2C = 0x12;
        sp24.unk2E = 7;
        sp24.unk2 = 0xFF;
        sp24.unk0 = 0;
        sp24.unk4 = -63;
        sp24.unk6 = 78;
        sp24.unk30 = 3;
        sp24.unk32 = 3;
        sp24.unk14 = D_800A4830;
        sp24.unk18 = D_800A4834;
        sp24.unk1C = D_800A4838;
        sp24.unk20 = D_800A483C;
        sp24.unk24 = 4.0f;
        sp24.unk28 = 9.0f;
        sp24.unk34 = 0x14;
        sp24.unk36 = 0x1E;
        sp24.unk38 = 0x9B;
        sp24.unk3A = 0x64;
        sp24.unk44 = 0x10;
        sp24.unk46 = 0xF;
        sp24.unk48 = 0;
        sp24.unk40 = D_800A4840;
        if (D_800A3FE6[arg1 * 16] == 1) {
            sp24.unk3C = 1;
        } else {
            sp24.unk3C = 0;
        }
        func_15153F18(&sp24, &sp24.unk8, arg2, arg3, arg4);
    }
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_15138424.s")

#pragma GLOBAL_ASM("asm/nonmatchings/game_161520/func_151389A8.s")

void func_15138BC0(struct102 *arg0, u8 arg1, s32 arg2) {
    u8 sp50[8];
    u8 sp28[0x27];
    s32 temp_s1;

    temp_s1 = func_15134070(arg0);
    if (temp_s1 != 0x63) {
        sp28[0x1F] = func_151380B4(arg0, temp_s1, sp50 - 8);
        func_15138120(arg0, temp_s1, 1);
        if (sp28[0x1F] != 0) {
            func_1504715C(sp28 - 8, arg0);
            func_151382E0(sp50 - 8, temp_s1, sp28 - 8, arg1, arg2);
            func_15138424(arg0, sp50 - 8, temp_s1, sp28 - 8, arg1, arg2);
        }
    }
}

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

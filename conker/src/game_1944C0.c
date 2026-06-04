#include <ultra64.h>

#include "functions.h"
#include "variables.h"

extern void (*D_8008CB64[])(void);
extern void (*D_8008CB70[])(void);

void func_15168A4C(struct12 *arg0, s32 arg1);

void func_15169040(void *, u8);

extern void (*D_8008CA20[])(struct127 *);

void func_15168B10(s32 arg0, s32 arg1);

extern u8 D_800DCE50[];
extern u8 D_800D2DAB;


#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_15167010.s")
// NON-MATCHING: not hugely far away
// void func_15167010(void) {
//     void (*func)(void);
//     s32 i;
//
//     for (i = 0; i < 24; i++)
//     {
//         func = D_8008B4A8[i].unk18;
//         if (func != NULL) {
//             func();
//         }
//     }
// }

void func_1516706C(void) {
    void (**ptr)(void);
    void (**end)(void);
    void (*func)(void);

    ptr = D_8008CB64, end = D_8008CB70;
    do {
        func = *ptr;
        if (func != NULL) {
            func();
        }
        ptr++;
    } while (ptr != end);
}
#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_151670C0.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_151671E8.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_15167310.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_151674F8.s")
void *func_15167A68(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4, s32 arg5) {
    void *temp_v0;
    temp_v0 = (void *)func_10003C6C(arg2, 1, arg3, 0, (u8)arg5);
    if (temp_v0 != NULL) {
        *(u8 *)((s32)temp_v0 + 1) = arg1;
        func_15168A4C(temp_v0, arg0);
        *(u8 *)((s32)temp_v0 + 0xC) = *((u8 *)&arg4 + 3);
    }
    return temp_v0;
}
void func_15167AD8(void *arg0, u8 arg1, s32 arg2) {
    void *temp_v0 = func_15167A68(3, arg2, 0x28, 0, arg1, 1);
    if (temp_v0 != NULL) {
        bcopy(arg0, (void *)((s32)temp_v0 + 0x10), 0x18);
        *(u8 *)((s32)temp_v0 + 0x23) = 0xFF;
    }
}
void func_15167B44(struct127 *arg0) {
    s32 temp_v0;
    s32 temp_v1;
    s32 temp_a1;
    s16 temp_a2;

    temp_v0 = *(u8 *)((s32)arg0 + 0x24);
    if (temp_v0 != 0) {
        D_8008CA20[temp_v0](arg0);
    }

    temp_v1 = *(s8 *)((s32)arg0 + 0x22);
    if (temp_v1 > 0) {
        temp_v0 = *(u8 *)((s32)arg0 + 0x23);
        if (temp_v1 < temp_v0) {
            *(u8 *)((s32)arg0 + 0x23) = temp_v0 - temp_v1;
        } else {
            *(s16 *)((s32)arg0 + 0x14) = *(u8 *)(*(s32 *)((s32)arg0 + 0x10) + 4) << 8;
        }
    } else if (temp_v1 < 0) {
        temp_a1 = -temp_v1;
        temp_a2 = *(s16 *)((s32)arg0 + 0x14);
        if ((temp_a2 / 256) >= (*(u8 *)(*(s32 *)((s32)arg0 + 0x10) + 4) - 1)) {
            temp_v0 = *(u8 *)((s32)arg0 + 0x23);
            if (temp_a1 < temp_v0) {
                *(u8 *)((s32)arg0 + 0x23) = temp_v0 - temp_a1;
                *(s16 *)((s32)arg0 + 0x14) = temp_a2 - *(s16 *)((s32)arg0 + 0x16);
            }
        }
    }

    *(s16 *)((s32)arg0 + 0x14) += *(s16 *)((s32)arg0 + 0x16);
    if ((*(s16 *)((s32)arg0 + 0x14) / 256) >= *(u8 *)(*(s32 *)((s32)arg0 + 0x10) + 4)) {
        func_1516972C(arg0);
    }
}
#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_15167C58.s")
void *func_15167D84(void *arg0, s32 arg1, s32 arg2, s8 arg3, u8 arg4, s32 arg5) {
    void *temp_v0;
    s32 temp_a0;

    if (arg1 == 0) {
        temp_a0 = 5;
    } else {
        temp_a0 = 0x42;
    }
    temp_v0 = func_15167A68(temp_a0, arg5, arg2 + 0x50, 0, arg4, 1);
    if (temp_v0 == NULL) {
        return temp_v0;
    }
    bcopy(arg0, (void *)((s32)temp_v0 + 0x10), 0x38);
    *(s8 *)((s32)temp_v0 + 0x48) = arg3;
    return temp_v0;
}
#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_15167E0C.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_15168118.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_1516865C.s")
void *func_15168800(void *arg0, u8 arg1, s32 arg2) {
    void *temp_v0;
    temp_v0 = func_15167A68(0xE, arg2, 0xB8, 1, arg1, 1);
    if (temp_v0 == NULL) {
        return NULL;
    }
    bcopy(arg0, (void *)((s32)temp_v0 + 0x10), 0xA8);
    return temp_v0;
}
#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_15168870.s")
void func_15168A2C(s32 arg0) {
    func_15168B10(arg0, 0);
}

void func_15168A4C(struct12 *arg0, s32 arg1) {
    s32 temp_v0 = *((u8 *)arg0 + 1);
    struct12 **temp_v1 = (struct12 **)&D_800DCE50[(temp_v0 * 0x1A0) + (arg1 * 4)];

    *(struct12 **)((s32)arg0 + 8) = *temp_v1;
    if (*(struct12 **)((s32)arg0 + 8) != NULL) {
        *(struct12 **)((s32)*(struct12 **)((s32)arg0 + 8) + 4) = arg0;
    }
    *(u8 *)arg0 = arg1;
    *(struct12 **)((s32)arg0 + 4) = NULL;
    *temp_v1 = arg0;
}
void func_15168A9C(struct12 *arg0) {
    s32 temp_v0 = *((u8 *)arg0 + 1);
    s32 temp_v1 = *(u8 *)arg0;
    u8 *temp_t9 = D_800DCE50;
    struct12 **temp_a1 = (struct12 **)&temp_t9[(temp_v0 * 0x1A0) + (temp_v1 * 4)];
    struct12 *temp_v0_2;

    if (arg0 == *temp_a1) {
        *temp_a1 = *(struct12 **)((s32)arg0 + 8);
    }
    temp_v0_2 = *(struct12 **)((s32)arg0 + 8);
    if (temp_v0_2 != NULL) {
        *(struct12 **)((s32)temp_v0_2 + 4) = *(struct12 **)((s32)arg0 + 4);
    }
    temp_v0_2 = *(struct12 **)((s32)arg0 + 4);
    if (temp_v0_2 != NULL) {
        *(struct12 **)((s32)temp_v0_2 + 8) = *(struct12 **)((s32)arg0 + 8);
    }
}

// void *func_15168A9C(struct12 *arg0) {
//     void *temp_a1;
//     void *temp_v0;
//     void *temp_v0_2;
//
//     temp_a1 = (arg0->unk1 * 0x1A0) + (arg0->unk0 * 4) + 0x800DCE50;
//     if (arg0 == *temp_a1) {
//         *temp_a1 = (void *) arg0->unk8;
//     }
//     temp_v0_2 = arg0->unk8;
//     if (temp_v0_2 != 0) {
//         temp_v0_2->unk4 = (void *) arg0->unk4;
//     }
//     temp_v0 = arg0->unk4;
//     if (temp_v0 != 0) {
//         temp_v0->unk8 = (void *) arg0->unk8;
//     }
//     return temp_v0;
// }


void func_15168B10(s32 arg0, s32 arg1) {
    func_15168A9C(arg0);
    func_15168A4C(arg0, arg1);
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_15168B44.s")
void func_15168BAC(struct127 *arg0) {
    u8 temp_v0 = *(u8 *)((s32)arg0 + 0xE4);
    if (temp_v0 != 0) {
        D_8008CA20[temp_v0](arg0);
    }
}

void *func_15167A68(s32, s32, s32, s32, s32, s32);
void func_15168BE4(void *arg0, u8 arg1, s32 arg2) {
    void *temp_v0;
    if (*(s32 *)((s32)arg0 + 0x40) != 0) {
        temp_v0 = func_15167A68(0x10, arg2, 0xF0, 1, arg1, 1);
        if (temp_v0 != NULL) {
            bcopy(arg0, (void *)((s32)temp_v0 + 0x90), 0x60);
        }
    }
}
#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_15168C4C.s")
void func_15168E34(s32 *arg0, s32 arg1) {
    s32 temp_v0 = *arg0;

    if ((temp_v0 & 0x0F000000) == 0) {
        *arg0 = temp_v0 + arg1;
    }
}
#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_15168E54.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_15168F08.s")
void func_15168F84(s32 arg0, s32 *arg1, s32 *arg2) {
    if (arg0 == 0) {
        *arg1 = 1;
        *arg2 = 0x41;
        return;
    }
    if (arg0 == 1) {
        *arg1 = 0x42;
        *arg2 = 0x4F;
        return;
    }
    if (arg0 == 2) {
        *arg1 = 0x50;
        *arg2 = 0x58;
        return;
    }
    if (arg0 == 3) {
        *arg1 = 0x59;
        *arg2 = 0x5C;
        return;
    }
    if (arg0 == 5) {
        *arg1 = 0x61;
        *arg2 = 0x63;
        return;
    }
    if (arg0 == 6) {
        *arg1 = 0x64;
        *arg2 = 0x65;
        return;
    }
    *arg1 = 0x5D;
    *arg2 = 0x60;
}
#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_15169040.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_15169070.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_15169260.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_1516944C.s")
void func_151695F0(struct127 *arg0, u8 arg1) {
    struct {
        s32 unk0;
        u8 unk4;
    } sp18;

    sp18.unk0 = (s32)arg0;
    sp18.unk4 = arg0->unique_id;
    func_15169040(&sp18, arg1);
}
void func_1516962C(s32 arg0, struct127 *arg1, u8 arg2) {
    struct {
        s32 unk0;
        u8 unk4;
    } sp18;
    sp18.unk0 = (s32)arg1;
    sp18.unk4 = arg1->unique_id;
    func_1516944C(arg0, (s32)&sp18, arg2);
}

s32 func_15169668(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    D_800D2DAB = 1;
    return arg0;
}
void func_1516968C(struct102 *arg0, u8 *arg1, u8 arg2) {
    if ((arg2 == 15) || (arg2 == 16)) {
        if (*arg1 == *((u8 *)arg0 + 0xC)) {
            func_1516972C(arg0);
        }
    }
}
void func_151696DC(arg0)
struct102 *arg0;
{
    s32 temp_v0;
    s32 temp_v1;
    u8 *temp_a2;
    s32 temp_t6;
    struct102 **temp_a1;

    for (temp_v0 = 0, temp_v1 = D_800DD190, temp_a2 = D_800DD198; temp_v0 < temp_v1; temp_v0 = (s8)(temp_v0 + 1)) {
        temp_t6 = temp_v0 << 2;
        temp_a1 = (struct102 **)&temp_a2[temp_t6];
        if (arg0 == *temp_a1) {
            *temp_a1 = *(struct102 **)((s32)arg0 + 8);
        }
    }
}

void func_1516972C(struct102 *arg0) {
    void (*func)(struct102 *arg0);
    func_151696DC();

    if (arg0->unk0 >= 2) {
        func = D_8008B4D0[arg0->unk0].unk0;
        if (func != NULL) {
            func(arg0);
            return;
        }
        func_15169804(arg0);
    }
}

void func_1516979C(struct102 *arg0) {
    void (*func)(struct102 *arg0);

    func_151696DC();
    func = D_8008B4D4[arg0->unk0].unk0;
    if (func != NULL) {
        func(arg0);
        return;
    }
    func_15169824(arg0);
}

void func_15169804(struct102 *arg0) {
    func_15168B10(arg0, 1);
}

void func_15169824(struct102 *arg0) {
    func_15168A9C(arg0);
    func_10004074(arg0);
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_1944C0/func_15169850.s")

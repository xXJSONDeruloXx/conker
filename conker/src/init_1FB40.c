#include <n_libaudio.h>


extern s32 D_800E0E04;
extern u8 D_800428C4[];
extern u8 D_800428C6[];

typedef struct { u32 w0; u32 w1; } Cmd;

typedef struct {
    u8 pad0[0x2];
    s16 unk2;
    u8 pad4[0x4];
    s32 unk8;
    u8 padC[0x1C];
    s32 unk28;
    void *unk2C;
    void *unk30;
} Filter;

typedef struct {
    u8 pad0[0x40];
    Filter *unk40;
} AuxEntry;

typedef Cmd *(*Handler)(s32, Cmd *, s32);

typedef struct {
    u8 pad0[0x4];
    Handler unk4;
} MainBus;

typedef struct {
    u8 pad0[0x44];
    MainBus *unk44;
    AuxEntry *unk48;
    u8 pad4C[0x4];
    s32 unk50;
    s32 unk54;
} Synth;

void func_1001CF38(void *, f32);

#define S ((Synth *) n_syn)

Cmd *func_1001FB40(s32 arg0, Cmd *arg1) {
    Cmd *sp54;
    s32 sp50;
    s32 sp4C;
    Cmd *sp48;
    Cmd *sp44;
    Cmd *sp40;
    Cmd *sp3C;
    Cmd *sp38;
    Cmd *sp34;
    Cmd *sp30;
    Cmd *sp2C;
    Filter *sp28;
    Cmd *sp24;
    Cmd *sp20;
    Cmd *sp1C;

    sp54 = arg1;
    if ((D_800E0E04 == 0) || (func_151F2E88(0xB8, &sp54) == 0)) {
        sp48 = sp54++;
        sp48->w0 = 0x20004E0;
        sp48->w1 = 0x2E0;
        sp44 = sp54++;
        sp44->w0 = 0x20007C0;
        sp44->w1 = 0x2E0;
    }
    sp4C = 0;
    for (sp50 = 1; sp50 < S->unk50; sp50++) {
        if (S->unk48[sp50].unk40->unk2 > 0) {
            sp4C = sp50;
        }
    }
    for (sp50 = 0; sp50 < S->unk50; sp50++, sp4C++) {
        if (sp4C >= S->unk50) {
            sp4C = 0;
        }
        if (sp50 != 0) {
            sp40 = sp54++;
            sp40->w0 = 0x20007C0;
            sp40->w1 = 0x2E0;
        }
        sp54 = S->unk44->unk4(arg0, sp54, sp4C);
        if (D_800428C4[sp4C] != 0) {
            if (D_800428C6[sp4C] != 0) {
                sp3C = sp54++;
                sp3C->w0 = 0xC008000;
                sp3C->w1 = 0x7C004E0;
                goto block1;
            }
            sp38 = sp54++;
            sp38->w0 = 0xC007FFF;
            sp38->w1 = 0x7C00650;
        block1:
            ;
        } else {
            if (D_800428C6[sp4C] != 0) {
                sp34 = sp54++;
                sp34->w0 = 0xC008000;
                sp34->w1 = 0x7C00650;
                goto block2;
            }
            sp30 = sp54++;
            sp30->w0 = 0xC007FFF;
            sp30->w1 = 0x7C00650;
        block2:
            sp2C = sp54++;
            sp2C->w0 = 0xC007FFF;
            sp2C->w1 = 0x7C004E0;
        }
        if (S->unk48[sp4C].unk40->unk2 > 0) {
            sp28 = S->unk48[sp4C].unk40;
            if (sp28->unk28 != 0) {
                func_1001CF38(sp28, (f32)S->unk54);
            }
            sp24 = sp54++;
            sp24->w0 = 0xB000020;
            sp24->w1 = osVirtualToPhysical(&sp28->unk8);
            sp20 = sp54++;
            sp20->w0 = 0xE0004E0;
            sp20->w1 = osVirtualToPhysical(sp28->unk2C) & 0xFFFFFF & 0xFFFFFF;
            sp1C = sp54++;
            sp1C->w0 = 0xE000650;
            sp1C->w1 = osVirtualToPhysical(sp28->unk30) & 0xFFFFFF & 0xFFFFFF;
            sp28->unk28 = 0;
        }
    }
    return sp54;
}
// void *func_1001FB40(s32 arg0, void *arg1) {
//     void *sp54;
//     s32 sp50;
//     s32 sp4C;
//     void *sp48;
//     void *sp44;
//     void *sp40;
//     void *sp3C;
//     void *sp38;
//     void *sp34;
//     void *sp30;
//     void *sp2C;
//     void *sp28;
//     void *sp24;
//     void *sp20;
//     void *sp1C;
//     s32 temp_t2;
//     s32 temp_t6_2;
//     void *temp_t0;
//     void *temp_t0_2;
//     void *temp_t1;
//     void *temp_t2_2;
//     void *temp_t4;
//     void *temp_t5;
//     void *temp_t5_2;
//     void *temp_t6;
//     void *temp_t7;
//     void *temp_t8;
//     void *temp_t8_2;
//
//     sp54 = arg1;
//     if ((D_800E0E04 == 0) || (func_151F2E88(0xB8, &sp54) == 0)) {
//         temp_t8 = sp54;
//         sp54 = temp_t8 + 8;
//         sp48 = temp_t8;
//         sp48->unk0 = 0x20004E0;
//         sp48->unk4 = 0x2E0;
//         temp_t4 = sp54;
//         sp54 = temp_t4 + 8;
//         sp44 = temp_t4;
//         sp44->unk0 = 0x20007C0;
//         sp44->unk4 = 0x2E0;
//     }
//     sp4C = 0;
//     sp50 = 1;
//     if (D_8002BA44->unk50 >= 2) {
// loop_4:
//         if ((s32) (D_8002BA44->unk48 + (sp50 * 0x44))->unk40->unk2 > 0) {
//             sp4C = sp50;
//         }
//         temp_t2 = sp50 + 1;
//         sp50 = temp_t2;
//         if (temp_t2 < D_8002BA44->unk50) {
//             goto loop_4;
//         }
//     }
//     sp50 = 0;
//     if (D_8002BA44->unk50 > 0) {
// loop_8:
//         if (sp4C >= D_8002BA44->unk50) {
//             sp4C = 0;
//         }
//         if (sp50 != 0) {
//             temp_t1 = sp54;
//             sp54 = temp_t1 + 8;
//             sp40 = temp_t1;
//             sp40->unk0 = 0x20007C0;
//             sp40->unk4 = 0x2E0;
//         }
//         sp54 = D_8002BA44->unk44->unk4(arg0, sp54, sp4C);
//         if (*(&D_800428C4 + sp4C) != 0) {
//             if (*(&D_800428C6 + sp4C) != 0) {
//                 temp_t5 = sp54;
//                 sp54 = temp_t5 + 8;
//                 sp3C = temp_t5;
//                 sp3C->unk0 = 0xC008000;
//                 sp3C->unk4 = 0x7C004E0;
//             } else {
//                 temp_t0 = sp54;
//                 sp54 = temp_t0 + 8;
//                 sp38 = temp_t0;
//                 sp38->unk0 = 0xC007FFF;
//                 sp38->unk4 = 0x7C00650;
//             }
//         } else {
//             if (*(&D_800428C6 + sp4C) != 0) {
//                 temp_t7 = sp54;
//                 sp54 = temp_t7 + 8;
//                 sp34 = temp_t7;
//                 sp34->unk0 = 0xC008000;
//                 sp34->unk4 = 0x7C00650;
//             } else {
//                 temp_t5_2 = sp54;
//                 sp54 = temp_t5_2 + 8;
//                 sp30 = temp_t5_2;
//                 sp30->unk0 = 0xC007FFF;
//                 sp30->unk4 = 0x7C00650;
//             }
//             temp_t0_2 = sp54;
//             sp54 = temp_t0_2 + 8;
//             sp2C = temp_t0_2;
//             sp2C->unk0 = 0xC007FFF;
//             sp2C->unk4 = 0x7C004E0;
//         }
//         if ((s32) D_8002BA44->unk48[sp4C]->unk40->unk2 > 0) {
//             sp28 = D_8002BA44->unk48[sp4C]->unk40;
//             if (sp28->unk28 != 0) {
//                 func_1001CF38(sp28, (f32) D_8002BA44->unk54);
//             }
//             temp_t2_2 = sp54;
//             sp54 = temp_t2_2 + 8;
//             sp24 = temp_t2_2;
//             sp24->unk0 = 0xB000020;
//             sp24->unk4 = osVirtualToPhysical(sp28 + 8);
//             temp_t8_2 = sp54;
//             sp54 = temp_t8_2 + 8;
//             sp20 = temp_t8_2;
//             sp20->unk0 = 0xE0004E0;
//             sp20->unk4 = (s32) (osVirtualToPhysical(sp28->unk2C) & 0xFFFFFF & 0xFFFFFF);
//             temp_t6 = sp54;
//             sp54 = temp_t6 + 8;
//             sp1C = temp_t6;
//             sp1C->unk0 = 0xE000650;
//             sp1C->unk4 = (s32) (osVirtualToPhysical(sp28->unk30) & 0xFFFFFF & 0xFFFFFF);
//             sp28->unk28 = 0;
//         }
//         temp_t6_2 = sp50 + 1;
//         sp4C = sp4C + 1;
//         sp50 = temp_t6_2;
//         if (temp_t6_2 < D_8002BA44->unk50) {
//             goto loop_8;
//         }
//     }
//     return sp54;
// }

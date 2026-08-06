#include <ultra64.h>

struct Obj1513BEB0 {
    u8 pad0[0x50];
    s32 unk50;
};


#include "functions.h"
#include "variables.h"

extern f32 D_800A4A84;
extern f32 D_800A4A88;
extern f32 D_800A4A8C;
extern f32 D_800A4A90;
extern f32 D_800A4A94;

void func_15109064(struct132 *, s32, u8);
void func_151BA468(struct132 *, s32, u8);

typedef struct {
    u8  pad0[0x10];
    u8  unk10;
    u8  pad11[0x1];
    s8  unk12;
    u8  pad13[0x36];
    u8  unk49;
    u8  pad4A[0xA];
    s32 unk54;
} Obj168A90B;

extern s32 (*D_80089C28[])(Obj168A90B *, s32);


#pragma GLOBAL_ASM("asm/nonmatchings/game_168A90/func_1513B5E0.s")
void func_1513B798(struct102 *arg0) {
    s32 idx;
    u8 done = 0;

    if (*((u8 *)arg0 + 0x10) & 1) {
        *(s16 *)((u8 *)arg0 + 0x14) -= D_800BE9E4;
        if (*(s16 *)((u8 *)arg0 + 0x14) < 0) {
            done = 1;
        }
    }
    if (!done) {
        idx = *(s8 *)((u8 *)arg0 + 0x11);
        if (idx != -1) {
            if (D_80089C18[idx](arg0) == 0) {
                done = 1;
            }
        }
    }
    if (done) {
        func_1516972C(arg0);
    }
}
Gfx *func_1513B83C(Gfx *arg0, Obj168A90B *arg1, s16 arg2) {
    s8 v0;

    if (((arg1->unk10 & 2) != 0) && ((arg1->unk49 & (1 << arg2)) == 0)) {
        return arg0;
    }
    v0 = arg1->unk12;
    if (v0 != -1) {
        if (D_80089C28[v0](arg1, (arg2 << 0x10) >> 0x10) == 0) {
            return arg0;
        }
    }
    { Gfx *g = arg0++; g->words.w0 = 0xDA380003; g->words.w1 = (u32)((u8 *)arg1 + (D_800BE9C0 << 6) + 0x78); }
    { Gfx *g = arg0++; g->words.w0 = 0xDB060004; g->words.w1 = *(u32 *)((u8 *)arg1 + (D_800BE9C0 << 4) + (arg2 << 2) + 0x58); }
    { Gfx *g = arg0++; g->words.w0 = 0xDE000000; g->words.w1 = arg1->unk54; }
    return arg0;
}

s32 func_1513B968(s32 arg0, s32 arg1) {
    // FIXME: &arg0->unk_120[D_800BE9C0]
    func_150A7B80(arg0 + 120 + (D_800BE9C0 << 6));
    return 1;
}

void func_1513B9A8(struct132 *arg0) {
    func_100043B4(arg0->unk4C, 4);
    func_15169804(arg0);
}

void func_1513B9DC(struct132 *arg0) {
    func_100043B4(arg0->unk4C, 4);
    func_15169824(arg0);
}

void func_1513BA10(struct132 *arg0) {
    D_80089C44[arg0->unk48]();
}

void func_1513BA44(struct132 *arg0) {
    D_80089C54[arg0->unk48]();
}

void func_1513BA78(struct132 *arg0, s32 arg1, u8 arg2) {
    switch (arg0->unk48) {
        case 1:
            func_15109064(arg0, arg1, arg2);
            break;
        case 2:
            func_151BA468(arg0, arg1, arg2);
            break;
    }
}

s32 func_1513BAD4(s32 arg0, s32 arg1) {
    return 0;
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_168A90/func_1513BAE8.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_168A90/func_1513BBFC.s")
s32 func_1513BEB0(struct Obj1513BEB0 *arg0) {
    f32 *v0;

    v0 = (f32 *)((u8 *)arg0 + arg0->unk50 + 0xF8);
    v0[2] = v0[2] + D_800A4A84 * D_800BE9A4;
    v0[2] = func_15144B68(v0[2]);
    v0[0] = v0[0] + D_800A4A88 * D_800BE9A4;
    v0[1] = sinf(v0[2]) * D_800A4A8C;
    v0[3] = v0[3] + D_800A4A90 * D_800BE9A4;
    v0[4] = v0[4] + D_800A4A94 * D_800BE9A4;
    v0[3] = func_15144B68(v0[3]);
    v0[4] = func_15144B68(v0[4]);

    if (4096.0f < v0[0]) {
        do {
            v0[0] = v0[0] - 4096.0f;
        } while (4096.0f < v0[0]);
    }
    if (v0[0] < 0.0f) {
        do {
            v0[0] = v0[0] + 4096.0f;
        } while (v0[0] < 0.0f);
    }
    if (4096.0f < v0[1]) {
        do {
            v0[1] = v0[1] - 4096.0f;
        } while (4096.0f < v0[1]);
    }
    if (v0[1] < 0.0f) {
        do {
            v0[1] = v0[1] + 4096.0f;
        } while (v0[1] < 0.0f);
    }
    return 1;
}

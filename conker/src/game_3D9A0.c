#include <ultra64.h>
#include "functions.h"
#include "variables.h"

extern u8 D_800D9946[];
typedef struct {
    u8 unk[3];
    u8 pad3[0x5];
    s32 unk8;
    u8 padC[0x70];
    f32 unk7C;
} struct263_local;

extern struct263_local D_800D9950;
struct263_local *func_151149AC(u32);

void func_150104F0(void) {
    D_800D9950.unk[0] = D_800D9950.unk[1] = D_800D9950.unk[2] = 0;
    func_151149AC(0xF6)->unk7C = 2.0f;
    D_80088980 = 0;
}

void func_15010538(struct127 *arg0) {
    struct175 tmp;
    struct37 *temp_v0;

    func_15161E24(arg0, 2, 2, 300, 30, 100, 200, 255, 255, 1);
// FAKEMATCH but works...
dummy_label_927029:
    tmp.unk0 = arg0;
    tmp.unk4 = arg0->unique_id;
    tmp.unk6 = 0;
    tmp.unk8 = 0;
    tmp.unkA = 0;

    temp_v0 = func_15149130(300, -1, 80, -1, 0, 61, 12, 255, 1);
    if (temp_v0 != NULL) {
        memcpy(&temp_v0->unk28, &tmp, 12); // memcpy
    }
}

void func_15010600(void) {
    s32 i;

    D_800D9921 = 0;
    D_800D9920 = 0;
    D_800D9928 = 0;
    D_800D9938 = 0;
    D_800D9929 = 0;
    for (D_800D9939 = 0, i = 0;;) {
        D_800D992A[i + 1] = 0;
        D_800D993A[i + 1] = 0;
        D_800D992A[i + 2] = 0;
        D_800D993A[i + 2] = 0;
        D_800D992A[i + 3] = 0;
        D_800D993A[i + 3] = 0;
        i += 4;
        D_800D992A[i - 4] = 0;
        D_800D993A[i - 4] = 0;
        if (&D_800D9946[0] != &D_800D993A[i]) {
            continue;
        }
        break;
    }
}
// NON-MATCHING: addresses are wrong :(
// void func_15010600(void) {
//     s32 i;
//
//     for (i = 0; i < 11; i++) {
//         D_800D9930[i] = D_800D9920[i] = 0;
//     }
// }

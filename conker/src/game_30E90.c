#include <ultra64.h>
typedef struct { s8 unk0; s8 unk1; s8 unk2; u8 unk3; u32 unk4; } Struct15004CE0;


#include "functions.h"
#include "variables.h"


#pragma GLOBAL_ASM("asm/nonmatchings/game_30E90/func_150039E0.s")

// FIXME: matches but something isnt right
void func_15004574(void) {
    if (D_800DBF88 != 0xFF) {
        D_800DBF8C = D_800DBEF4[D_800DBF88].unk1C;
        D_800DBF90 = D_800DBEF4[D_800DBF88].unk28;
    }
}

void func_150045BC(void) {
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_30E90/func_150045C4.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_30E90/func_150049A4.s")
void func_15004A4C(void) {
    s32 i;
    for (i = 0; i < D_800DBEF0; i++) {
        (*(s32 **)D_800DBEF8)[i] = 0;
        (*(s8 **)D_800DBEFC)[i] = 0;
    }
}
// NON-MATCHING: not this...
// void func_15004A4C(void) {
//     u32 i;
//     for (i = 0; i < D_800DBEF0; i++) {
//         D_800DBEFC[i] = D_800DBEF8[i] = 0;
//         // D_800DBEFC[i] = 0;
//     }
// }

#pragma GLOBAL_ASM("asm/nonmatchings/game_30E90/func_15004AAC.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_30E90/func_15004BF0.s")
void func_15004CE0(Struct15004CE0 *arg0, u32 arg1) {
    s32 i = 0;
    Struct15004CE0 *p = arg0;
    s8 tag;
    if (arg0->unk0 == (-0x21)) {
        return;
    }
    p = &arg0[i];
    tag = p->unk0;
    do {
        i++;
        if (p->unk0 == (-0x24)) {
            if (p->unk3 == 0xE) {
                if (p->unk4 < 0x80000000) {
                    p->unk4 += arg1;
                }
            }
        }
        p = &arg0[i];
        do { tag = p->unk0; } while (0);
    } while (p->unk0 != (-0x21));
}

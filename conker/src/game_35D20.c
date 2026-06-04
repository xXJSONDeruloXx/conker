#include <ultra64.h>
#include "functions.h"
#include "variables.h"

extern u8 D_800DCE50[];

// loops and loops
void func_15008870(s32 arg0) {
    s32 i;
    s32 j;
    s32 start;
    s32 end;

    start = 0;
    end = 0x68;
    if (arg0 == 1) {
        end = 0x65;
    } else if (arg0 == 2) {
        start = 0x65;
    }

    for (i = 0; i < 2; i++) {
        for (j = start; j < end; j++) {
            *(s32 *)(D_800DCE50 + (i * 0x1A0) + (j * 4)) = 0;
        }
    }
}
#pragma GLOBAL_ASM("asm/nonmatchings/game_35D20/func_15008930.s")

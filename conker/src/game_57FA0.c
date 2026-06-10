#include <ultra64.h>

#include "functions.h"
#include "variables.h"

#include "macros.h"

#include "libc/stdarg.h"

s32 func_1502B350(s32 arg0, s32 arg1, s32 *arg2);

s32 func_1502AC88(s32 arg0, s32 arg1, s32 *arg2);
extern u8 D_AB1950[];

void func_1502AAF0(void) {
}

void func_1502AAF8(s32 arg0) {
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_57FA0/func_1502AB04.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_57FA0/func_1502AC88.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_57FA0/func_1502AF04.s")
s32 func_1502B020(s32 *arg0, s32 arg1, ...) {
    va_list args;
    s32 temp_a1;
    s32 offset;
    s32 sp38;

    sp38 = 1;
    offset = (s32) D_AB1950;
    va_start(args, arg1);
    for (; arg1 != 0; arg1--) {
        temp_a1 = va_arg(args, s32);
        if (sp38 != 0) {
            offset += func_1502AC88(offset, temp_a1, &sp38);
        }
        sp38 = sp38 & 0x0FFFFFFF;
    }
    if (arg0 != 0) {
        *arg0 = sp38 & 0x0FFFFFFF;
    }
    if (sp38 == 0) {
        return 0;
    }
    return offset;
}
#pragma GLOBAL_ASM("asm/nonmatchings/game_57FA0/func_1502B110.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_57FA0/func_1502B224.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_57FA0/func_1502B350.s")
#pragma GLOBAL_ASM("asm/nonmatchings/game_57FA0/func_1502B4A8.s")
s32 func_1502B5C8(s32 *arg0, s32 arg1, ...) {
    va_list args;
    s32 *dst;
    s32 temp_a1;
    s32 offset;
    s32 sp40;
    s32 sp38;
    s32 ret;

    dst = &sp40 + 1;
    if (arg0 != NULL) {
        dst = arg0;
    }
    *dst = 1;
    offset = (s32) D_AB1950;
    va_start(args, arg1);
    for (; arg1 != 0; arg1--) {
        temp_a1 = va_arg(args, s32);
        if (*dst != 0) {
            offset += func_1502AC88(offset, temp_a1, &sp38);
        }
        *dst = sp38 & 0x0FFFFFFF;
    }
    if (*dst != 0) {
        ret = func_1502B350(offset, sp38, dst);
    } else {
        ret = 0;
    }
    return ret;
}
s32 func_1502B6BC(s32 *arg0, s32 arg1, s32 *arg2, s32 arg3, ...) {
    va_list args;
    s32 *dst;
    s32 temp_a1;
    s32 offset;
    s32 sp40;
    s32 sp38;
    s32 ret;

    dst = &sp40 + 2;
    if (arg0 != NULL) {
        dst = arg0;
    }
    *dst = 1;
    offset = (s32) D_AB1950;
    va_start(args, arg3);
    for (; arg3 != 0; arg3--) {
        temp_a1 = va_arg(args, s32);
        if (*dst != 0) {
            offset += func_1502AC88(offset, temp_a1, &sp38);
        }
        *dst = sp38 & 0x0FFFFFFF;
    }
    if (*dst != 0) {
        ret = func_1502B350(offset, sp38, dst);
        if ((*dst != 0) && (ret != 0)) {
            arg1 = func_1502B4A8(ret, arg1);
        } else {
            arg1 = 0;
        }
        if (arg2 != 0) {
            *arg2 = arg1;
        }
    } else {
        ret = 0;
    }
    return ret;
}
s32 func_1502B7F0(s32 *arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4) {
    s32 offset;
    va_list args;
    s32 temp_a1;
    s32 sp38;
    s32 sp34;

    sp38 = 1;
    offset = (s32) D_AB1950;
    va_start(args, arg1);
    for (; arg1 != 0; arg1--) {
        temp_a1 = va_arg(args, s32);
        if (sp38 != 0) {
            offset += func_1502AC88(offset, temp_a1, &sp34);
        }
        sp38 = sp34 & 0x0FFFFFFF;
    }
    if (sp38 != 0) {
        *arg0 = func_1502B350(offset, sp34, &sp38);
    } else {
        *arg0 = 0;
    }
    return sp38;
}
// void func_1502B7F0(s32 *arg0, s32 arg1, s32 arg2, s32 arg3) {
//     s32 sp38;
//     s32 sp34;
//     s32 temp_s1;
//     s32 offset;
//     s32 i;
//
//     sp38 = 1;
//     offset = &D_00AB1950; // 0xAB1950 - assets offsets table
//     temp_s1 = &arg2;
//
//     i = arg1;
//     if (i != 0) {
//         do {
//             temp_s1 = ALIGN4(temp_s1);
//             if (sp38 != 0) {
//                 offset += func_1502AC88(offset, temp_s1, &sp34);
//             }
//             sp38 = sp34 & 0xFFFFFFF;
//             temp_s1 += 1;
//         } while (i-- != 0);
//     }
//
//     if (sp38 != 0) {
//         *arg0 = func_1502B350(offset, sp34, &sp38);
//     } else {
//         *arg0 = 0;
//     }
// }

s32 func_1502B8E0(s32 arg0, s32 arg1, s32 arg2, ...) {
    va_list args;
    s32 temp_a1;
    s32 offset;
    s32 more;
    s32 sp34;

    more = 1;
    offset = (s32)D_AB1950;
    va_start(args, arg2);
    if (arg2 != 0) {
        do {
            temp_a1 = va_arg(args, s32);
            if (more != 0) {
                offset += func_1502AC88(offset, temp_a1, &sp34);
            }
            arg2--;
            more = sp34 & 0x0FFFFFFF;
        } while (arg2 != 0);
    }
    if (more != 0) {
        more = func_1502B224(offset, arg0, sp34, arg1);
    }
    return more;
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_57FA0/func_1502B9B4.s")
// NON-MATCHING: maybe 50% there?
// s32 func_1502B9B4(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
//
//     s32 stack2[2];
//     s32 stack1[2];
//     s32 stack0[5];
//
//     s32 more;
//     s32 offset;
//     s32 *tmp;
//     s32 i;
//
//     more = 1;
//     offset = &D_00AB1950;
//     tmp = &arg1;
//
//     for (i = arg0; i != 0; i--) {
//         tmp = ALIGN4(tmp) + 4;
//         if (more != 0) {
//             offset += func_1502AC88(offset, tmp - 4, &stack0);
//         }
//         more = *stack0 & 0xFFFFFFF;
//     }
//
//     if (more != 0) {
//         more = ALIGN2(stack0[0] & 0xFFFFFFF);
//         if ((*stack0 & 0x70000000) == 0x10000000) {
//             if (((s32) &stack1 & 8) != 0) {
//                 *stack1 = &stack2;
//             }
//             func_10004514(offset, stack1, 0x10, 1); // decompress?
//             more = *stack1;
//         }
//     }
//
//     return more;
// }

#include <ultra64.h>
#include "functions.h"
#include "variables.h"


void func_150F6B00(struct108 *arg0) {
    volatile s32 pad[1];
    struct17 sp68;
    struct17 sp5C;
    struct17 sp50;
    f32 sp4C;
    f32 sp48;
    f32 phi_f2;
    f32 temp_f2;
    f32 phi_f0;

    if ((func_1509BE40(1, 0x4003, 6, 0x2000) != 0) && (*(u8 *)((u8 *)arg0->unk3D0 + 0x1CA) != 0)) {
        arg0->unk84 |= 0xC0001000;
        func_15048F90((struct17 *)&D_800A1B80, (struct17 *)&arg0->unk2A4, &sp5C);
        func_15048F90((struct17 *)&D_800A1B80, (struct17 *)&D_800A1B8C, &sp50);
        sp48 = 1.0f / func_150AD930(&sp50.unk0);
        func_1504917C(&sp50, &sp68);
        temp_f2 = func_150AD900(&sp68.unk0, &sp5C.unk0) * sp48 * 0.75f;

        if (temp_f2 < 0.0f) {
            sp4C = 0.0f;
        } else {
            if (temp_f2 > 1.0f) {
                phi_f0 = 1.0f;
            } else {
                phi_f0 = temp_f2;
            }
            sp4C = phi_f0;
        }

        if (func_1509BE40(4, 0x2000, 0xAC, 0x4040, 0x4041, 0x4042, 0x4043) != 0) {
            phi_f0 = (0 * sp4C) + -900.0f;
            arg0->unk374 = 220.0f;
        } else {
            if (func_1509BE40(4, 0x2000, 0xAC, 0x4047, 0x4046, 0x4045, 0x4044) != 0) {
                phi_f0 = (0 * sp4C) + 900.0f;
                arg0->unk374 = 220.0f;
            } else {
                arg0->unk374 = 294.0f;
                phi_f0 = 0 * sp4C;
            }
        }

        phi_f2 = -20.0f;
        func_1509BFB0(3, 0x4003, 3, (s32)phi_f0, (s32)phi_f2, (s32)((D_800A1B98 * sp4C) + D_800A1B9C));
        func_15049688(&arg0->unk37C, func_15048FC8((struct17 *)&D_800D9A50) - 180.0f, (f32 *)&arg0->unk7C8, 8.0f, 10.0f, arg0->unk7B4);
        arg0->unk39C = arg0->unk37C * D_800A1BA0;
    } else {
        arg0->unk84 = arg0->unk84 & 0x3FFFEFFF;
    }
}
// NON-MATCHING: 90% there
// void func_150F6B00(struct108 *arg0) {
//     struct190 tmp;
//
//     f32 phi_f2;
//     f32 temp_f2;
//     f32 phi_f0_2;
//
//     // func_1509BE40 has variable number of args
//     if ((func_1509BE40(1, 16387, 6, 8192) != 0) && (arg0->unk3D0->unk1CA != 0)) {
//         arg0->unk84 |= 0xC0001000;
//         func_15048F90(&D_800A1B80, &arg0->unk2A4, &tmp.unk14);
//         func_15048F90(&D_800A1B80, &D_800A1B8C, &tmp.unk8);
//         tmp.unk0 = 1.0f / func_150AD930(&tmp.unk8);
//         func_1504917C(&tmp.unk8, &tmp.unk20);
//         temp_f2 = func_150AD900(&tmp.unk20, &tmp.unk14) * tmp.unk0 * 0.75f;
//         if (temp_f2 < 0.0f) {
//             phi_f2 = 0.0f;
//         } else {
//             if (temp_f2 > 1.0f) {
//                 phi_f0_2 = 1.0f;
//             } else {
//                 phi_f0_2 = temp_f2;
//             }
//             phi_f2 = phi_f0_2;
//         }
//         tmp.unk4 = phi_f2;
//         if (func_1509BE40(4, 8192, 172, 16448, 16449, 16450, 16451) != 0) {
//             phi_f0_2 = (0.0f * tmp.unk4) + -900.0f;
//             arg0->unk374 = 220.0f;
//         } else {
//             if (func_1509BE40(4, 8192, 172, 16455, 16454, 16453, 16452) != 0) {
//                 phi_f0_2 = (0.0f * tmp.unk4) + 900.0f;
//                 arg0->unk374 = 220.0f;
//             } else {
//                 phi_f0_2 = 0.0f * tmp.unk4;
//                 arg0->unk374 = 294.0f;
//             }
//         }
//         // takes a variable number of args
//         func_1509BFB0(3, 16387, 3, phi_f0_2, -20.0f, ((s32)(D_800A1B98 * phi_f2) + D_800A1B9C));
//         func_15049688(&arg0->unk37C, func_15048FC8(&D_800D9A50) - 180.0f, &arg0->unk7C8, 8.0f, 10.0f, arg0->unk7B4);
//         arg0->unk39C = arg0->unk37C * D_800A1BA0;
//     } else {
//         arg0->unk84 = arg0->unk84 & 0x3FFFEFFF;
//     }
// }

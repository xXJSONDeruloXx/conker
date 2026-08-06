#include <ultra64.h>

typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
} Func151D2C40Data;

typedef u8 Func151D2C40Frame[0x40];


#include "functions.h"
#include "variables.h"

extern s32 (*D_8008FC40[])(struct224 *, Func151D2C40Data *);
extern void (*D_8008FC48[])(struct224 *, Func151D2C40Data *);
extern void (*D_8008FC5C[])(struct224 *);
extern void (*D_8008FC64[])(struct224 *, struct223 *, u8);

void func_151D33FC(struct224 *arg0, struct223 *arg1);

void func_151D3354(struct224 *arg0);
void func_151D3308(struct224 *arg0);

void func_151D2AB0(s32 arg0) {
    u32 tmp;

    (&D_800E0950)[arg0] = (&D_800E0950)[arg0] + 1;

    if ((&D_800E0950)[arg0] < 2) {
        D_800E0990[arg0] = func_1502B5C8(&tmp, 2, 9, D_800AB140[arg0]);
        D_800E0968[arg0] = tmp >> 4;
    }
}

void func_151D2B4C(s32 arg0) {
    if ((&D_800E0950)[arg0] != 0) {
        (&D_800E0950)[arg0] = (&D_800E0950)[arg0] - 1;
        if ((&D_800E0950)[arg0] == 0) {
            func_100043B4(D_800E0990[arg0], 4);
        }
    }
}

struct224 *func_151D2BA4(void *arg0, struct00 *arg1, s32 arg2, u8 arg3, s32 arg4) {
    struct224 *ret;

    ret = func_15167A68(0x3D, arg4, arg2 + 0x48, 1, arg3, 1);
    if (ret == NULL) {
        return NULL;
    }
    memcpy(&ret->unk10, arg0, 0x24);
    *(struct17 *)((s32)ret + 0x34) = *(struct17 *)arg1;
    func_151D3308(ret);
    return ret;
}
// s32 func_15167A68(s32, s32, s32, s32, s32, s32);
// NON-MATCHING: JUSTREG
// struct224 *func_151D2BA4(s32 arg0, struct00 *arg1, s32 arg2, u8 arg3, s32 arg4) {
//     struct224 *tmp = func_15167A68(0x3D, arg4, arg2 + 0x48, 1, arg3, 1);
//
//     if (tmp == 0) {
//         return NULL;
//     }
//
//     memcpy(&tmp->unk10, arg0, 36);
//     tmp->unk34 = arg1->unk0;
//     tmp->unk38 = arg1->unk4;
//     tmp->unk3C = arg1->unk8;
//
//     func_151D3308(tmp);
//     return tmp;
// }

void func_151D2C40(register struct224 *arg0) {
    struct127 *obj;
    struct255 *frames;
    Func151D2C40Data sp28;
    s8 index;

    obj = (struct127 *)arg0->unk10;
    if ((obj->interaction_state == 0) || (obj->id == 0xFF) || (obj->unique_id != arg0->unk14) ||
        ((frames = obj->unk1D4) == 0) || ((obj->unk74 & 0xF) == 0xF)) {
        func_1516972C((struct102 *)arg0);
        return;
    }

    func_15143134((u8 *)arg0 + 0x18, (u8 *)&sp28 + 4, ((Func151D2C40Frame *)frames)[*(u8 *)((u8 *)arg0 + 0x24)]);

    if (*(u8 *)((u8 *)arg0 + 0x28) & 1) {
        *(s16 *)((u8 *)arg0 + 0x26) = *(s16 *)((u8 *)arg0 + 0x26) - D_800BE9E4;
        if (*(s16 *)((u8 *)arg0 + 0x26) < 0) {
            index = *(s8 *)((u8 *)arg0 + 0x2A);
            if (index != -1) {
                D_8008FC48[index](arg0, (Func151D2C40Data *)((u8 *)&sp28 + 4));
            }
            *(s32 *)((u8 *)arg0 + 0x2C) = 0;
            func_1516972C((struct102 *)arg0);
            return;
        }
    }

    index = *(s8 *)((u8 *)arg0 + 0x29);
    if (index != -1) {
        if (D_8008FC40[index](arg0, (Func151D2C40Data *)((u8 *)&sp28 + 4)) == 0) {
            func_1516972C((struct102 *)arg0);
            return;
        }
    }

    *(Func151D2C40Data *)&arg0->unk34 = *(Func151D2C40Data *)((u8 *)&sp28 + 4);
}

void func_151D2DAC(struct102 *arg0) {
    func_151D3354(arg0);
}

void func_151D2DCC(struct102 *arg0) {
    struct102 *tmp = arg0;

    func_151D2DAC(tmp);

    if (tmp->unk2C != 0) {
        func_1516972C(tmp->unk2C);
    }
    func_15169804(tmp);
}

void func_151D2E14(struct102 *arg0) {
    struct102 *tmp = arg0;

    func_151D2DAC(tmp);

    if (tmp->unk2C != 0) {
        func_1516979C(tmp->unk2C);
    }
    func_15169824(tmp);
}

void func_151D2E5C(struct16 *arg0, struct223 *arg1, u8 arg2)
{
  s32 temp_v0;
  s32 temp_v1;
  u8 temp_a2;
  u8 temp_a3;
  if (arg2 == 0)
  {
    temp_v0 = arg0->unk10;
    temp_v1 = arg1->unk0;
    temp_a2 = arg0->unk14;
    temp_a3 = arg1->unk4.ub;
    if ((temp_v0 == temp_v1) || (temp_a2 == temp_a3))
    {
      func_1516972C((struct102 *) arg0);
    }
  }
  else
    if (arg2 == 0x2D)
  {
    temp_v0 = arg1->unk0;
    temp_v1 = arg0->unk10;
    if (temp_v0 == temp_v1)
    {
      arg0->unk10 = arg1->unk4.w;
      arg0->unk14 = arg1->unk9;
    }
    else
      if ((temp_v1 ^ 0) == arg1->unk4.w)
    {
      arg0->unk10 = temp_v0;
      arg0->unk14 = arg1->unk8;
    }
  }
}
// NON-MATCHING: JUSTREG (mostly)
// s32 func_151D2E5C(struct16 *arg0, struct223 *arg1, u8 arg2) {
//     s32 temp_v0;
//     u8 temp_a2;
//     u8 temp_a3;
//
//     if (arg2 == 0) {
//         temp_v0 = arg0->unk10;
//         temp_a2 = arg0->unk14;
//         temp_a3 = arg1->unk4.ub;
//         if ((temp_v0 == arg1->unk0) || (temp_a3 == temp_a2)) {
//             func_1516972C(temp_a2);
//         }
//     } else if (arg2 == 0x2D) {
//         temp_v0 = arg1->unk0;
//         if (temp_v0 == arg0->unk10) {
//             arg0->unk10 = arg1->unk4.w;
//             arg0->unk14 = arg1->unk9;
//         } else if (arg1->unk4.w == arg0->unk10) {
//             arg0->unk10 = temp_v0;
//             arg0->unk14 = arg1->unk8;
//         }
//     }
// }

struct224 *func_151D2F00(void *arg0, s32 arg1, u8 arg2, s32 arg3) {
    struct224 *ret;

    ret = func_15167A68(0x3E, arg3, arg1 + 0x30, 1, arg2, 1);
    if (ret == NULL) {
        return NULL;
    }
    memcpy(&ret->unk10, arg0, 0x10);
    ret->unk20 = 0;
    ret->unk24 = 0;
    ret->unk28 = 0;
    *(u8 *)((s32)ret + 0x18) = *(u8 *)((s32)ret + 0x18) & -3;
    return ret;
}

#pragma GLOBAL_ASM("asm/nonmatchings/game_1FFF60/func_151D2F90.s")

void func_151D3130(struct224 *arg0)
{
  void (*temp_v0)(struct224 *);
  struct224 *var_s0;
  struct224 *temp_s1;
  s8 temp_v0_2;
  unsigned int new_var;
  temp_v0 = D_8008FC5C[*((u8 *) (((u8 *) arg0) + 0x1D))];
  if (temp_v0 != 0)
  {
    temp_v0(arg0);
  }
  var_s0 = (struct224 *) arg0->unk24;
  if (var_s0 != 0)
  {
    do
    {
      temp_v0_2 = *((s8 *) (((u8 *) var_s0) + 0x2A));
      new_var = 1;
      temp_s1 = (struct224 *) var_s0->unk40;
      if (temp_v0_2 != (-new_var))
      {
        D_8008FC48[temp_v0_2](var_s0, (Func151D2C40Data *) (&var_s0->unk34));
 { }
      }
      *((s32 *) var_s0->unk2C) = 0;
      func_1516972C((struct102 *) var_s0);
      var_s0 = temp_s1;
      latch_151D3130:
      ;

      ;
      ;
    }
    while (temp_s1 != 0);
  }
  func_1514EDF0(arg0, arg0->unk10);
}

void func_151D31F4(struct102 *arg0) {
    func_151D3130(arg0);
    func_15169804(arg0);
}

void func_151D3220(struct102 *arg0) {
    func_151D3130(arg0);
    func_15169824(arg0);
}

void func_151D324C(struct224 *arg0, struct223 *arg1, u8 arg2) {
    void (*temp_v0)(struct224 *, struct223 *, u8);
    s32 temp_v1;
    s32 temp_v0_2;
    u8 temp_a2;

    temp_a2 = arg2;
    if (temp_a2 == 0) {
        func_151D33FC(arg0, arg1);
        temp_a2 = arg2;
    zero_label_151D324C:
        ;
    } else if (temp_a2 == 0x2D) {
        temp_v0_2 = arg1->unk0;
        if (arg0->unk10 == temp_v0_2) {
            arg0->unk10 = arg1->unk4.w;
            arg0->unk14 = arg1->unk9;
        } else {
            if (arg0->unk10 == arg1->unk4.w) {
                arg0->unk10 = temp_v0_2;
                arg0->unk14 = arg1->unk8;
            }
        trailing_label_151D324C:
            ;
        }
    }

    temp_v0 = D_8008FC64[*(u8 *)((u8 *)arg0 + 0x1D)];
    if (temp_v0 != NULL) {
        temp_v0(arg0, arg1, temp_a2);
    }
}

void func_151D3308(struct224 *arg0) {
    struct224 *temp_v0;
    struct224 *temp_v1;

    temp_v0 = arg0->unk30;
    if (temp_v0 != 0) {
        arg0->unk40 = temp_v0->unk24;
        temp_v1 = temp_v0->unk24;
        if (temp_v1 != 0) {
            temp_v1->unk44 = arg0;
        } else {
            temp_v0->unk28 = arg0;
        }
        arg0->unk44 = 0;
        temp_v0->unk24 = arg0;
        temp_v0->unk20 += 1;
        arg0->unk30 = temp_v0;
    }
}

void func_151D3354(struct224 *arg0) {
    struct224 *temp_v0;
    struct224 *temp_v1;
    struct224 *temp_v2;

    if (arg0->unk30) {
        temp_v0 = arg0->unk30;
        if (temp_v1 = arg0->unk44) {
            temp_v1->unk40 = arg0->unk40;
        } else {
            temp_v0->unk24 = arg0->unk40;
        }

        if (temp_v2 = arg0->unk40) {
            temp_v2->unk44 = arg0->unk44;
        } else {
            temp_v0->unk28 = arg0->unk44;
        }

        temp_v0->unk20 -= 1;
    }
}

void func_151D33B8(struct224 *arg0) {
    while (arg0->unk20 > 0) {
        func_1516972C(arg0->unk24);
    };
}

void func_151D33FC(struct224 *arg0, struct223 *arg1) {
    s32 tmp0;
    s32 tmp1;
    s32 tmp2;
    s32 tmp3;

    tmp0 = arg0->unk10;
    tmp1 = arg0->unk14;
    tmp2 = arg1->unk4.ub;
    tmp3 = arg1->unk0;
    if ((tmp0 == tmp3) || (tmp2 == tmp1)) {
        func_1516972C(arg0);
    }
}

void func_151D343C(s32 arg0, u8 arg1) {
    s32 sp1C[1] = D_800AB168;

    func_15169260(sp1C, 1, arg0, arg1);
}

// NON-MATCHING: ops in wrong order
// void func_151D343C(s32 arg0, u8 arg1) {
//     s32 sp1C[1] = D_800AB168;
//     func_15169260(sp1C, 1, arg0, arg1);
// }

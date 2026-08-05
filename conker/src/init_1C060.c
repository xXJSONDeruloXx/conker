#include <libaudio.h>
#include "n_libaudio.h"
#include <os_internal.h>
#include <ultraerror.h>

void n_alEvtqNew(ALEventQueue *evtq, N_ALEventListItem *items, s32 itemCount)
{
    s32 i;
    ALLink *item, *to;

    evtq->eventCount     = 0;
    evtq->allocList.next = 0;
    evtq->allocList.prev = 0;
    evtq->freeList.next  = 0;
    evtq->freeList.prev  = 0;

    for (i = 0; i < itemCount; i++) {
        item = &items[i];
        to = &evtq->freeList;
        // effectively alLink, TODO: macro this?
        item->next = to->next;
        item->prev = to;
        if (to->next) {
            to->next->prev = item;
        }
        to->next = item;
    }

}

ALMicroTime n_alEvtqNextEvent(ALEventQueue *arg0, N_ALEvent *arg1) {
    ALLink *sp2C;
    ALMicroTime sp28;
    ALLink *sp24;
    ALLink *sp20;
    ALLink *sp1C;

    sp2C = arg0->allocList.next;
    if (sp2C != 0) {
        sp24 = sp2C;
        if (sp24->next != 0) {
            sp24->next->prev = sp24->prev;
        }
        if (sp24->prev != 0) {
            sp24->prev->next = sp24->next;
        }
        bcopy((u8 *)sp2C + 0xC, arg1, 0x10);
        sp20 = sp2C;
        sp1C = &arg0->freeList;
        sp20->next = sp1C->next;
        sp20->prev = sp1C;
        if (sp1C->next != 0) {
            sp1C->next->prev = sp20;
        }
        sp1C->next = sp20;
        sp28 = ((N_ALEventListItem *)sp2C)->delta;
    } else {
        arg1->type = -1;
        sp28 = 0;
    }
    return sp28;
}

// s32 n_alEvtqNextEvent(void *arg0, void *arg1) {
//     void *sp2C;
//     s32 sp28;
//     void *sp24;
//     void *sp20;
//     void *sp1C;
//
//     sp2C = arg0->unk8;
//     if (sp2C != 0) {
//         sp24 = sp2C;
//         if (sp24->unk0 != 0) {
//             sp24->unk0->unk4 = (s32) sp24->unk4;
//         }
//         if (sp24->unk4 != 0) {
//             *sp24->unk4 = (s32) sp24->unk0;
//         }
//         bcopy(sp2C + 0xC, arg1, 0x10);
//         sp20 = sp2C;
//         sp1C = arg0;
//         sp20->unk0 = (s32) *sp1C;
//         sp20->unk4 = sp1C;
//         if (*sp1C != 0) {
//             (*sp1C)->unk4 = sp20;
//         }
//         *sp1C = sp20;
//         sp28 = sp2C->unk8;
//     } else {
//         *arg1 = (u16)-1;
//         sp28 = 0;
//     }
//     return sp28;
// }

void n_alEvtqPostEvent(ALEventQueue *evtq, N_ALEvent *event, ALMicroTime delta, s32 flags)
{
    N_ALEventListItem *item;
    N_ALEventListItem *thisItem;
    ALLink *nextItem;
    s32 atEnd;
    OSIntMask savedMask;
    ALLink *unlinkEl;
    ALLink *elA;
    ALLink *afterA;
    ALLink *elB;
    ALLink *afterB;

    atEnd = 0;
    if (flags & 2) {
        savedMask = osSetIntMask(1);
    }
    item = (N_ALEventListItem *)evtq->freeList.next;
    if (item == 0) {
        if (flags & 2) {
            osSetIntMask(savedMask);
        }
        return;
    }
    if (item->node.next == 0 && (flags & 1) == 0) {
        if (flags & 2) {
            osSetIntMask(savedMask);
        }
        return;
    }
    unlinkEl = (ALLink *)item;
    if (unlinkEl->next) {
        unlinkEl->next->prev = unlinkEl->prev;
    }
    if (unlinkEl->prev) {
        unlinkEl->prev->next = unlinkEl->next;
    }
    bcopy(event, &item->evt, 0x10);
    if (delta == 0x7FFFFFFF) {
        atEnd = -1;
    }
    for (nextItem = &evtq->allocList; nextItem; nextItem = nextItem->next) {
        if (nextItem->next == 0) {
            if (atEnd) {
                item->delta = 0;
            } else {
                item->delta = delta;
            }
            elA = (ALLink *)item;
            afterA = nextItem;
            elA->next = afterA->next;
            elA->prev = afterA;
            if (afterA->next) {
                afterA->next->prev = elA;
            }
            afterA->next = elA;
            break;
        } else {
            thisItem = (N_ALEventListItem *)nextItem->next;
            if (delta < thisItem->delta) {
                item->delta = delta;
                thisItem->delta = thisItem->delta - delta;
                elB = (ALLink *)item;
                afterB = nextItem;
                elB->next = afterB->next;
                elB->prev = afterB;
                if (afterB->next) {
                    afterB->next->prev = elB;
                }
                afterB->next = elB;
                break;
            }
            delta = delta - thisItem->delta;
        }
    }
    if (flags & 2) {
        osSetIntMask(savedMask);
    }
}
// void n_alEvtqPostEvent(void *arg0, s32 arg1, s32 arg2, s32 arg3) {
//     void *sp3C;
//     void *sp38;
//     void *sp34;
//     s32 sp30;
//     s32 sp2C;
//     void *sp28;
//     void *sp24;
//     void *sp20;
//     void *sp1C;
//     void *sp18;
//     void *temp_t3;
//     void *temp_t5;
//
//     sp30 = 0;
//     if ((arg3 & 2) != 0) {
//         sp2C = osSetIntMask(1);
//     }
//     sp3C = *arg0;
//     if (sp3C == 0) {
//         if ((arg3 & 2) != 0) {
//             osSetIntMask(sp2C);
//         }
//         return;
//     }
//     if ((sp3C->unk0 == 0) && ((arg3 & 1) == 0)) {
//         if ((arg3 & 2) != 0) {
//             osSetIntMask(sp2C);
//         }
//         return;
//     }
//     sp28 = sp3C;
//     if (sp28->unk0 != 0) {
//         sp28->unk0->unk4 = (s32) sp28->unk4;
//     }
//     if (sp28->unk4 != 0) {
//         *sp28->unk4 = (s32) sp28->unk0;
//     }
//     bcopy(arg1, sp3C + 0xC, 0x10);
//     if (arg2 == 0x7FFFFFFF) {
//         sp30 = -1;
//     }
//     temp_t3 = arg0 + 8;
//     sp34 = temp_t3;
//     if (temp_t3 != 0) {
// loop_18:
//         if (*sp34 == 0) {
//             if (sp30 != 0) {
//                 sp3C->unk8 = 0;
//             } else {
//                 sp3C->unk8 = arg2;
//             }
//             sp24 = sp3C;
//             sp20 = sp34;
//             sp24->unk0 = (s32) *sp20;
//             sp24->unk4 = sp20;
//             if (*sp20 != 0) {
//                 (*sp20)->unk4 = sp24;
//             }
//             *sp20 = sp24;
//         } else {
//             sp38 = *sp34;
//             if (arg2 < sp38->unk8) {
//                 sp3C->unk8 = arg2;
//                 sp38->unk8 = (s32) (sp38->unk8 - arg2);
//                 sp1C = sp3C;
//                 sp18 = sp34;
//                 sp1C->unk0 = (s32) *sp18;
//                 sp1C->unk4 = sp18;
//                 if (*sp18 != 0) {
//                     (*sp18)->unk4 = sp1C;
//                 }
//                 *sp18 = sp1C;
//             } else {
//                 arg2 = arg2 - sp38->unk8;
//                 temp_t5 = *sp34;
//                 sp34 = temp_t5;
//                 if (temp_t5 != 0) {
//                     goto loop_18;
//                 }
//             }
//         }
//     }
//     if ((arg3 & 2) != 0) {
//         osSetIntMask(sp2C);
//     }
// }

s32 func_1001C4F0(ALEventQueue *evtq, s16 type)
{
    N_ALEventListItem *item;
    N_ALEventListItem *next;
    N_ALEventListItem *el;
    N_ALEventListItem *nextCopy;
    OSIntMask savedMask;
    s32 firstDelta;
    s32 cumDelta;
    ALLink *unlinkEl;
    ALLink *linkEl;
    ALLink *after;

    firstDelta = 0;
    cumDelta = 0;
    savedMask = osSetIntMask(1);
    item = (N_ALEventListItem *)evtq->allocList.next;
    if (item) {
        do {
            next = (N_ALEventListItem *)item->node.next;
            el = item;
            nextCopy = next;
            cumDelta += el->delta;
            if (el->evt.type == type) {
                if (firstDelta == 0) {
                    firstDelta = cumDelta;
                }
                if (nextCopy) {
                    nextCopy->delta = nextCopy->delta + el->delta;
                }
                unlinkEl = (ALLink *)item;
                if (unlinkEl->next) {
                    unlinkEl->next->prev = unlinkEl->prev;
                }
                if (unlinkEl->prev) {
                    unlinkEl->prev->next = unlinkEl->next;
                }
                linkEl = (ALLink *)item;
                after = &evtq->freeList;
                linkEl->next = after->next;
                linkEl->prev = after;
                if (after->next) {
                    after->next->prev = linkEl;
                }
                after->next = linkEl;
            }
            item = next;
        } while (item);
    }
    osSetIntMask(savedMask);
    return firstDelta;
}
// s32 func_1001C4F0(void *arg0, s16 arg1) {
//     void *sp3C;
//     void *sp38;
//     void *sp34;
//     void *sp30;
//     s32 sp2C;
//     s32 sp28;
//     s32 sp24;
//     void *sp20;
//     void *sp1C;
//     void *sp18;
//
//     sp28 = 0;
//     sp24 = 0;
//     sp2C = osSetIntMask(1);
//     sp3C = arg0->unk8;
//     if (sp3C != 0) {
// loop_1:
//         sp38 = *sp3C;
//         sp34 = sp3C;
//         sp30 = sp38;
//         sp24 = sp24 + sp34->unk8;
//         if (sp34->unkC == arg1) {
//             if (sp28 == 0) {
//                 sp28 = sp24;
//             }
//             if (sp30 != 0) {
//                 sp30->unk8 = (s32) (sp30->unk8 + sp34->unk8);
//             }
//             sp20 = sp3C;
//             if (sp20->unk0 != 0) {
//                 sp20->unk0->unk4 = (s32) sp20->unk4;
//             }
//             if (sp20->unk4 != 0) {
//                 *sp20->unk4 = (s32) sp20->unk0;
//             }
//             sp1C = sp3C;
//             sp18 = arg0;
//             sp1C->unk0 = (s32) *sp18;
//             sp1C->unk4 = sp18;
//             if (*sp18 != 0) {
//                 (*sp18)->unk4 = sp1C;
//             }
//             *sp18 = sp1C;
//         }
//         sp3C = sp38;
//         if (sp3C != 0) {
//             goto loop_1;
//         }
//     }
//     osSetIntMask(sp2C);
//     return sp28;
// }

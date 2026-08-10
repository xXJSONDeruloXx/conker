#include <ultra64.h>
#include "functions.h"
#include "variables.h"


#pragma GLOBAL_ASM("asm/nonmatchings/libultra/io/pfschecker2/osPfsChecker2.s")

#include <os_internal.h>
#include "controller.h"

s32 corrupted_init2(OSPfs *pfs, __OSInodeCache *usedTbl)
{
    s32 i;
    s32 offset;
    s32 startPage;
    u8 bank;
    __OSInodeUnit inodePage;
    __OSInode inode;
    s32 ret;

    for (i = 0; i < 256; i++) {
        usedTbl->map[i] = 0;
    }
    usedTbl->bank = 0xFF;
    for (bank = 0; bank < pfs->banks; bank++) {
        if (bank > 0) {
            startPage = 1;
        } else {
            startPage = pfs->inode_start_page;
        }
        ret = __osPfsRWInode(pfs, &inode, 0, bank);
        if ((ret != 0) && (ret != 3)) {
            return ret;
        }
        for (i = startPage; i < 128; i++) {
            inodePage = inode.inode_page[i];
            if (inodePage.ipage < pfs->inode_start_page) {
                continue;
            }
            if (inodePage.inode_t.bank != bank) {
                offset = inodePage.inode_t.page / 4 + (inodePage.inode_t.bank % 8) * 32;
                usedTbl->map[offset] |= 1 << (bank % 8);
            }
        }
    }
    return 0;
}

#pragma GLOBAL_ASM("asm/nonmatchings/libultra/io/pfschecker2/corrupted2.s")

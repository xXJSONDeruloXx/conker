/* Keep the US compiler's switch table at the original init_data address. */
.L100140BC_init_data = __n_CSPHandleNextSeqEvent + 0x74;
.L100140D8_init_data = __n_CSPHandleNextSeqEvent + 0x90;
.L100140F4_init_data = __n_CSPHandleNextSeqEvent + 0xAC;
.L1001412C_init_data = __n_CSPHandleNextSeqEvent + 0xE4;
.L1001413C = __n_CSPHandleNextSeqEvent + 0xF4;

SECTIONS
{
    .n_csplayer_rodata 0x8002C4CC (NOLOAD) : SUBALIGN(4)
    {
        *n_csplayer.c.o(.rodata);
    }
}

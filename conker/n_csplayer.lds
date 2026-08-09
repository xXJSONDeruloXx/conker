/* Keep the US compiler's switch table at the original init_data address. */
.L100140BC_init_data = __n_CSPHandleNextSeqEvent + 0x74;
.L100140D8_init_data = __n_CSPHandleNextSeqEvent + 0x90;
.L100140F4_init_data = __n_CSPHandleNextSeqEvent + 0xAC;
.L1001412C_init_data = __n_CSPHandleNextSeqEvent + 0xE4;
.L1001413C = __n_CSPHandleNextSeqEvent + 0xF4;

/* Keep the game switch table's case labels tied to the C replacement. */
.L151441F4_game_data = func_151441A4 + 0x50;
.L1514420C_game_data = func_151441A4 + 0x68;
.L151441D0_game_data = func_151441A4 + 0x2C;
.L15144228_game_data = func_151441A4 + 0x84;
.L15144270_game_data = func_151441A4 + 0xCC;

/* Keep the game_3BA70 switch table and case labels tied to its C replacement. */
.L1500E7F0_game_data = func_1500E738 + 0xB8;
.L1500E810_game_data = func_1500E738 + 0xD8;
.L1500E830_game_data = func_1500E738 + 0xF8;
.L1500E850_game_data = func_1500E738 + 0x118;
.L1500E870 = func_1500E738 + 0x138;

SECTIONS
{
    .n_csplayer_rodata 0x8002C4CC (NOLOAD) : SUBALIGN(4)
    {
        *n_csplayer.c.o(.rodata);
    }

    .game_16EE20_rodata 0x800A5648 (NOLOAD) : SUBALIGN(4)
    {
        *game_16EE20.c.o(.rodata);
    }

    .game_3BA70_rodata 0x800961D0 (NOLOAD) : SUBALIGN(4)
    {
        *game_3BA70.c.o(.rodata);
    }
}

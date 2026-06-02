# Assembly Macros

.set K0BASE, 0x80000000
.set K1BASE, 0xA0000000
.set K2BASE, 0xC0000000

.macro glabel label
    .global \label
    .type \label, @function
    \label:
.endm

.macro dlabel label
    .global \label
    \label:
.endm

.macro jlabel label
    .global \label
    \label:
.endm

# splat/spimdisasm may emit matching/nonmatching metadata pseudo-macros.
# They are comments for GNU as purposes. GLOBAL_ASM include files are also
# post-processed by tools/strip_splat_metadata.py because asm-processor expects
# text blocks to start with glabel.
.macro matching label, size
.endm

.macro nonmatching label, size
.endm

.macro endlabel label
.endm

.macro enddlabel label
.endm

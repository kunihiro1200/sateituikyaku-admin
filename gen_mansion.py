# -*- coding: utf-8 -*-
lines = []
lines.append("import React from 'react';")
lines.append("import { Dialog, DialogContent, Box, Typography, IconButton } from '@mui/material';")
lines.append("import CloseIcon from '@mui/icons-material/Close';")
lines.append("import ApartmentIcon from '@mui/icons-material/Apartment';")
lines.append("")
lines.append("interface MansionSection { title: string; points: string[]; }")
lines.append("interface MansionContent { brandName: string; developer: string; tagline: string; sections: MansionSection[]; summary: string; }")
lines.append("interface MansionModalProps { open: boolean; onClose: () => void; address: string; }")
lines.append("")

# SECTION_ICONS
lines.append("const SECTION_ICONS: Record<string, string> = {")
lines.append("  '\u30d6\u30e9\u30f3\u30c9\u30fb\u30c7\u30d9\u30ed\u30c3\u30d1\u30fc': '\U0001f3e2',")
lines.append("  '\u69cb\u9020\u30fb\u8017\u9707\u6027': '\U0001f3d7\ufe0f',")
lines.append("  '\u8a2d\u5099\u30fb\u4ed5\u69d8\u306e\u7279\u5fb4': '\u2728',")
lines.append("  '\u7ba1\u7406\u30fb\u30a2\u30d5\u30bf\u30fc\u30b5\u30fc\u30d3\u30b9': '\U0001f6e1\ufe0f',")
lines.append("  '\u8cc7\u7523\u4fa1\u5024\u30fb\u58f2\u5却\u6642\u306e\u30dd\u30a4\u30f3\u30c8': '\U0001f4b0',")
lines.append("};")
lines.append("")

with open('frontend/frontend/src/components/MansionModal.tsx', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
print('step1 done')
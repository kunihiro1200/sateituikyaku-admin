#!/usr/bin/env python3
# -*- coding: utf-8 -*-
FILE_PATH = 'frontend/frontend/src/pages/NewBuyerPage.tsx'
with open(FILE_PATH, 'rb') as f:
    text = f.read().decode('utf-8')
print(f'Loaded: {len(text)} chars')

with open('new_section.txt', 'rb') as f:
    new_section = f.read().decode('utf-8')
print(f'New section: {len(new_section)} chars')

START = '                {/* \u554f\u5408\u305b\u60c5\u5831 */}\n'
END = '\n                {/* \u5e0c\u671b\u6761\u4ef6 */}'
si = text.find(START)
ei = text.find(END)
print(f'si={si} ei={ei}')
assert si >= 0 and ei >= 0

old_len = ei - si
print(f'Replacing {old_len} chars with {len(new_section)} chars')

new_text = text[:si] + new_section + text[ei:]
print(f'New file: {len(new_text)} chars')

with open(FILE_PATH, 'wb') as f:
    f.write(new_text.encode('utf-8'))
print('Done!')

with open(FILE_PATH, 'rb') as f:
    first3 = f.read(3)
print(f'BOM check: {repr(first3)}')

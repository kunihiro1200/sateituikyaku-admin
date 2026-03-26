#!/usr/bin/env python3
# -*- coding: utf-8 -*-
FILE_PATH = 'frontend/frontend/src/pages/NewBuyerPage.tsx'
with open(FILE_PATH, 'rb') as f:
    text = f.read().decode('utf-8')

# THREE_CALLS_CONFIRMED_OPTIONS と EMAIL_TYPE_OPTIONS の import を削除
# 現在の import ブロック確認
old_import = '  INQUIRY_EMAIL_PHONE_OPTIONS,\n  THREE_CALLS_CONFIRMED_OPTIONS,\n  EMAIL_TYPE_OPTIONS,\n  DISTRIBUTION_TYPE_OPTIONS,'
new_import = '  INQUIRY_EMAIL_PHONE_OPTIONS,\n  DISTRIBUTION_TYPE_OPTIONS,'

if old_import in text:
    text = text.replace(old_import, new_import)
    print('Import cleaned OK')
else:
    print('Import pattern not found, checking...')
    idx = text.find('THREE_CALLS_CONFIRMED_OPTIONS')
    print(repr(text[max(0,idx-50):idx+80]))

with open(FILE_PATH, 'wb') as f:
    f.write(text.encode('utf-8'))
print('Done')

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
runSellersOnlySync から Phase 2（更新同期）をスキップする
Phase 1（追加）と Phase 3（削除）のみ実行してタイムアウトを回避
"""

import os

service_path = os.path.join('backend', 'src', 'services', 'EnhancedAutoSyncService.ts')

with open(service_path, 'rb') as f:
    content = f.read()

# Phase 2 部分をスキップに変更（バイト列で置換）
old_bytes = (
    b"      // Phase 2: \xe6\x9b\xb4\xe6\x96\xb0\xe5\x90\x8c\xe6\x9c\x9f\n"
    b"      console.log('\\n\xf0\x9f\x94\x84 Phase 2: Seller Update Sync');\n"
    b"      const updatedSellers = await this.detectUpdatedSellers();\n"
    b"      if (updatedSellers.length > 0) {\n"
    b"        const updateResult = await this.syncUpdatedSellers(updatedSellers);\n"
    b"        updated = updateResult.updatedSellersCount;\n"
    b"        errors.push(...updateResult.errors);\n"
    b"      } else {\n"
    b"        console.log('\xe2\x9c\x85 No sellers to update');\n"
    b"      }\n"
)

new_bytes = (
    b"      // Phase 2: \xe6\x9b\xb4\xe6\x96\xb0\xe5\x90\x8c\xe6\x9c\x9f\xef\xbc\x88GAS\xe3\x83\x88\xe3\x83\xaa\xe3\x82\xac\xe3\x83\xbc\xe6\x99\x82\xe3\x81\xaf\xe3\x82\xb9\xe3\x82\xad\xe3\x83\x83\xe3\x83\x97\xef\xbc\x9a\xe5\x85\xa8\xe4\xbb\xb6\xe6\xaf\x94\xe8\xbc\x83\xe3\x81\x8c\xe9\x87\x8d\xe3\x81\x84\xe3\x81\x9f\xe3\x82\x81\xef\xbc\x89\n"
    b"      console.log('\\n\xe2\x8f\xad\xef\xb8\x8f  Phase 2: Seller Update Sync (Skipped for GAS trigger)');\n"
    b"      // \xe6\x9b\xb4\xe6\x96\xb0\xe5\x90\x8c\xe6\x9c\x9f\xe3\x81\xafVercel\xe3\x81\xae\xe5\xae\x9a\xe6\x9c\x9f\xe5\x90\x8c\xe6\x9c\x9f\xef\xbc\x885\xe5\x88\x86\xe3\x81\x94\xe3\x81\xa8\xef\xbc\x89\xe3\x81\xa7\xe5\xae\x9f\xe8\xa1\x8c\xe3\x81\x95\xe3\x82\x8c\xe3\x82\x8b\n"
)

if old_bytes in content:
    content = content.replace(old_bytes, new_bytes, 1)
    with open(service_path, 'wb') as f:
        f.write(content)
    print('✅ Phase 2 をスキップに変更しました')
else:
    # CRLF版で試す
    old_bytes_crlf = old_bytes.replace(b'\n', b'\r\n')
    new_bytes_crlf = new_bytes.replace(b'\n', b'\r\n')
    if old_bytes_crlf in content:
        content = content.replace(old_bytes_crlf, new_bytes_crlf, 1)
        with open(service_path, 'wb') as f:
            f.write(content)
        print('✅ Phase 2 をスキップに変更しました（CRLF）')
    else:
        print('❌ 対象箇所が見つかりませんでした')
        # デバッグ
        idx = content.find(b'Phase 2: Seller Update Sync')
        if idx >= 0:
            print(f'  位置: {idx}')
            print(f'  前後: {repr(content[idx-10:idx+100])}')

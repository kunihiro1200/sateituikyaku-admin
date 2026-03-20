#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SellerService.supabase.ts の2つの修正:
1. decryptSeller内のgetEmployeeNameByInitialsを並列化（Promise.all）
2. refreshEmployeeCache内のcreateClient動的インポートを静的インポートに変更
"""

filepath = 'backend/src/services/SellerService.supabase.ts'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ===== 修正1: 静的importを追加 =====
old_import = "import { SyncQueue } from './SyncQueue';"
new_import = "import { SyncQueue } from './SyncQueue';\nimport { createClient } from '@supabase/supabase-js';"

if old_import in text:
    text = text.replace(old_import, new_import)
    print('✅ 修正1: createClient の静的 import を追加しました')
else:
    print('❌ 修正1: SyncQueue import が見つかりませんでした')

# ===== 修正2: refreshEmployeeCache内の動的importを静的importに変更 =====
old_refresh = """async function refreshEmployeeCache(): Promise<void> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient("""

new_refresh = """async function refreshEmployeeCache(): Promise<void> {
  try {
    const supabase = createClient("""

if old_refresh in text:
    text = text.replace(old_refresh, new_refresh)
    print('✅ 修正2: refreshEmployeeCache の動的 import を静的 import に変更しました')
else:
    print('❌ 修正2: refreshEmployeeCache の動的 import が見つかりませんでした')

# ===== 修正3: decryptSeller内の直列awaitを並列化 =====
old_decrypt = """      // イニシャルをフルネームに変換（非同期処理）
      const visitAssigneeFullName = await getEmployeeNameByInitials(seller.visit_assignee);
      const visitValuationAcquirerFullName = await getEmployeeNameByInitials(seller.visit_valuation_acquirer);"""

new_decrypt = """      // イニシャルをフルネームに変換（並列処理で高速化）
      const [visitAssigneeFullName, visitValuationAcquirerFullName] = await Promise.all([
        getEmployeeNameByInitials(seller.visit_assignee),
        getEmployeeNameByInitials(seller.visit_valuation_acquirer),
      ]);"""

if old_decrypt in text:
    text = text.replace(old_decrypt, new_decrypt)
    print('✅ 修正3: decryptSeller の直列 await を Promise.all で並列化しました')
else:
    print('❌ 修正3: decryptSeller の直列 await が見つかりませんでした')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'\n✅ {filepath} を保存しました')

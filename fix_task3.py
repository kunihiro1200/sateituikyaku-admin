#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
タスク3.1: GmailDistributionButton.tsx のボタンラベルを修正
タスク3.2: PriceSection.tsx の存在しないエンドポイントへの API 呼び出しを削除
"""

import re

# ===== タスク3.1: GmailDistributionButton.tsx =====
gmail_path = 'frontend/frontend/src/components/GmailDistributionButton.tsx'

with open(gmail_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ボタンラベルを変更: 「公開前、値下げメール配信」→「公開前、値下げメール」
old_label = '公開前、値下げメール配信'
new_label = '公開前、値下げメール'

if old_label in text:
    text = text.replace(old_label, new_label)
    print(f'✅ GmailDistributionButton.tsx: ボタンラベルを修正しました')
else:
    print(f'⚠️  GmailDistributionButton.tsx: ボタンラベルが見つかりませんでした')

with open(gmail_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'✅ GmailDistributionButton.tsx を保存しました')

# ===== タスク3.2: PriceSection.tsx =====
price_path = 'frontend/frontend/src/components/PriceSection.tsx'

with open(price_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. useEffect内のfetchScheduledNotifications関数と呼び出しを削除
# 対象のuseEffectブロック全体を削除
old_effect = """
  // 予約通知を取得
  useEffect(() => {
    const fetchScheduledNotifications = async () => {
      if (!propertyNumber) return;
      setLoadingNotifications(true);
      try {
        const response = await api.get(`/api/property-listings/${propertyNumber}/scheduled-notifications`);
        setScheduledNotifications(response.data || []);
      } catch (error) {
        console.error('Failed to fetch scheduled notifications:', error);
        setScheduledNotifications([]);
      } finally {
        setLoadingNotifications(false);
      }
    };
    fetchScheduledNotifications();
  }, [propertyNumber]);"""

if old_effect in text:
    text = text.replace(old_effect, '')
    print('✅ PriceSection.tsx: fetchScheduledNotifications useEffect を削除しました')
else:
    print('⚠️  PriceSection.tsx: fetchScheduledNotifications useEffect が見つかりませんでした')

# 2. loadingNotifications 状態変数を削除（scheduledNotifications は保持）
old_loading_state = "\n  const [loadingNotifications, setLoadingNotifications] = useState(false);"
if old_loading_state in text:
    text = text.replace(old_loading_state, '')
    print('✅ PriceSection.tsx: loadingNotifications 状態変数を削除しました')
else:
    print('⚠️  PriceSection.tsx: loadingNotifications 状態変数が見つかりませんでした')

# 3. useEffect が他の用途で使われていないか確認
# useEffect の残りの使用箇所を確認
remaining_useeffect = text.count('useEffect(')
print(f'ℹ️  PriceSection.tsx: 残りの useEffect 使用箇所: {remaining_useeffect}')

if remaining_useeffect == 0:
    # useEffect の import を削除
    # "import { useState, useEffect } from 'react';" → "import { useState } from 'react';"
    old_import = "import { useState, useEffect } from 'react';"
    new_import = "import { useState } from 'react';"
    if old_import in text:
        text = text.replace(old_import, new_import)
        print('✅ PriceSection.tsx: useEffect の import を削除しました')
    else:
        print('⚠️  PriceSection.tsx: useEffect の import が見つかりませんでした')
else:
    print('ℹ️  PriceSection.tsx: useEffect は他の箇所でも使用されているため import は保持します')

# scheduledNotifications が残っているか確認
if 'scheduledNotifications' in text:
    print('✅ PriceSection.tsx: scheduledNotifications 変数は保持されています')
else:
    print('❌ PriceSection.tsx: scheduledNotifications 変数が見つかりません！')

with open(price_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'✅ PriceSection.tsx を保存しました')

# エンコーディング確認
with open(price_path, 'rb') as f:
    check = f.read(3)
print(f'ℹ️  PriceSection.tsx BOM確認: {repr(check[:3])} (b"imp" などであればOK)')

with open(gmail_path, 'rb') as f:
    check = f.read(3)
print(f'ℹ️  GmailDistributionButton.tsx BOM確認: {repr(check[:3])} (b"imp" などであればOK)')

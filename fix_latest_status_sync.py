#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerViewingResultPage.tsx の handleInlineFieldSave を修正する
latest_status の場合のみ sync: true を使用するよう条件分岐を追加
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 変更前のコード
old_code = """      // sync: false にして高速化（スプレッドシート同期は自動同期サービスに任せる）
      const result = await buyerApi.update(
        buyer_number!,
        { [fieldName]: newValue },
        { sync: false }
      );"""

# 変更後のコード（latest_statusの場合のみsync: trueに変更）
new_code = """      // latest_statusの場合のみsync: trueでスプレッドシートに即時同期する
      // それ以外のフィールドはsync: falseで高速化（自動同期サービスに任せる）
      const isLatestStatus = fieldName === 'latest_status';
      const result = await buyerApi.update(
        buyer_number!,
        { [fieldName]: newValue },
        { sync: isLatestStatus }
      );"""

if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ 変更成功: handleInlineFieldSave の sync オプションを条件分岐に変更しました')
else:
    print('❌ 変更失敗: 対象コードが見つかりませんでした')
    # デバッグ用に周辺コードを表示
    idx = text.find('sync: false')
    if idx >= 0:
        print(f'sync: false が見つかった位置: {idx}')
        print(text[max(0, idx-200):idx+200])
    else:
        print('sync: false が見つかりません')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')

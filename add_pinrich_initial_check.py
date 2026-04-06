# -*- coding: utf-8 -*-
"""
fetchBuyer 関数内に Pinrich の初期チェックを追加するスクリプト
"""

# ファイルをUTF-8で読み込む
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 挿入位置を探す（持家ヒアリング結果の初期チェックの直後）
insert_marker = '''      // 持家ヒアリング結果：条件付き必須
      if (isHomeHearingResultRequired(res.data) && (!res.data.owned_home_hearing_result || !String(res.data.owned_home_hearing_result).trim())) {
        initialMissing.push('owned_home_hearing_result');
      }'''

if insert_marker not in text:
    print('Error: 挿入位置が見つかりません')
    exit(1)

# Pinrich の初期チェックを定義
pinrich_initial_check = '''
      // Pinrich：条件付き必須
      if (isPinrichRequired(res.data) && 
          (!res.data.pinrich || !String(res.data.pinrich).trim() || res.data.pinrich === '未選択')) {
        initialMissing.push('pinrich');
      }'''

# 挿入位置の直後に追加
text = text.replace(insert_marker, insert_marker + pinrich_initial_check)

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ fetchBuyer 関数内に Pinrich の初期チェックを追加しました')

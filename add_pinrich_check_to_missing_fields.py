# -*- coding: utf-8 -*-
"""
checkMissingFields 関数に Pinrich の条件付き必須チェックを追加するスクリプト
"""

# ファイルをUTF-8で読み込む
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 挿入位置を探す（持家ヒアリング結果のチェックの直後）
insert_marker = '''    // 持家ヒアリング結果：条件付き必須
    if (isHomeHearingResultRequired(buyer) && (!buyer.owned_home_hearing_result || !String(buyer.owned_home_hearing_result).trim())) {
      missingKeys.push('owned_home_hearing_result');
    }'''

if insert_marker not in text:
    print('Error: 挿入位置が見つかりません')
    exit(1)

# Pinrich の条件付き必須チェックを定義
pinrich_check = '''

    // Pinrich：条件付き必須
    if (isPinrichRequired(buyer) && 
        (!buyer.pinrich || !String(buyer.pinrich).trim() || buyer.pinrich === '未選択')) {
      missingKeys.push('pinrich');
    }'''

# 挿入位置の直後に追加
text = text.replace(insert_marker, insert_marker + pinrich_check)

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ checkMissingFields 関数に Pinrich の条件付き必須チェックを追加しました')

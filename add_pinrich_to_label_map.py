# -*- coding: utf-8 -*-
"""
REQUIRED_FIELD_LABEL_MAP に pinrich を追加するスクリプト
"""

# ファイルをUTF-8で読み込む
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 置換対象を探す
old_text = '''  const REQUIRED_FIELD_LABEL_MAP: Record<string, string> = {
    initial_assignee: '初動担当',
    inquiry_source: '問合せ元',
    latest_status: '★最新状況',
    distribution_type: '配信メール',
    inquiry_email_phone: '【問合メール】電話対応',
    inquiry_email_reply: '【問合メール】メール返信',
    three_calls_confirmed: '3回架電確認済み',
    desired_area: 'エリア（希望条件）',
    desired_property_type: '希望種別（希望条件）',
    price_range_house: '価格帯（戸建）',
    price_range_apartment: '価格帯（マンション）',
    price_range_land: '価格帯（土地）',
    price_range_any: '価格帯（いずれか）',
    owned_home_hearing_result: '持家ヒアリング結果',
  };'''

if old_text not in text:
    print('Error: REQUIRED_FIELD_LABEL_MAP が見つかりません')
    exit(1)

# pinrich を追加
new_text = '''  const REQUIRED_FIELD_LABEL_MAP: Record<string, string> = {
    initial_assignee: '初動担当',
    inquiry_source: '問合せ元',
    latest_status: '★最新状況',
    distribution_type: '配信メール',
    inquiry_email_phone: '【問合メール】電話対応',
    inquiry_email_reply: '【問合メール】メール返信',
    three_calls_confirmed: '3回架電確認済み',
    desired_area: 'エリア（希望条件）',
    desired_property_type: '希望種別（希望条件）',
    price_range_house: '価格帯（戸建）',
    price_range_apartment: '価格帯（マンション）',
    price_range_land: '価格帯（土地）',
    price_range_any: '価格帯（いずれか）',
    owned_home_hearing_result: '持家ヒアリング結果',
    pinrich: 'Pinrich',
  };'''

text = text.replace(old_text, new_text)

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ REQUIRED_FIELD_LABEL_MAP に pinrich を追加しました')

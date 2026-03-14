#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerDetailPage.tsx の修正:
1. 「希望条件」セクションを削除
2. 「買付情報」セクションを削除
3. SMS送信ドロップダウンをヘッダーに追加
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ===== 修正1: 「希望条件」セクションを削除 =====
old_section_desired = """  {
    title: '希望条件',
    fields: [
      { key: 'desired_timing', label: '希望時期', inlineEditable: true },
      { key: 'desired_area', label: 'エリア', inlineEditable: true },
      { key: 'desired_property_type', label: '希望種別', inlineEditable: true },
      { key: 'desired_building_age', label: '築年数', inlineEditable: true },
      { key: 'desired_floor_plan', label: '間取り', inlineEditable: true },
      { key: 'budget', label: '予算', inlineEditable: true },
      { key: 'price_range_house', label: '価格帯（戸建）', inlineEditable: true },
      { key: 'price_range_apartment', label: '価格帯（マンション）', inlineEditable: true },
      { key: 'price_range_land', label: '価格帯（土地）', inlineEditable: true },
      { key: 'parking_spaces', label: 'P台数', inlineEditable: true },
      { key: 'hot_spring_required', label: '温泉あり', inlineEditable: true },
      { key: 'garden_required', label: '庭付き', inlineEditable: true },
      { key: 'pet_allowed_required', label: 'ペット可', inlineEditable: true },
      { key: 'good_view_required', label: '眺望良好', inlineEditable: true },
      { key: 'high_floor_required', label: '高層階', inlineEditable: true },
      { key: 'corner_room_required', label: '角部屋', inlineEditable: true },
    ],
  },
  {"""

new_section_desired = """  {"""

if old_section_desired in text:
    text = text.replace(old_section_desired, new_section_desired, 1)
    print('✅ 「希望条件」セクションを削除しました')
else:
    print('❌ 「希望条件」セクションが見つかりませんでした')

# ===== 修正2: 「買付情報」セクションを削除 =====
old_section_offer = """  {
    title: '買付情報',
    fields: [
      { key: 'offer_status', label: '買付有無', inlineEditable: true },
      { key: 'offer_comment', label: '買付コメント', inlineEditable: true },
      { key: 'offer_property_sheet', label: '買付（物件シート）', inlineEditable: true },
      { key: 'offer_lost_comment', label: '買付外れコメント', inlineEditable: true },
      { key: 'offer_lost_chat', label: '買付外れチャット', inlineEditable: true },
    ],
  },
];"""

new_section_offer = """];"""

if old_section_offer in text:
    text = text.replace(old_section_offer, new_section_offer, 1)
    print('✅ 「買付情報」セクションを削除しました')
else:
    print('❌ 「買付情報」セクションが見つかりませんでした')

# ===== 修正3: SMS送信ドロップダウンをヘッダーに追加 =====
# FormControl, Select, InputLabel, MenuItem のインポートは既にある
# Sms アイコンのインポートを追加する必要があるか確認
# → 今回はアイコンなしのドロップダウンで実装

# SMS送信ドロップダウンを電話番号ボタンの後に追加
old_phone_button = """          {/* 電話番号ボタン */}
          {buyer.phone_number && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<PhoneIcon />}
              href={`tel:${buyer.phone_number}`}
              sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}
            >
              {buyer.phone_number}
            </Button>
          )}

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />"""

new_phone_button = """          {/* 電話番号ボタン */}
          {buyer.phone_number && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<PhoneIcon />}
              href={`tel:${buyer.phone_number}`}
              sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}
            >
              {buyer.phone_number}
            </Button>
          )}

          {/* SMS送信ドロップダウン */}
          {buyer.phone_number && (
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>SMS送信</InputLabel>
              <Select
                value=""
                label="SMS送信"
                onChange={(e) => {
                  const templateId = e.target.value;
                  if (!templateId || !buyer.phone_number) return;
                  let message = '';
                  if (templateId === 'greeting') {
                    message = `${buyer.name || 'お客様'}様、いつもお世話になっております。ご連絡をお待ちしております。`;
                  } else if (templateId === 'viewing') {
                    message = `${buyer.name || 'お客様'}様、内覧のご案内をお送りします。詳細はメールをご確認ください。`;
                  } else if (templateId === 'followup') {
                    message = `${buyer.name || 'お客様'}様、先日はありがとうございました。何かご不明な点がございましたらお気軽にご連絡ください。`;
                  }
                  if (message) {
                    const smsLink = `sms:${buyer.phone_number}?body=${encodeURIComponent(message)}`;
                    window.location.href = smsLink;
                  }
                }}
              >
                <MenuItem value="">選択してください</MenuItem>
                <MenuItem value="greeting">ご挨拶</MenuItem>
                <MenuItem value="viewing">内覧案内</MenuItem>
                <MenuItem value="followup">フォローアップ</MenuItem>
              </Select>
            </FormControl>
          )}

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />"""

if old_phone_button in text:
    text = text.replace(old_phone_button, new_phone_button, 1)
    print('✅ SMS送信ドロップダウンを追加しました')
else:
    print('❌ 電話番号ボタン箇所が見つかりませんでした')

# ===== 書き込み =====
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ BuyerDetailPage.tsx を更新しました')

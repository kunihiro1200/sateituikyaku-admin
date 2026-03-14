#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerViewingResultPage.tsx の「内覧日をクリア」ボタンに
キャンセルメール送信処理を追加する
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# クリアボタンのonClickにキャンセルメール送信を追加
old = '''                onClick={async () => {
                  await handleInlineFieldSave('latest_viewing_date', null);
                  await handleInlineFieldSave('viewing_time', null);
                }}'''

new = '''                onClick={async () => {
                  // キャンセルメール送信（内覧日クリア前に情報を取得）
                  try {
                    const property = linkedProperties && linkedProperties.length > 0 ? linkedProperties[0] : null;
                    await api.post('/api/buyer-appointments/cancel-notification', {
                      buyerNumber: buyer.buyer_number,
                      propertyAddress: property?.address || '',
                      propertyNumber: property?.property_number || '',
                      assignedTo: buyer.follow_up_assignee || '',
                      inquiryHearing: buyer.inquiry_hearing || '',
                    });
                    console.log('[BuyerViewingResultPage] Cancel notification sent');
                  } catch (cancelError: any) {
                    console.warn('[BuyerViewingResultPage] Cancel notification failed (non-fatal):', cancelError.message);
                  }
                  await handleInlineFieldSave('latest_viewing_date', null);
                  await handleInlineFieldSave('viewing_time', null);
                }}'''

if old in text:
    text = text.replace(old, new)
    print('OK: キャンセルメール送信処理を追加しました')
else:
    print('NG: 対象箇所が見つかりません')

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')

# fix_frontend_buyer_appointments.py
# BuyerViewingResultPage.tsx のカレンダー送信・キャンセル通知のリクエストボディを修正する

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ===== 修正1: POST /api/buyer-appointments のリクエストボディに不足フィールドを追加 =====
old_post = """      const response = await api.post('/api/buyer-appointments', {
        buyerNumber: buyer.buyer_number,
        startTime: viewingDate.toISOString(),
        endTime: endDate.toISOString(),
        assignedTo: buyer.follow_up_assignee,
        buyerName: buyer.name,
        buyerPhone: buyer.phone_number,
        buyerEmail: buyer.email,
        viewingMobile: buyer.viewing_mobile || buyer.viewing_type_general,
        propertyAddress: property?.address || '',
        propertyNumber: property?.property_number || '',
        propertyGoogleMapUrl: property?.google_map_url || '',
        inquiryHearing: buyer.inquiry_hearing || '',
        creatorName: buyer.name,
        customTitle: calendarConfirmDialog.title,
        customDescription: calendarConfirmDialog.description,
      });"""

new_post = """      const response = await api.post('/api/buyer-appointments', {
        buyerNumber: buyer.buyer_number,
        startTime: viewingDate.toISOString(),
        endTime: endDate.toISOString(),
        assignedTo: buyer.follow_up_assignee,
        followUpAssignee: buyer.follow_up_assignee,
        buyerName: buyer.name,
        buyerPhone: buyer.phone_number,
        buyerEmail: buyer.email,
        viewingMobile: buyer.viewing_mobile || '',
        viewingTypeGeneral: buyer.viewing_type_general || '',
        viewingDate: buyer.viewing_date || '',
        viewingTime: buyer.viewing_time || '',
        propertyAddress: property?.address || '',
        propertyNumber: property?.property_number || '',
        propertyGoogleMapUrl: property?.google_map_url || '',
        inquiryHearing: buyer.inquiry_hearing || '',
        creatorName: buyer.name,
        customTitle: calendarConfirmDialog.title,
        customDescription: calendarConfirmDialog.description,
      });"""

if old_post in text:
    text = text.replace(old_post, new_post)
    print('✅ 修正1: POST /api/buyer-appointments のリクエストボディを修正しました')
else:
    print('❌ 修正1: 対象箇所が見つかりませんでした')

# ===== 修正2: POST /api/buyer-appointments/cancel-notification のリクエストボディを修正 =====
old_cancel = """                    await api.post('/api/buyer-appointments/cancel-notification', {
                      buyerNumber: buyer.buyer_number,
                      propertyAddress: property?.address || '',
                      propertyNumber: property?.property_number || '',
                      assignedTo: buyer.follow_up_assignee || '',
                      inquiryHearing: buyer.inquiry_hearing || '',
                    });"""

new_cancel = """                    await api.post('/api/buyer-appointments/cancel-notification', {
                      buyerNumber: buyer.buyer_number,
                      propertyNumber: property?.property_number || '',
                      previousViewingDate: buyer.viewing_date || '',
                      viewingMobile: buyer.viewing_mobile || '',
                      viewingTypeGeneral: buyer.viewing_type_general || '',
                      followUpAssignee: buyer.follow_up_assignee || '',
                      inquiryHearing: buyer.inquiry_hearing || '',
                    });"""

if old_cancel in text:
    text = text.replace(old_cancel, new_cancel)
    print('✅ 修正2: POST /api/buyer-appointments/cancel-notification のリクエストボディを修正しました')
else:
    print('❌ 修正2: 対象箇所が見つかりませんでした')

# UTF-8（BOMなし）で書き込む
with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを UTF-8（BOMなし）で保存しました')

# BOMチェック
with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    head = f.read(3)
print('BOM check:', repr(head[:3]))

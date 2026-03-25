# 送信者情報をCHATメッセージに追加する
# フロントエンド: senderNameをリクエストに追加
# バックエンド: メッセージフォーマットに送信者を追加

# --- フロントエンド ---
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    fe_content = f.read()

fe_text = fe_content.decode('utf-8')

old_fe = """      await api.post(`/api/property-listings/${propertyNumber}/send-chat-to-assignee`, {
        message: chatMessage,
      });"""

new_fe = """      await api.post(`/api/property-listings/${propertyNumber}/send-chat-to-assignee`, {
        message: chatMessage,
        senderName: employee?.name || employee?.initials || '不明',
      });"""

if old_fe in fe_text:
    fe_text = fe_text.replace(old_fe, new_fe, 1)
    print('✅ フロントエンド: senderNameを追加しました')
else:
    print('❌ フロントエンド: 対象箇所が見つかりません')

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(fe_text.encode('utf-8'))

# --- バックエンド ---
with open('backend/src/routes/propertyListings.ts', 'rb') as f:
    be_content = f.read()

be_text = be_content.decode('utf-8')

old_be = "    const { message } = req.body;"
new_be = "    const { message, senderName } = req.body;"

if old_be in be_text:
    # send-chat-to-assigneeエンドポイント内のものだけ置換（最後の出現箇所）
    idx = be_text.rfind(old_be)
    be_text = be_text[:idx] + new_be + be_text[idx + len(old_be):]
    print('✅ バックエンド: senderNameを受け取るよう更新しました')
else:
    print('❌ バックエンド: 対象箇所が見つかりません')

# メッセージフォーマットに送信者を追加
old_msg = "    const chatMessage = `📩 *物件担当への質問・伝言*\\n\\n物件番号: ${property.property_number}\\n所在地: ${property.address || '未設定'}\\n担当: ${property.sales_assignee}\\n${sellerInfo ? sellerInfo + '\\n' : ''}物件URL: ${propertyUrl}\\n\\n${String(message).trim()}`;"
new_msg = "    const senderLabel = senderName ? `送信者: ${senderName}` : null;\n    const chatMessage = `📩 *物件担当への質問・伝言*\\n\\n物件番号: ${property.property_number}\\n所在地: ${property.address || '未設定'}\\n担当: ${property.sales_assignee}\\n${sellerInfo ? sellerInfo + '\\n' : ''}物件URL: ${propertyUrl}\\n${senderLabel ? senderLabel + '\\n' : ''}\\n${String(message).trim()}`;"

if old_msg in be_text:
    be_text = be_text.replace(old_msg, new_msg, 1)
    print('✅ バックエンド: メッセージフォーマットに送信者を追加しました')
else:
    print('❌ バックエンド: メッセージフォーマット箇所が見つかりません')

with open('backend/src/routes/propertyListings.ts', 'wb') as f:
    f.write(be_text.encode('utf-8'))

print('✅ 完了')

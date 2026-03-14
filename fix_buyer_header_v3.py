with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. inquiry_confidence Chip を削除
old1 = """          {buyer.inquiry_confidence && (
            <Chip label={buyer.inquiry_confidence} color="info" sx={{ ml: 1 }} />
          )}"""
new1 = ""

assert old1 in text, "Pattern 1 not found"
text = text.replace(old1, new1)
print("1. inquiry_confidence removed")

# 2. 問い合わせ履歴ボタンのテキスト変更
old3 = "            問い合わせ履歴 ({inquiryHistoryTable.length}件)"
new3 = "            問合履歴{inquiryHistoryTable.length}件"

assert old3 in text, "Pattern 3 not found"
text = text.replace(old3, new3)
print("2. inquiry history label changed")

# 3. SMS FormControl を Button+Menu スタイルに変更
# FormControl全体を新しいスタイルに置換
old_sms_start = "          {/* SMS送信ドロップダウン */}\n          {buyer.phone_number && (\n            <FormControl size=\"small\" sx={{ minWidth: 160 }}>\n              <InputLabel>SMS送信</InputLabel>\n              <Select\n                value=\"\"\n                label=\"SMS送信\"\n                onChange={(e) => {"
new_sms_start = "          {/* SMS送信ドロップダウン */}\n          {buyer.phone_number && (\n            <SmsDropdownButton\n              phoneNumber={buyer.phone_number}\n              buyerName={buyer.name || 'お客様'}\n              buyerNumber={buyer_number || ''}\n              propertyAddress={linkedProperties[0]?.display_address || linkedProperties[0]?.address || ''}\n              propertyType={linkedProperties[0]?.property_type || ''}\n            />\n          )}\n          {false && buyer.phone_number && (\n            <FormControl size=\"small\" sx={{ minWidth: 160 }}>\n              <InputLabel>SMS送信</InputLabel>\n              <Select\n                value=\"\"\n                label=\"SMS送信\"\n                onChange={(e) => {"

assert old_sms_start in text, "SMS start pattern not found"
text = text.replace(old_sms_start, new_sms_start, 1)
print("3. SMS dropdown replaced with SmsDropdownButton")

# FormControl の閉じタグの後に )} を追加（false && ブロックを閉じる）
old_sms_end = "              </Select>\n            </FormControl>\n          )}\n\n          <Divider"
new_sms_end = "              </Select>\n            </FormControl>\n          )}\n\n          <Divider"

# すでに正しい形なのでそのまま
print("4. SMS end tag OK")

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("Done!")

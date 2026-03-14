import re

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. inquiry_confidence Chip を削除
old1 = """          {buyer.inquiry_confidence && (
            <Chip label={buyer.inquiry_confidence} color="info" sx={{ ml: 1 }} />
          )}"""
new1 = ""

# 2. SMS送信 FormControl/Select を Button+Menu スタイルに変更
old2 = """          {/* SMS送信ドロップダウン */}
          {buyer.phone_number && (
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>SMS送信</InputLabel>
              <Select
                value=""
                label="SMS送信"
                onChange={(e) => {
                  const templateId = e.target.value;"""

new2 = """          {/* SMS送信ドロップダウン */}
          {buyer.phone_number && (
            <SmsDropdownButton
              buyer={buyer}
              buyerNumber={buyer_number || ''}
              linkedProperties={linkedProperties}
            />
          )}
          {false && buyer.phone_number && (
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>SMS送信</InputLabel>
              <Select
                value=""
                label="SMS送信"
                onChange={(e) => {
                  const templateId = e.target.value;"""

# 3. 問い合わせ履歴ボタンのテキスト変更
old3 = """          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(`/buyers/${buyer_number}/inquiry-history`)}
          >
            問い合わせ履歴 ({inquiryHistoryTable.length}件)
          </Button>"""

new3 = """          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(`/buyers/${buyer_number}/inquiry-history`)}
          >
            問合履歴{inquiryHistoryTable.length}件
          </Button>"""

text = text.replace(old1, new1)
text = text.replace(old3, new3)

# SMS FormControl の閉じタグを見つけて false && ブロックを閉じる
# </FormControl> の後に )} を追加する必要がある
# まず old2 の置換を行う
if old2 in text:
    text = text.replace(old2, new2)
    print("SMS dropdown replacement done")
else:
    print("SMS dropdown pattern not found")

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("Done!")

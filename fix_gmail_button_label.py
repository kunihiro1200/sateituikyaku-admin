# GmailDistributionButton.tsx のボタンラベルを変更する
with open('frontend/frontend/src/components/GmailDistributionButton.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ボタンラベルを変更
text = text.replace('Gmailで配信', '公開前、値下げメール配信')

with open('frontend/frontend/src/components/GmailDistributionButton.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! ボタンラベルを変更しました')

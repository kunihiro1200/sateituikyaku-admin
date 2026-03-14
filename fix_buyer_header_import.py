with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "import BuyerGmailSendButton from '../components/BuyerGmailSendButton';"
new = "import BuyerGmailSendButton from '../components/BuyerGmailSendButton';\nimport { SmsDropdownButton } from '../components/SmsDropdownButton';"

assert old in text, "Pattern not found"
text = text.replace(old, new)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("Done!")

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')
text = text.replace('\r\n', '\n')

# 売主TELボタンに component="a" を追加
old_tel = '''                <Button
                  variant="outlined"
                  size="small"
                  href={`tel:${data.seller_contact}`}
                  startIcon={<PhoneIcon fontSize="small" />}'''
new_tel = '''                <Button
                  component="a"
                  variant="outlined"
                  size="small"
                  href={`tel:${data.seller_contact}`}
                  startIcon={<PhoneIcon fontSize="small" />}'''

# Emailボタンに component="a" を追加
old_email = '''                <Button
                  variant="outlined"
                  size="small"
                  href={`mailto:${data.seller_email}`}
                  startIcon={<EmailIcon fontSize="small" />}'''
new_email = '''                <Button
                  component="a"
                  variant="outlined"
                  size="small"
                  href={`mailto:${data.seller_email}`}
                  startIcon={<EmailIcon fontSize="small" />}'''

# SMSボタンに component="a" を追加
old_sms = '''                <Button
                  variant="outlined"
                  size="small"
                  href={`sms:${data.seller_contact}`}
                  startIcon={<SmsIcon fontSize="small" />}'''
new_sms = '''                <Button
                  component="a"
                  variant="outlined"
                  size="small"
                  href={`sms:${data.seller_contact}`}
                  startIcon={<SmsIcon fontSize="small" />}'''

count = 0
for old, new in [(old_tel, new_tel), (old_email, new_email), (old_sms, new_sms)]:
    if old in text:
        text = text.replace(old, new)
        count += 1
    else:
        print(f'❌ 見つかりません: {old[:50]}')

print(f'✅ {count}/3 ボタン修正成功')

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')

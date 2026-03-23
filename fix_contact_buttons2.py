with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')
text = text.replace('\r\n', '\n')

# TELボタン: component="a" + href → onClick
old_tel = '''                <Button
                  component="a"
                  variant="outlined"
                  size="small"
                  href={`tel:${data.seller_contact}`}
                  startIcon={<PhoneIcon fontSize="small" />}
                  sx={{
                    borderColor: '#1565c0',
                    color: '#1565c0',
                    '&:hover': {
                      borderColor: '#0d47a1',
                      backgroundColor: '#1565c008',
                    },
                  }}
                >
                  売主TEL
                </Button>'''
new_tel = '''                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => { window.location.href = `tel:${data.seller_contact}`; }}
                  startIcon={<PhoneIcon fontSize="small" />}
                  sx={{
                    borderColor: '#1565c0',
                    color: '#1565c0',
                    '&:hover': {
                      borderColor: '#0d47a1',
                      backgroundColor: '#1565c008',
                    },
                  }}
                >
                  売主TEL
                </Button>'''

# Emailボタン: component="a" + href → onClick
old_email = '''                <Button
                  component="a"
                  variant="outlined"
                  size="small"
                  href={`mailto:${data.seller_email}`}
                  startIcon={<EmailIcon fontSize="small" />}
                  sx={{
                    borderColor: '#1976d2',
                    color: '#1976d2',
                    '&:hover': {
                      borderColor: '#115293',
                      backgroundColor: '#1976d208',
                    },
                  }}
                >
                  Email
                </Button>'''
new_email = '''                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => { window.location.href = `mailto:${data.seller_email}`; }}
                  startIcon={<EmailIcon fontSize="small" />}
                  sx={{
                    borderColor: '#1976d2',
                    color: '#1976d2',
                    '&:hover': {
                      borderColor: '#115293',
                      backgroundColor: '#1976d208',
                    },
                  }}
                >
                  Email
                </Button>'''

# SMSボタン: component="a" + href → onClick
old_sms = '''                <Button
                  component="a"
                  variant="outlined"
                  size="small"
                  href={`sms:${data.seller_contact}`}
                  startIcon={<SmsIcon fontSize="small" />}
                  sx={{
                    borderColor: '#2e7d32',
                    color: '#2e7d32',
                    '&:hover': {
                      borderColor: '#1b5e20',
                      backgroundColor: '#2e7d3208',
                    },
                  }}
                >
                  SMS
                </Button>'''
new_sms = '''                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => { window.location.href = `sms:${data.seller_contact}`; }}
                  startIcon={<SmsIcon fontSize="small" />}
                  sx={{
                    borderColor: '#2e7d32',
                    color: '#2e7d32',
                    '&:hover': {
                      borderColor: '#1b5e20',
                      backgroundColor: '#2e7d3208',
                    },
                  }}
                >
                  SMS
                </Button>'''

count = 0
for old, new in [(old_tel, new_tel), (old_email, new_email), (old_sms, new_sms)]:
    if old in text:
        text = text.replace(old, new)
        count += 1
    else:
        print(f'❌ 見つかりません')

print(f'✅ {count}/3 ボタン修正成功')

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')

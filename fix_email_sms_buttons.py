import re

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')
# 改行コードを正規化
text = text.replace('\r\n', '\n')

# 1. SmsIconをインポートに追加
old_import = '  Search as SearchIcon,\n  Clear as ClearIcon,\n} from \'@mui/icons-material\';'
new_import = '  Search as SearchIcon,\n  Clear as ClearIcon,\n  Sms as SmsIcon,\n} from \'@mui/icons-material\';'
text = text.replace(old_import, new_import)

# 2. 「売主へメール」ボタンを「Email」に変更し、SMSボタンを追加
old_button = '''              {data.seller_email && (
                <Button
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
                  売主へメール
                </Button>
              )}'''

new_button = '''              {data.seller_email && (
                <Button
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
                </Button>
              )}
              {data.seller_contact && (
                <Button
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
                </Button>
              )}'''

if old_button in text:
    text = text.replace(old_button, new_button)
    print('✅ ボタン修正成功')
else:
    print('❌ ボタンが見つかりません')

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')

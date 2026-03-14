import subprocess

# 4ee722b コミットの正常なUTF-8ファイルを取得
result = subprocess.run(
    ['git', 'show', '4ee722b:backend/src/services/CalendarService.supabase.ts'],
    capture_output=True
)

content = result.stdout

# UTF-8として確認
text = content.decode('utf-8')
print('Decoded as UTF-8 successfully')
print('File size:', len(content))

# メソッド確認
import re
methods = re.findall(r'async (\w+)\(', text)
print('Methods:', methods)

# BOMなしUTF-8で書き込む（CRLFをLFに統一）
text_lf = text.replace('\r\n', '\n').replace('\r', '\n')

with open('backend/src/services/CalendarService.supabase.ts', 'wb') as f:
    f.write(text_lf.encode('utf-8'))

print('\nFile written successfully (UTF-8, LF line endings)')

# 確認
with open('backend/src/services/CalendarService.supabase.ts', 'rb') as f:
    check = f.read()
print('BOM check:', repr(check[:3]))
print('File size:', len(check))

# 日本語コメント確認
check_text = check.decode('utf-8')
for line in check_text.split('\n'):
    if '営担' in line or 'イニシャル' in line:
        print('Japanese OK:', line[:80])
        break

# createGoogleCalendarEventForEmployee 確認
if 'createGoogleCalendarEventForEmployee' in check_text:
    print('createGoogleCalendarEventForEmployee: OK')
else:
    print('createGoogleCalendarEventForEmployee: MISSING!')

with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# confidence カラムを除外
old = "      confidence: data.confidenceLevel || null,\r\n      first_caller_initials"
new = "      first_caller_initials"

if old in text:
    text = text.replace(old, new, 1)
    print('OK: removed confidence')
else:
    old2 = "      confidence: data.confidenceLevel || null,\n      first_caller_initials"
    if old2 in text:
        text = text.replace(old2, "      first_caller_initials", 1)
        print('OK (LF): removed confidence')
    else:
        print('ERROR: not found')

with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "      assigned_to: employeeId,\r\n      // Phase 1 fields"
new = "      // Phase 1 fields"

if old in text:
    text = text.replace(old, new, 1)
    print('OK')
else:
    # LFのみ版も試す
    old2 = "      assigned_to: employeeId,\n      // Phase 1 fields"
    if old2 in text:
        text = text.replace(old2, "      // Phase 1 fields", 1)
        print('OK (LF)')
    else:
        print('ERROR: not found')

with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

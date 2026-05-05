with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# todayCallのselectにseller_numberを追加
old1 = "              .select('id, status, next_call_date, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, unreachable_status, confidence_level, inquiry_date')\n              .is('deleted_at', null)\n              .not('next_call_date', 'is', null)\n              .lte('next_call_date', todayJST)\n              .order('id')\n              .range(tcPage * tcPageSize, (tcPage + 1) * tcPageSize - 1);"
new1 = "              .select('id, seller_number, status, next_call_date, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, unreachable_status, confidence_level, inquiry_date')\n              .is('deleted_at', null)\n              .not('next_call_date', 'is', null)\n              .lte('next_call_date', todayJST)\n              .order('id')\n              .range(tcPage * tcPageSize, (tcPage + 1) * tcPageSize - 1);"

if old1 in text:
    text = text.replace(old1, new1)
    print('Fix 1 applied: seller_number added to todayCall select')
else:
    print('Fix 1 NOT applied')

with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')

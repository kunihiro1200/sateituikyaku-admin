with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# encryptedDataを正しいカラム名で置き換える
old = """    const encryptedData = {
      name: encrypt(data.name),
      address: encrypt(data.address),
      phone_number: encryptedPhone,
      email: encryptedEmail || null,
      status: SellerStatus.FOLLOWING_UP,
      // Phase 1 fields
      seller_number: sellerNumber,
      inquiry_source: data.inquirySource,
      inquiry_year: data.inquiryYear,
      inquiry_date: data.inquiryDate,
      inquiry_datetime: data.inquiryDatetime || null,
      first_caller_initials: data.firstCallerInitials || null,
      first_caller_employee_id: data.firstCallerEmployeeId || null,
      is_unreachable: false,
      duplicate_confirmed: false,
      exclusion_date: exclusionDate,
    };"""

new = """    const encryptedData = {
      name: encrypt(data.name),
      address: encrypt(data.address),
      phone_number: encryptedPhone,
      email: encryptedEmail || null,
      status: SellerStatus.FOLLOWING_UP,
      // Phase 1 fields
      seller_number: sellerNumber,
      inquiry_source: data.inquirySource,
      inquiry_year: data.inquiryYear,
      inquiry_date: data.inquiryDate,
      inquiry_detailed_datetime: data.inquiryDatetime || null,
      confidence_level: data.confidenceLevel || null,
      first_caller_initials: data.firstCallerInitials || null,
      first_caller_employee_id: data.firstCallerEmployeeId || null,
      is_unreachable: false,
      duplicate_confirmed: false,
      exclusion_date: exclusionDate,
    };"""

# CRLF版
old_crlf = old.replace('\n', '\r\n')
new_crlf = new.replace('\n', '\r\n')

if old_crlf in text:
    text = text.replace(old_crlf, new_crlf, 1)
    print('OK (CRLF)')
elif old in text:
    text = text.replace(old, new, 1)
    print('OK (LF)')
else:
    # 現在の状態を確認
    start = text.find('const encryptedData = {')
    end = text.find('};', start) + 2
    print('ERROR: not found. Current state:')
    print(repr(text[start:end]))

with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

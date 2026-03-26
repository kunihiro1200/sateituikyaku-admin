with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# createSellerのstatusをフロントエンドから受け取った値に変更
# また confidence_level も data.confidence から取得するよう修正
old = "      status: SellerStatus.FOLLOWING_UP,\r\n      // Phase 1 fields\r\n      seller_number: sellerNumber,\r\n      inquiry_source: data.inquirySource,\r\n      inquiry_year: data.inquiryYear,\r\n      inquiry_date: data.inquiryDate,\r\n      inquiry_detailed_datetime: data.inquiryDatetime || null,\r\n      confidence_level: data.confidenceLevel || null,"

new = "      status: (data as any).status || SellerStatus.FOLLOWING_UP,\r\n      // Phase 1 fields\r\n      seller_number: sellerNumber,\r\n      inquiry_source: data.inquirySource,\r\n      inquiry_year: data.inquiryYear,\r\n      inquiry_date: data.inquiryDate,\r\n      inquiry_detailed_datetime: data.inquiryDatetime || null,\r\n      confidence_level: (data as any).confidence || data.confidenceLevel || null,"

if old in text:
    text = text.replace(old, new, 1)
    print('OK (CRLF)')
else:
    # LF版
    old_lf = old.replace('\r\n', '\n')
    new_lf = new.replace('\r\n', '\n')
    if old_lf in text:
        text = text.replace(old_lf, new_lf, 1)
        print('OK (LF)')
    else:
        # 現在の状態確認
        start = text.find('const encryptedData = {')
        end = text.find('};', start) + 2
        print('ERROR. Current:')
        print(repr(text[start:end]))

with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

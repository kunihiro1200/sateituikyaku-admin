# fix_types2.py - Windows改行(\r\n)対応
with open('src/types/index.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# \r\n を \n に正規化してから検索・置換
text_normalized = text.replace('\r\n', '\n')

old_type = "  site?: string; // サイト（問い合わせ元）\n}\n\nexport interface UpdateSellerRequest {"

new_type = """  site?: string; // サイト（問い合わせ元）
  // 追客情報
  nextCallDate?: string;
  contactMethod?: string;
  preferredContactTime?: string;
  // 訪問査定情報
  visitDate?: string;
  visitTime?: string;
  visitAssignee?: string;
  visitNotes?: string;
  // ステータス・コメント
  status?: string;
  confidence?: string;
  comments?: string;
  assignedTo?: string;
  // 査定情報
  valuationAmount1?: number;
  valuationAmount2?: number;
  valuationAmount3?: number;
  valuationMethod?: string;
  valuationAssignee?: string;
}

export interface UpdateSellerRequest {"""

if old_type in text_normalized:
    text_normalized = text_normalized.replace(old_type, new_type)
    print('✅ CreateSellerRequest 型更新完了')
else:
    print('❌ まだ見つかりません')
    idx = text_normalized.find('site?: string; // サイト（問い合わせ元）')
    print(f'位置: {idx}')
    if idx >= 0:
        print(repr(text_normalized[idx:idx+80]))

with open('src/types/index.ts', 'wb') as f:
    f.write(text_normalized.encode('utf-8'))

print('完了')

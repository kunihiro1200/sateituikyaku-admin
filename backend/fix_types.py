# fix_types.py
with open('src/types/index.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

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

if old_type in text:
    text = text.replace(old_type, new_type)
    print('✅ CreateSellerRequest 型更新完了')
else:
    print('❌ 見つかりません。実際の内容を確認してください')
    # デバッグ用
    idx = text.find('site?: string; // サイト（問い合わせ元）')
    print(f'site フィールドの位置: {idx}')
    if idx >= 0:
        print(repr(text[idx:idx+100]))

with open('src/types/index.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')

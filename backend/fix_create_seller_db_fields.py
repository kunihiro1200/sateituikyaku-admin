# fix_create_seller_db_fields.py
# createSeller の INSERT に欠落フィールドを追加し、CreateSellerRequest 型も更新する

# ===== 1. SellerService.supabase.ts の修正 =====
with open('src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# encryptedData の INSERT オブジェクトに欠落フィールドを追加
old_insert = """      exclusion_date: exclusionDate,
    };

    // 売主を作成
    const { data: seller, error: sellerError } = await this.table('sellers')"""

new_insert = """      exclusion_date: exclusionDate,
      // 追客情報
      next_call_date: (data as any).nextCallDate || null,
      contact_method: (data as any).contactMethod || null,
      preferred_contact_time: (data as any).preferredContactTime || null,
      // 訪問査定情報
      visit_date: (data as any).visitDate || null,
      visit_time: (data as any).visitTime || null,
      visit_assignee: (data as any).visitAssignee || null,
      visit_notes: (data as any).visitNotes || null,
      // ステータス・コメント
      comments: (data as any).comments || null,
      assigned_to: (data as any).assignedTo || null,
      // 査定情報
      valuation_amount_1: (data as any).valuationAmount1 ? parseFloat(String((data as any).valuationAmount1)) : null,
      valuation_amount_2: (data as any).valuationAmount2 ? parseFloat(String((data as any).valuationAmount2)) : null,
      valuation_amount_3: (data as any).valuationAmount3 ? parseFloat(String((data as any).valuationAmount3)) : null,
      valuation_method: (data as any).valuationMethod || null,
      valuation_assignee: (data as any).valuationAssignee || null,
      // サイト
      inquiry_site: (data as any).site || null,
    };

    // 売主を作成
    const { data: seller, error: sellerError } = await this.table('sellers')"""

if old_insert in text:
    text = text.replace(old_insert, new_insert)
    print('✅ SellerService.supabase.ts: INSERT フィールド追加完了')
else:
    print('❌ SellerService.supabase.ts: INSERT 箇所が見つかりません')

# properties テーブルの INSERT にも欠落フィールドを追加
old_property_insert = """      property_address_ieul_apartment: data.property.propertyAddressForIeulMansion || null,
    });"""

new_property_insert = """      property_address_ieul_apartment: data.property.propertyAddressForIeulMansion || null,
      floors: data.property.floors || null,
      parking: data.property.parking || false,
      additional_info: data.property.additionalInfo || null,
    });"""

if old_property_insert in text:
    text = text.replace(old_property_insert, new_property_insert)
    print('✅ SellerService.supabase.ts: properties INSERT フィールド追加完了')
else:
    print('⚠️ SellerService.supabase.ts: properties INSERT 箇所が見つかりません（既に追加済みの可能性）')

with open('src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ SellerService.supabase.ts 書き込み完了')

# ===== 2. types/index.ts の CreateSellerRequest 型を更新 =====
with open('src/types/index.ts', 'rb') as f:
    content2 = f.read()

text2 = content2.decode('utf-8')

old_type = """export interface CreateSellerRequest {
  name: string;
  address: string;
  phoneNumber: string;
  email?: string;
  property: Omit<PropertyInfo, 'id' | 'sellerId'>;
  // Phase 1 fields
  sellerNumber?: string;
  inquirySource: string;
  inquiryYear: number;
  inquiryDate?: Date | string; // 反響日付
  inquiryDatetime?: Date;
  confidenceLevel?: ConfidenceLevel;
  firstCallerInitials?: string;
  firstCallerEmployeeId?: string;
  site?: string; // サイト（問い合わせ元）
}"""

new_type = """export interface CreateSellerRequest {
  name: string;
  address: string;
  phoneNumber: string;
  email?: string;
  property: Omit<PropertyInfo, 'id' | 'sellerId'>;
  // Phase 1 fields
  sellerNumber?: string;
  inquirySource: string;
  inquiryYear: number;
  inquiryDate?: Date | string; // 反響日付
  inquiryDatetime?: Date;
  confidenceLevel?: ConfidenceLevel;
  firstCallerInitials?: string;
  firstCallerEmployeeId?: string;
  site?: string; // サイト（問い合わせ元）
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
}"""

if old_type in text2:
    text2 = text2.replace(old_type, new_type)
    print('✅ types/index.ts: CreateSellerRequest 型更新完了')
else:
    print('❌ types/index.ts: CreateSellerRequest 型が見つかりません')

with open('src/types/index.ts', 'wb') as f:
    f.write(text2.encode('utf-8'))

print('✅ types/index.ts 書き込み完了')
print('\n全修正完了！')

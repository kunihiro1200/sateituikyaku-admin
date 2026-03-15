#!/usr/bin/env python3
# emailTemplates.ts の merge エンドポイントで SellerService を使って売主名を取得するよう修正

with open('backend/src/routes/emailTemplates.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. SellerService のインポートを追加
old_import = "import { StaffManagementService } from '../services/StaffManagementService';"
new_import = """import { StaffManagementService } from '../services/StaffManagementService';
import { SellerService } from '../services/SellerService.supabase';"""

text = text.replace(old_import, new_import)

# 2. sellerService インスタンスを追加
old_instance = "const staffService = new StaffManagementService();"
new_instance = """const staffService = new StaffManagementService();
const sellerService = new SellerService();"""

text = text.replace(old_instance, new_instance)

# 3. merge エンドポイントの売主名取得部分を修正（直接Supabaseではなく SellerService 経由に）
old_seller_fetch = """    // 売主データを取得（seller_number = property_number）
    let sellerName = '';
    try {
      const { data: seller } = await supabase
        .from('sellers')
        .select('name')
        .eq('seller_number', propertyNumber)
        .single();
      if (seller?.name) {
        sellerName = seller.name;
      }
    } catch {
      // 売主が見つからない場合は空文字のまま
    }"""

new_seller_fetch = """    // 売主データを取得（seller_number = property_number）
    // name は暗号化されているため SellerService 経由で復号化して取得
    let sellerName = '';
    try {
      const { data: sellerRow } = await supabase
        .from('sellers')
        .select('id')
        .eq('seller_number', propertyNumber)
        .single();
      if (sellerRow?.id) {
        const decryptedSeller = await sellerService.getSeller(sellerRow.id);
        if (decryptedSeller?.name) {
          sellerName = decryptedSeller.name;
        }
      }
    } catch {
      // 売主が見つからない場合は空文字のまま
    }"""

text = text.replace(old_seller_fetch, new_seller_fetch)

with open('backend/src/routes/emailTemplates.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! emailTemplates.ts updated to use SellerService for decrypted seller name.')

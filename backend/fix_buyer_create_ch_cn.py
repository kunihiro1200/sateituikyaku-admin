"""
BuyerService.create() の property_listings select() に7フィールドを追加する修正スクリプト
"""

target = 'backend/src/services/BuyerService.ts'

with open(target, 'rb') as f:
    content = f.read().decode('utf-8')

# create() 内の select（4フィールド版）を7フィールド版に置換
# updateWithSync() の修正済み箇所と区別するため、前後のコンテキストで特定する
old_block = """\
            const { data: propertyListing, error: propertyError } = await this.supabase
              .from('property_listings')
              .select('address, display_address, price, sales_assignee')
              .eq('property_number', appendData.property_number)
              .maybeSingle();

            if (!propertyError && propertyListing) {
              appendData.property_address = propertyListing.address ?? null;
              appendData.display_address = propertyListing.display_address ?? null;
              appendData.price = propertyListing.price ?? null;
              appendData.property_assignee = propertyListing.sales_assignee ?? null;
              console.log(`[BuyerService] Fetched property info for ${appendData.property_number}: address=${appendData.property_address}`);
            }"""

new_block = """\
            const { data: propertyListing, error: propertyError } = await this.supabase
              .from('property_listings')
              .select('address, display_address, price, sales_assignee, pre_viewing_notes, key_info, sale_reason, price_reduction_history, viewing_notes, parking, viewing_parking')
              .eq('property_number', appendData.property_number)
              .maybeSingle();

            if (!propertyError && propertyListing) {
              appendData.property_address = propertyListing.address ?? null;
              appendData.display_address = propertyListing.display_address ?? null;
              appendData.price = propertyListing.price ?? null;
              appendData.property_assignee = propertyListing.sales_assignee ?? null;
              appendData.pre_viewing_notes = propertyListing.pre_viewing_notes ?? null;
              appendData.key_info = propertyListing.key_info ?? null;
              appendData.sale_reason = propertyListing.sale_reason ?? null;
              appendData.price_reduction_history = propertyListing.price_reduction_history ?? null;
              appendData.viewing_notes = propertyListing.viewing_notes ?? null;
              appendData.parking = propertyListing.parking ?? null;
              appendData.viewing_parking = propertyListing.viewing_parking ?? null;
              console.log(`[BuyerService] Fetched property info for ${appendData.property_number}: address=${appendData.property_address}`);
            }"""

if old_block not in content:
    print('ERROR: 対象箇所が見つかりません。既に修正済みか、コードが変わっている可能性があります。')
    exit(1)

content = content.replace(old_block, new_block, 1)

with open(target, 'wb') as f:
    f.write(content.encode('utf-8'))

print('OK: create() の property_listings select() を修正しました')

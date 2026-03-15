with open('backend/src/routes/emailTemplates.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 売主データ取得ロジックを修正
# property_listings の seller_number を使って sellers テーブルを検索する
old = """    // 売主データを取得（seller_number = property_number）
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

new = """    // 売主データを取得
    // property_listings の seller_number を使って sellers テーブルを検索
    // name は暗号化されているため SellerService 経由で復号化して取得
    let sellerName = '';
    try {
      // まず property_listings から seller_number を取得
      const sellerNumber = property.seller_number;
      if (sellerNumber) {
        const { data: sellerRow } = await supabase
          .from('sellers')
          .select('id')
          .eq('seller_number', sellerNumber)
          .single();
        if (sellerRow?.id) {
          const decryptedSeller = await sellerService.getSeller(sellerRow.id);
          if (decryptedSeller?.name) {
            sellerName = decryptedSeller.name;
          }
        }
      }
      // seller_number がない場合は property_number で試みる（後方互換）
      if (!sellerName) {
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
      }
    } catch {
      // 売主が見つからない場合は空文字のまま
    }"""

if old in text:
    text = text.replace(old, new)
    with open('backend/src/routes/emailTemplates.ts', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('OK: 売主検索ロジックを修正しました')
else:
    print('ERROR: 対象文字列が見つかりません')
    # デバッグ用に該当箇所を表示
    for i, line in enumerate(text.split('\n')):
        if 'seller_number' in line or 'sellerRow' in line:
            print(f'Line {i+1}: {line}')

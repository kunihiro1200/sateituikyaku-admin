import re

with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前のコード（完全一致検索部分）
old_code = '''    if (lowerQuery.match(/^aa\\d+$/i)) {
      console.log('🚀 Fast path: Searching by seller_number in database');

      // まず完全一致で検索（AA6 → AA6のみ、AA60等を除外）
      const upperQuery = lowerQuery.toUpperCase();
      let exactQuery = this.table('sellers')
        .select('*')
        .eq('seller_number', upperQuery);
      if (!includeDeleted) {
        exactQuery = exactQuery.is('deleted_at', null);
      }
      const { data: exactSellers, error: exactError } = await exactQuery;
      if (exactError) {
        throw new Error(`Failed to search sellers by exact number: ${exactError.message}`);
      }
      if (exactSellers && exactSellers.length > 0) {
        console.log(`✅ Found exact match for seller_number: ${upperQuery}`);
        const decryptedSellers = await Promise.all(exactSellers.map(seller => this.decryptSeller(seller)));
        return await this._attachLastCalledAt(decryptedSellers);
      }

      // 完全一致がなければ前方一致で検索（AA6 → AA60, AA61...）
      let sellerQuery = this.table('sellers')
        .select('*')
        .ilike('seller_number', `${lowerQuery}%`)
        .order('seller_number', { ascending: true })
        .limit(50);'''

# 修正後のコード（ゼロパディング対応）
new_code = '''    if (lowerQuery.match(/^aa\\d+$/i)) {
      console.log('🚀 Fast path: Searching by seller_number in database');

      // 売主番号はAA + 5桁ゼロパディング形式（例: AA01949）
      // 入力がAA1949の場合、AA01949に変換して検索する
      const upperQuery = lowerQuery.toUpperCase();
      const numPart = upperQuery.replace(/^AA/i, '');
      const paddedQuery = `AA${numPart.padStart(5, '0')}`;

      // ゼロパディングした番号で完全一致検索
      const searchQueries = [upperQuery, paddedQuery].filter((v, i, a) => a.indexOf(v) === i);
      for (const q of searchQueries) {
        let exactQuery = this.table('sellers')
          .select('*')
          .eq('seller_number', q);
        if (!includeDeleted) {
          exactQuery = exactQuery.is('deleted_at', null);
        }
        const { data: exactSellers, error: exactError } = await exactQuery;
        if (exactError) {
          throw new Error(`Failed to search sellers by exact number: ${exactError.message}`);
        }
        if (exactSellers && exactSellers.length > 0) {
          console.log(`✅ Found exact match for seller_number: ${q}`);
          const decryptedSellers = await Promise.all(exactSellers.map(seller => this.decryptSeller(seller)));
          return await this._attachLastCalledAt(decryptedSellers);
        }
      }

      // 完全一致がなければ前方一致で検索（AA6 → AA60, AA61... または AA00006...）
      // ゼロパディングなしとありの両方で前方一致検索
      const prefixQuery = numPart.length >= 5 ? paddedQuery : upperQuery;
      let sellerQuery = this.table('sellers')
        .select('*')
        .ilike('seller_number', `${prefixQuery}%`)
        .order('seller_number', { ascending: true })
        .limit(50);'''

if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ Replacement successful')
else:
    print('❌ Pattern not found - checking for partial match...')
    # 部分的に確認
    check = '// まず完全一致で検索（AA6 → AA6のみ、AA60等を除外）'
    if check in text:
        print('Partial match found')
    else:
        print('No partial match either')

with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done')

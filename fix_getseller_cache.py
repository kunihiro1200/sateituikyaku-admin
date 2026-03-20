# fix_getseller_cache.py
# getSeller関数にキャッシュを追加して通話モードページの遷移を高速化

with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# CRLF -> LF
text = text.replace('\r\n', '\n')

# getSeller関数にキャッシュを追加
old_get_seller = '''  async getSeller(sellerId: string, includeDeleted: boolean = false): Promise<Seller | null> {
    // 売主情報を取得
    let query = this.table('sellers')
      .select('*')
      .eq('id', sellerId);
    
    // デフォルトで削除済みを除外
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }
    
    const { data: seller, error: sellerError } = await query.single();

    if (sellerError || !seller) {
      return null;
    }

    // 物件情報を取得（.single()ではなく配列で取得）
    // propertiesテーブルにはdeleted_atカラムが存在しないためフィルターなし
    const propertyQuery = this.table('properties')
      .select('*')
      .eq('seller_id', sellerId);
    
    const { data: properties, error: propertyError } = await propertyQuery;

    const decryptedSeller = await this.decryptSeller(seller);
    
    console.log('🔍 Decrypted seller:', {
      id: decryptedSeller.id,
      sellerNumber: decryptedSeller.sellerNumber,
      name: decryptedSeller.name,
      phoneNumber: decryptedSeller.phoneNumber,
      visitAcquisitionDate: decryptedSeller.visitAcquisitionDate,
      visitDate: decryptedSeller.visitDate,
      visitValuationAcquirer: decryptedSeller.visitValuationAcquirer,
      visitAssignee: decryptedSeller.visitAssignee,
    });'''

new_get_seller = '''  async getSeller(sellerId: string, includeDeleted: boolean = false): Promise<Seller | null> {
    // キャッシュをチェック（includeDeletedがfalseの場合のみキャッシュを使用）
    if (!includeDeleted) {
      const cacheKey = CacheHelper.generateKey('seller', sellerId);
      const cached = await CacheHelper.get<Seller>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 売主情報を取得
    let query = this.table('sellers')
      .select('*')
      .eq('id', sellerId);
    
    // デフォルトで削除済みを除外
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }
    
    const { data: seller, error: sellerError } = await query.single();

    if (sellerError || !seller) {
      return null;
    }

    // 物件情報を取得（.single()ではなく配列で取得）
    // propertiesテーブルにはdeleted_atカラムが存在しないためフィルターなし
    const propertyQuery = this.table('properties')
      .select('*')
      .eq('seller_id', sellerId);
    
    const { data: properties, error: propertyError } = await propertyQuery;

    const decryptedSeller = await this.decryptSeller(seller);'''

text = text.replace(old_get_seller, new_get_seller)

# getSeller関数の末尾（return decryptedSeller;の前）にキャッシュ保存を追加
old_return = '''    return decryptedSeller;
  }

  /**
   * 売主情報を更新
   */
  async updateSeller'''

new_return = '''    // キャッシュに保存（30秒TTL）
    if (!includeDeleted) {
      const cacheKey = CacheHelper.generateKey('seller', sellerId);
      await CacheHelper.set(cacheKey, decryptedSeller, 30);
    }

    return decryptedSeller;
  }

  /**
   * 売主情報を更新
   */
  async updateSeller'''

text = text.replace(old_return, new_return)

# LF -> CRLF
text = text.replace('\n', '\r\n')

with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! getSeller にキャッシュを追加しました')

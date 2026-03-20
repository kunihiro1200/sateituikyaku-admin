"""
getBuyersByAreas() の最適化
- distribution_type = '要' をDBクエリレベルでフィルタリング
- latest_status の除外条件もDBで適用（成約・Dを除外）
- ページネーション廃止（絞り込み後は件数が少ないため）
"""

with open('backend/src/services/BuyerService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 旧実装（ページネーションで全件取得）を新実装（DBレベルフィルタリング）に置換
old_code = '''  async getBuyersByAreas(
    areaNumbers: string[],
    propertyType?: string | null,
    salesPrice?: number | null
  ): Promise<any[]> {
    if (!areaNumbers || areaNumbers.length === 0) {
      return [];
    }

    const allBuyers: any[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.supabase
        .from('buyers')
        .select(`
          buyer_id,
          buyer_number,
          name,
          latest_status,
          latest_viewing_date,
          inquiry_confidence,
          inquiry_source,
          distribution_type,
          distribution_areas,
          broker_inquiry,
          desired_area,
          desired_property_type,
          price_range_house,
          price_range_apartment,
          price_range_land,
          reception_date,
          email,
          phone_number,
          property_type,
          property_number,
          price,
          inquiry_hearing,
          viewing_result_follow_up
        `)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        throw new Error(`Failed to fetch buyers by areas: ${error.message}`);
      }

      if (data && data.length > 0) {
        allBuyers.push(...data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    const filteredBuyers = this.filterBuyerCandidates(allBuyers, areaNumbers, propertyType, salesPrice);'''

new_code = '''  async getBuyersByAreas(
    areaNumbers: string[],
    propertyType?: string | null,
    salesPrice?: number | null
  ): Promise<any[]> {
    if (!areaNumbers || areaNumbers.length === 0) {
      return [];
    }

    // DBレベルで distribution_type = '要' に絞り込み（最大のボトルネック解消）
    // latest_status が成約・Dを含むものも除外
    const { data: allBuyers, error } = await this.supabase
      .from('buyers')
      .select(`
        buyer_id,
        buyer_number,
        name,
        latest_status,
        latest_viewing_date,
        inquiry_confidence,
        inquiry_source,
        distribution_type,
        distribution_areas,
        broker_inquiry,
        desired_area,
        desired_property_type,
        price_range_house,
        price_range_apartment,
        price_range_land,
        reception_date,
        email,
        phone_number,
        property_type,
        property_number,
        price,
        inquiry_hearing,
        viewing_result_follow_up
      `)
      .eq('distribution_type', '要')
      .not('latest_status', 'ilike', '%成約%')
      .not('latest_status', 'ilike', '%D%');

    if (error) {
      throw new Error(`Failed to fetch buyers by areas: ${error.message}`);
    }

    const filteredBuyers = this.filterBuyerCandidates(allBuyers || [], areaNumbers, propertyType, salesPrice);'''

if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ getBuyersByAreas() の最適化に成功しました')
else:
    print('❌ 対象コードが見つかりませんでした')
    # デバッグ用：前後の文字列を確認
    idx = text.find('async getBuyersByAreas(')
    if idx >= 0:
        print(f'メソッド開始位置: {idx}')
        print(repr(text[idx:idx+200]))
    else:
        print('メソッド自体が見つかりません')
    exit(1)

with open('backend/src/services/BuyerService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')

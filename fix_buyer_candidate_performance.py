"""
BuyerCandidateService のパフォーマンス改善:
1. DBクエリ側で distribution_type='要' を先にフィルタリング
2. filterCandidates の for...await 直列ループを Promise.all で並列化
3. 距離マッチングが無効化されているため getPropertyCoordinates の await を削除
"""

with open('backend/src/services/BuyerCandidateService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. DBクエリ側で distribution_type='要' を先にフィルタリング
old_query = """      const { data, error: buyersError } = await this.supabase
        .from('buyers')
        .select('*')
        .is('deleted_at', null)  // 削除済みを除外
        .order('reception_date', { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);"""

new_query = """      const { data, error: buyersError } = await this.supabase
        .from('buyers')
        .select('*')
        .is('deleted_at', null)  // 削除済みを除外
        .eq('distribution_type', '要')  // 配信種別が「要」のみ取得（DBレベルで絞り込み）
        .not('latest_status', 'like', '%買付%')  // 買付済みを除外
        .not('latest_status', 'like', '%D%')  // D確度を除外
        .order('reception_date', { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);"""

if old_query in text:
    text = text.replace(old_query, new_query)
    print("✅ DBクエリ側フィルタリングを追加しました")
else:
    print("❌ DBクエリのパターンが見つかりませんでした")

# 2. filterCandidates の for...await 直列ループを Promise.all で並列化
old_filter = """  private async filterCandidates(
    buyers: any[],
    propertyType: string | null,
    salesPrice: number | null,
    propertyAreaNumbers: string[],
    propertyCoords: { lat: number; lng: number } | null
  ): Promise<any[]> {
    const filteredBuyers: any[] = [];

    for (const buyer of buyers) {
      // 1. 除外条件の評価（早期リターン）
      if (this.shouldExcludeBuyer(buyer)) {
        continue;
      }

      // 2. 最新状況/問合せ時確度フィルタ
      if (!this.matchesStatus(buyer)) {
        continue;
      }

      // 3. エリアフィルタ（距離ベースも含む）
      const matchesArea = await this.matchesAreaCriteriaWithDistance(
        buyer,
        propertyAreaNumbers,
        propertyCoords
      );
      if (!matchesArea) {
        continue;
      }

      // 4. 種別フィルタ
      if (!this.matchesPropertyTypeCriteria(buyer, propertyType)) {
        continue;
      }

      // 5. 価格帯フィルタ
      if (!this.matchesPriceCriteria(buyer, salesPrice, propertyType)) {
        continue;
      }

      filteredBuyers.push(buyer);
    }

    return filteredBuyers;
  }"""

new_filter = """  private async filterCandidates(
    buyers: any[],
    propertyType: string | null,
    salesPrice: number | null,
    propertyAreaNumbers: string[],
    propertyCoords: { lat: number; lng: number } | null
  ): Promise<any[]> {
    // 同期フィルタを先に適用して件数を絞る（高速）
    const preFiltered = buyers.filter(buyer => {
      if (this.shouldExcludeBuyer(buyer)) return false;
      if (!this.matchesStatus(buyer)) return false;
      if (!this.matchesPropertyTypeCriteria(buyer, propertyType)) return false;
      if (!this.matchesPriceCriteria(buyer, salesPrice, propertyType)) return false;
      return true;
    });

    // エリアフィルタ（非同期）を Promise.all で並列実行
    const areaResults = await Promise.all(
      preFiltered.map(buyer =>
        this.matchesAreaCriteriaWithDistance(buyer, propertyAreaNumbers, propertyCoords)
      )
    );

    return preFiltered.filter((_, i) => areaResults[i]);
  }"""

if old_filter in text:
    text = text.replace(old_filter, new_filter)
    print("✅ filterCandidates を Promise.all 並列化しました")
else:
    print("❌ filterCandidates のパターンが見つかりませんでした")

# 3. getPropertyCoordinates の呼び出しを削除（距離マッチングは無効化されているため不要）
old_coords = """    // 物件の座標を取得
    const propertyCoords = await this.getPropertyCoordinates(property);
    console.log(`[BuyerCandidateService] Property coordinates:`, propertyCoords);"""

new_coords = """    // 距離マッチングは現在無効化されているため座標取得をスキップ
    const propertyCoords = null;"""

if old_coords in text:
    text = text.replace(old_coords, new_coords)
    print("✅ getPropertyCoordinates の不要な await を削除しました")
else:
    print("❌ getPropertyCoordinates のパターンが見つかりませんでした")

with open('backend/src/services/BuyerCandidateService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print("完了")

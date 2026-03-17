#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
買主候補リストのパフォーマンス改善
- select('*') → 必要なカラムのみ取得
- エリアフィルタをアプリ側で並列実行 → 同期処理に変更（非同期不要）
"""

import re

filepath = 'backend/src/services/BuyerCandidateService.ts'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. select('*') → 必要なカラムのみ取得
old_select = """      const { data, error: buyersError } = await this.supabase
        .from('buyers')
        .select('*')
        .is('deleted_at', null)  // 削除済みを除外
        .eq('distribution_type', '要')  // 配信種別が「要」のみ取得（DBレベルで絞り込み）
        .not('latest_status', 'like', '%買付%')  // 買付済みを除外
        .not('latest_status', 'like', '%D%')  // D確度を除外
        .order('reception_date', { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);"""

new_select = """      const { data, error: buyersError } = await this.supabase
        .from('buyers')
        .select('buyer_number,name,latest_status,desired_area,desired_property_type,reception_date,email,phone_number,property_number,distribution_type,inquiry_source,broker_inquiry,price_range_house,price_range_apartment,price_range_land')
        .is('deleted_at', null)  // 削除済みを除外
        .eq('distribution_type', '要')  // 配信種別が「要」のみ取得（DBレベルで絞り込み）
        .not('latest_status', 'like', '%買付%')  // 買付済みを除外
        .not('latest_status', 'like', '%D%')  // D確度を除外
        .order('reception_date', { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);"""

if old_select in text:
    text = text.replace(old_select, new_select)
    print('✅ select カラム絞り込み適用')
else:
    print('❌ select 箇所が見つかりません')

# 2. filterCandidates を同期処理に変更（エリアチェックは同期で十分）
old_filter = """  /**
   * 買主候補をフィルタリング
   */
  private async filterCandidates(
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

new_filter = """  /**
   * 買主候補をフィルタリング（同期処理 - 距離マッチングは無効化済みのため非同期不要）
   */
  private filterCandidates(
    buyers: any[],
    propertyType: string | null,
    salesPrice: number | null,
    propertyAreaNumbers: string[],
    propertyCoords: { lat: number; lng: number } | null
  ): any[] {
    return buyers.filter(buyer => {
      if (this.shouldExcludeBuyer(buyer)) return false;
      if (!this.matchesStatus(buyer)) return false;
      if (!this.matchesPropertyTypeCriteria(buyer, propertyType)) return false;
      if (!this.matchesPriceCriteria(buyer, salesPrice, propertyType)) return false;
      if (!this.matchesAreaCriteria(buyer, propertyAreaNumbers)) return false;
      return true;
    });
  }"""

if old_filter in text:
    text = text.replace(old_filter, new_filter)
    print('✅ filterCandidates 同期化適用')
else:
    print('❌ filterCandidates 箇所が見つかりません')

# 3. filterCandidates の呼び出しを await なしに変更
old_call = """    // フィルタリング
    const candidates = await this.filterCandidates(
      buyers || [],
      property.property_type,
      property.sales_price,
      propertyAreaNumbers,
      propertyCoords
    );"""

new_call = """    // フィルタリング（同期処理）
    const candidates = this.filterCandidates(
      buyers || [],
      property.property_type,
      property.sales_price,
      propertyAreaNumbers,
      propertyCoords
    );"""

if old_call in text:
    text = text.replace(old_call, new_call)
    print('✅ filterCandidates 呼び出し修正')
else:
    print('❌ filterCandidates 呼び出し箇所が見つかりません')

# 4. matchesAreaCriteriaWithDistance を同期の matchesAreaCriteria に置き換え
old_area_method = """  /**
   * エリア条件によるフィルタリング（距離ベースも含む）
   * - 買主の希望エリアが空欄の場合: 条件を満たす
   * - 物件の配信エリアと買主の希望エリアが1つでも合致: 条件を満たす
   * - 買主が問い合わせた物件が近傍3km以内: 条件を満たす（一時的に無効化）
   */
  private async matchesAreaCriteriaWithDistance(
    buyer: any,
    propertyAreaNumbers: string[],
    propertyCoords: { lat: number; lng: number } | null
  ): Promise<boolean> {
    const desiredArea = (buyer.desired_area || '').trim();

    // 希望エリアが空欄の場合は条件を満たす
    if (!desiredArea) {
      return true;
    }

    // 1. エリア番号でのマッチング
    if (propertyAreaNumbers.length > 0) {
      const buyerAreaNumbers = this.extractAreaNumbers(desiredArea);
      const areaMatch = propertyAreaNumbers.some(area => buyerAreaNumbers.includes(area));
      if (areaMatch) {
        return true;
      }
    }

    // 2. 距離ベースのマッチング（一時的に無効化 - パフォーマンス問題のため）
    // if (propertyCoords) {
    //   const distanceMatch = await this.matchesByInquiryDistance(buyer, propertyCoords);
    //   if (distanceMatch) {
    //     return true;
    //   }
    // }

    return false;
  }"""

new_area_method = """  /**
   * エリア条件によるフィルタリング（同期）
   * - 買主の希望エリアが空欄の場合: 条件を満たす
   * - 物件の配信エリアと買主の希望エリアが1つでも合致: 条件を満たす
   */
  private matchesAreaCriteria(
    buyer: any,
    propertyAreaNumbers: string[]
  ): boolean {
    const desiredArea = (buyer.desired_area || '').trim();

    // 希望エリアが空欄の場合は条件を満たす
    if (!desiredArea) {
      return true;
    }

    // エリア番号でのマッチング
    if (propertyAreaNumbers.length > 0) {
      const buyerAreaNumbers = this.extractAreaNumbers(desiredArea);
      return propertyAreaNumbers.some(area => buyerAreaNumbers.includes(area));
    }

    return false;
  }

  /**
   * エリア条件によるフィルタリング（距離ベースも含む・将来用）
   * 現在は距離マッチングを無効化しているため matchesAreaCriteria を使用
   */
  private async matchesAreaCriteriaWithDistance(
    buyer: any,
    propertyAreaNumbers: string[],
    propertyCoords: { lat: number; lng: number } | null
  ): Promise<boolean> {
    return this.matchesAreaCriteria(buyer, propertyAreaNumbers);
  }"""

if old_area_method in text:
    text = text.replace(old_area_method, new_area_method)
    print('✅ matchesAreaCriteria 同期化適用')
else:
    print('❌ matchesAreaCriteriaWithDistance 箇所が見つかりません')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n✅ 完了')

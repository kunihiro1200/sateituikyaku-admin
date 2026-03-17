#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EnhancedBuyerDistributionService の速度改善
1. 問い合わせ物件の座標を事前に一括並列取得してキャッシュ
2. 買主フィルタリングを Promise.all で並列化
3. checkInquiryBasedMatch をキャッシュ参照に変更
"""

with open('src/services/EnhancedBuyerDistributionService.ts', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8').replace('\r\n', '\n')

# ===== 変更1: getQualifiedBuyersWithAllCriteria のステップ5〜6を改善 =====
old_step5_6 = """      // 5. 全買主の問い合わせ履歴を一括取得
      const inquiryMap = await this.fetchAllBuyerInquiries();
      console.log(`[EnhancedBuyerDistributionService] Inquiry history for ${inquiryMap.size} buyers`);

      // 6. 各統合買主にフィルターを適用
      const filteredBuyers: FilteredBuyer[] = [];

      for (const consolidatedBuyer of consolidatedBuyers) {
        // Get inquiries for all buyer records with this email
        const allInquiries: InquiryProperty[] = [];
        for (const originalRecord of consolidatedBuyer.originalRecords) {
          const buyerInquiries = inquiryMap.get(originalRecord.buyer_id) || [];
          allInquiries.push(...buyerInquiries);
        }
        
        // 地理的フィルター（問い合わせ + エリア）- 統合されたエリアを使用
        const geoMatch = await this.filterByGeographyConsolidated(
          propertyCoords,
          property.distribution_areas,
          consolidatedBuyer,
          allInquiries
        );

        // ログ出力
        this.logGeographicMatch(consolidatedBuyer.buyerNumbers.join(','), geoMatch);

        // 配信フラグフィルター - 統合された配信タイプを使用
        const distMatch = this.filterByDistributionFlagConsolidated(consolidatedBuyer);

        // ステータスフィルター - 統合されたステータスを使用
        const statusMatch = this.filterByLatestStatusConsolidated(consolidatedBuyer);

        // 価格帯フィルター - 統合された価格帯を使用
        const priceMatch = this.filterByPriceRangeConsolidated(
          property.price,
          property.property_type,
          consolidatedBuyer
        );

        // Use the consolidated buyer's email and data
        filteredBuyers.push({
          buyer_number: consolidatedBuyer.buyerNumbers.join(','), // Show all buyer numbers
          email: consolidatedBuyer.email,
          desired_area: consolidatedBuyer.allDesiredAreas,
          distribution_type: consolidatedBuyer.distributionType,
          latest_status: consolidatedBuyer.mostPermissiveStatus,
          desired_property_type: consolidatedBuyer.propertyTypes.join('、'),
          price_range_apartment: consolidatedBuyer.priceRanges.apartment.join(' / '),
          price_range_house: consolidatedBuyer.priceRanges.house.join(' / '),
          price_range_land: consolidatedBuyer.priceRanges.land.join(' / '),
          filterResults: {
            geography: geoMatch.matched,
            distribution: distMatch,
            status: statusMatch,
            priceRange: priceMatch
          },
          geographicMatch: geoMatch
        });
      }"""

new_step5_6 = """      // 5. 全買主の問い合わせ履歴を一括取得
      const inquiryMap = await this.fetchAllBuyerInquiries();
      console.log(`[EnhancedBuyerDistributionService] Inquiry history for ${inquiryMap.size} buyers`);

      // 5.5. 問い合わせ物件の座標を事前に一括並列取得（速度改善）
      const inquiryCoordsCacheStart = Date.now();
      const inquiryCoordsCache = await this.buildInquiryCoordinatesCache(inquiryMap);
      console.log(`[EnhancedBuyerDistributionService] Pre-fetched coordinates for ${inquiryCoordsCache.size} inquiry properties in ${Date.now() - inquiryCoordsCacheStart}ms`);

      // 6. 各統合買主にフィルターを適用（Promise.all で並列化）
      const filterStart = Date.now();
      const filteredBuyers: FilteredBuyer[] = await Promise.all(
        consolidatedBuyers.map(async (consolidatedBuyer) => {
          // Get inquiries for all buyer records with this email
          const allInquiries: InquiryProperty[] = [];
          for (const originalRecord of consolidatedBuyer.originalRecords) {
            const buyerInquiries = inquiryMap.get(originalRecord.buyer_id) || [];
            allInquiries.push(...buyerInquiries);
          }
          
          // 地理的フィルター（問い合わせ + エリア）- キャッシュ済み座標を使用
          const geoMatch = await this.filterByGeographyConsolidatedCached(
            propertyCoords,
            property.distribution_areas,
            consolidatedBuyer,
            allInquiries,
            inquiryCoordsCache
          );

          // 配信フラグフィルター - 統合された配信タイプを使用
          const distMatch = this.filterByDistributionFlagConsolidated(consolidatedBuyer);

          // ステータスフィルター - 統合されたステータスを使用
          const statusMatch = this.filterByLatestStatusConsolidated(consolidatedBuyer);

          // 価格帯フィルター - 統合された価格帯を使用
          const priceMatch = this.filterByPriceRangeConsolidated(
            property.price,
            property.property_type,
            consolidatedBuyer
          );

          return {
            buyer_number: consolidatedBuyer.buyerNumbers.join(','),
            email: consolidatedBuyer.email,
            desired_area: consolidatedBuyer.allDesiredAreas,
            distribution_type: consolidatedBuyer.distributionType,
            latest_status: consolidatedBuyer.mostPermissiveStatus,
            desired_property_type: consolidatedBuyer.propertyTypes.join('、'),
            price_range_apartment: consolidatedBuyer.priceRanges.apartment.join(' / '),
            price_range_house: consolidatedBuyer.priceRanges.house.join(' / '),
            price_range_land: consolidatedBuyer.priceRanges.land.join(' / '),
            filterResults: {
              geography: geoMatch.matched,
              distribution: distMatch,
              status: statusMatch,
              priceRange: priceMatch
            },
            geographicMatch: geoMatch
          };
        })
      );
      console.log(`[EnhancedBuyerDistributionService] Parallel filtering completed in ${Date.now() - filterStart}ms`);"""

if old_step5_6 in content:
    content = content.replace(old_step5_6, new_step5_6)
    print("✅ ステップ5〜6を並列化しました")
else:
    print("❌ ステップ5〜6が見つかりません")

# ===== 変更2: checkInquiryBasedMatch の後に新メソッドを追加 =====
# filterByGeographyConsolidated の直前に新メソッドを挿入

old_geo_method_start = """  /**
   * 統合地理フィルター（統合買主用）
   */
  private async filterByGeographyConsolidated("""

new_geo_methods = """  /**
   * 問い合わせ物件の座標を事前に一括並列取得してキャッシュ（速度改善）
   */
  private async buildInquiryCoordinatesCache(
    inquiryMap: Map<string, InquiryProperty[]>
  ): Promise<Map<string, Coordinates | null>> {
    // 全ユニーク物件番号を収集
    const uniqueInquiries = new Map<string, InquiryProperty>();
    for (const inquiries of inquiryMap.values()) {
      for (const inquiry of inquiries) {
        if (!uniqueInquiries.has(inquiry.propertyNumber)) {
          uniqueInquiries.set(inquiry.propertyNumber, inquiry);
        }
      }
    }

    // 並列で座標を取得
    const entries = Array.from(uniqueInquiries.entries());
    const results = await Promise.all(
      entries.map(async ([propertyNumber, inquiry]) => {
        const coords = await this.geolocationService.getCoordinates(
          inquiry.googleMapUrl,
          inquiry.address
        );
        return [propertyNumber, coords] as [string, Coordinates | null];
      })
    );

    return new Map(results);
  }

  /**
   * 統合地理フィルター（キャッシュ済み座標使用版）
   */
  private async filterByGeographyConsolidatedCached(
    propertyCoordinates: Coordinates | null,
    propertyDistributionAreas: string | null | undefined,
    consolidatedBuyer: ConsolidatedBuyer,
    allInquiries: InquiryProperty[],
    inquiryCoordsCache: Map<string, Coordinates | null>
  ): Promise<GeographicMatchResult> {
    const hasDistributionAreas = propertyDistributionAreas && propertyDistributionAreas.trim() !== '';

    // 1. 問い合わせベースマッチング（キャッシュ参照）
    let inquiryMatch: {
      matched: boolean;
      matchedInquiries: { propertyNumber: string; distance: number }[];
      minDistance?: number;
    } = { matched: false, matchedInquiries: [], minDistance: undefined };

    if (propertyCoordinates && allInquiries.length > 0) {
      const matchedInquiries: { propertyNumber: string; distance: number }[] = [];
      let minDistance = Infinity;

      for (const inquiry of allInquiries) {
        const inquiryCoords = inquiryCoordsCache.get(inquiry.propertyNumber);
        if (!inquiryCoords) continue;

        const distance = this.geolocationService.calculateDistance(
          propertyCoordinates,
          inquiryCoords
        );

        if (distance <= 3.0) {
          matchedInquiries.push({ propertyNumber: inquiry.propertyNumber, distance });
          minDistance = Math.min(minDistance, distance);
        }
      }

      inquiryMatch = {
        matched: matchedInquiries.length > 0,
        matchedInquiries,
        minDistance: matchedInquiries.length > 0 ? minDistance : undefined
      };
    }

    // 2. エリアベースマッチング
    const areaMatch = hasDistributionAreas
      ? this.checkAreaBasedMatch(propertyDistributionAreas, consolidatedBuyer.allDesiredAreas)
      : { matched: true, matchedAreas: [] };

    // 3. 結果を統合（OR条件）
    if (inquiryMatch.matched && areaMatch.matched) {
      return {
        matched: true,
        matchType: 'both',
        matchedAreas: areaMatch.matchedAreas,
        matchedInquiries: inquiryMatch.matchedInquiries,
        minDistance: inquiryMatch.minDistance
      };
    } else if (inquiryMatch.matched) {
      return {
        matched: true,
        matchType: 'inquiry',
        matchedInquiries: inquiryMatch.matchedInquiries,
        minDistance: inquiryMatch.minDistance
      };
    } else if (areaMatch.matched) {
      return {
        matched: true,
        matchType: 'area',
        matchedAreas: areaMatch.matchedAreas
      };
    } else {
      return { matched: false, matchType: 'none' };
    }
  }

  /**
   * 統合地理フィルター（統合買主用）
   */
  private async filterByGeographyConsolidated("""

if old_geo_method_start in content:
    content = content.replace(old_geo_method_start, new_geo_methods)
    print("✅ buildInquiryCoordinatesCache と filterByGeographyConsolidatedCached を追加しました")
else:
    print("❌ filterByGeographyConsolidated が見つかりません")

with open('src/services/EnhancedBuyerDistributionService.ts', 'wb') as f:
    f.write(content.replace('\n', '\r\n').encode('utf-8'))

print("\n=== 完了 ===")

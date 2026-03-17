#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyDistributionAreaCalculator.ts に座標直接渡しのメソッドを追加し、
propertyListings.ts のエンドポイントを修正する
"""

import re

# ===== 1. PropertyDistributionAreaCalculator.ts を修正 =====
with open('backend/src/services/PropertyDistributionAreaCalculator.ts', 'rb') as f:
    content = f.read().decode('utf-8')

# calculateDistributionAreas の直前に新しいメソッドを追加するのではなく、
# 既存メソッドのシグネチャを拡張して coords パラメータを追加する

old_method_sig = '''  /**
   * 物件の配信エリアを計算（直線距離のみ使用）
   * @param googleMapUrl Google Map URL
   * @param city 市名（オプション）
   * @param address 住所（別府市の詳細エリア判定用、オプション）
   * @returns 計算結果
   */
  async calculateDistributionAreas(
    googleMapUrl: string | null | undefined,
    city?: string | null,
    address?: string | null
  ): Promise<DistributionAreaCalculationResult> {'''

new_method_sig = '''  /**
   * 物件の配信エリアを計算（直線距離のみ使用）
   * @param googleMapUrl Google Map URL
   * @param city 市名（オプション）
   * @param address 住所（別府市の詳細エリア判定用、オプション）
   * @param preloadedCoords DBから取得済みの座標（指定時はURLからの抽出をスキップ）
   * @returns 計算結果
   */
  async calculateDistributionAreas(
    googleMapUrl: string | null | undefined,
    city?: string | null,
    address?: string | null,
    preloadedCoords?: { lat: number; lng: number } | null
  ): Promise<DistributionAreaCalculationResult> {'''

if old_method_sig in content:
    content = content.replace(old_method_sig, new_method_sig)
    print('✅ メソッドシグネチャを更新しました')
else:
    print('❌ メソッドシグネチャが見つかりません')

# URLから座標を抽出する部分を修正：preloadedCoords がある場合はスキップ
old_coords_logic = '''    // 2. URLから座標を抽出
    if (googleMapUrl) {
      const coords = await this.geolocationService.extractCoordinatesFromUrl(googleMapUrl);
      
      if (coords) {'''

new_coords_logic = '''    // 2. 座標を取得（DBの座標を優先、なければURLから抽出）
    let resolvedCoords: { lat: number; lng: number } | null = preloadedCoords || null;
    if (!resolvedCoords && googleMapUrl) {
      resolvedCoords = await this.geolocationService.extractCoordinatesFromUrl(googleMapUrl);
    }

    if (resolvedCoords) {
      const coords = resolvedCoords;
      if (true) {'''

if old_coords_logic in content:
    content = content.replace(old_coords_logic, new_coords_logic)
    print('✅ 座標取得ロジックを更新しました')
else:
    print('❌ 座標取得ロジックが見つかりません')

with open('backend/src/services/PropertyDistributionAreaCalculator.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ PropertyDistributionAreaCalculator.ts を更新しました')

# ===== 2. propertyListings.ts のエンドポイントを修正 =====
with open('backend/src/routes/propertyListings.ts', 'rb') as f:
    content2 = f.read().decode('utf-8')

old_endpoint = '''    const { PropertyDistributionAreaCalculator } = await import('../services/PropertyDistributionAreaCalculator');
    const { CityNameExtractor } = await import('../services/CityNameExtractor');
    const calculator = new PropertyDistributionAreaCalculator();
    const cityExtractor = new CityNameExtractor();

    const address = property.address || null;
    const city = address ? cityExtractor.extractCityFromAddress(address) : null;

    const result = await calculator.calculateDistributionAreas(
      googleMapUrl,
      city,
      address
    );'''

new_endpoint = '''    const { PropertyDistributionAreaCalculator } = await import('../services/PropertyDistributionAreaCalculator');
    const { CityNameExtractor } = await import('../services/CityNameExtractor');
    const calculator = new PropertyDistributionAreaCalculator();
    const cityExtractor = new CityNameExtractor();

    const address = property.address || null;
    const city = address ? cityExtractor.extractCityFromAddress(address) : null;

    // DBに座標がある場合はそれを優先使用（URLからの短縮URL展開を回避）
    const preloadedCoords = (property.latitude && property.longitude)
      ? { lat: Number(property.latitude), lng: Number(property.longitude) }
      : null;

    if (preloadedCoords) {
      console.log(`[DistributionArea] Using DB coordinates: ${preloadedCoords.lat}, ${preloadedCoords.lng}`);
    } else {
      console.log(`[DistributionArea] No DB coordinates, will try URL extraction`);
    }

    const result = await calculator.calculateDistributionAreas(
      googleMapUrl,
      city,
      address,
      preloadedCoords
    );'''

if old_endpoint in content2:
    content2 = content2.replace(old_endpoint, new_endpoint)
    print('✅ エンドポイントを更新しました')
else:
    print('❌ エンドポイントが見つかりません')

with open('backend/src/routes/propertyListings.ts', 'wb') as f:
    f.write(content2.encode('utf-8'))

print('✅ propertyListings.ts を更新しました')
print('\n完了！')

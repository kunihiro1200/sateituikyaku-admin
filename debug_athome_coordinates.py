# -*- coding: utf-8 -*-
"""
アットホームのページから正しい座標を取得するデバッグスクリプト
"""

import asyncio
import re
from playwright.async_api import async_playwright

async def debug_coordinates(url: str):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # ブラウザを表示
        page = await browser.new_page()
        
        print(f"アクセス中: {url}")
        await page.goto(url, wait_until='domcontentloaded', timeout=60000)
        await page.wait_for_timeout(5000)
        
        html = await page.content()
        
        print("\n" + "=" * 60)
        print("座標候補を検索中...")
        print("=" * 60)
        
        # パターン1: lat/latitude
        lat_pattern1 = re.findall(r'(?:lat|latitude)["\s:=]+([23][0-9]\.\d{5,})', html, re.IGNORECASE)
        print(f"\nパターン1 (lat/latitude): {len(lat_pattern1)}件")
        for i, lat in enumerate(lat_pattern1[:5], 1):
            print(f"  {i}. {lat}")
        
        # パターン2: lng/longitude
        lng_pattern1 = re.findall(r'(?:lng|lon|longitude)["\s:=]+(1[234][0-9]\.\d{5,})', html, re.IGNORECASE)
        print(f"\nパターン2 (lng/longitude): {len(lng_pattern1)}件")
        for i, lng in enumerate(lng_pattern1[:5], 1):
            print(f"  {i}. {lng}")
        
        # パターン3: Google Maps URL
        maps_coords = re.findall(r'maps\.google\.com[^"\']*[?&]q=([23][0-9]\.\d+)[,\s]+([12][0-9]{2}\.\d+)', html)
        print(f"\nパターン3 (Google Maps URL): {len(maps_coords)}件")
        for i, (lat, lng) in enumerate(maps_coords[:5], 1):
            print(f"  {i}. lat={lat}, lng={lng}")
        
        # パターン4: center パラメータ
        center_matches = re.findall(r'center["\s:]*[{(][^}]*lat["\s:]+([23][0-9]\.\d+)[^}]*lng["\s:]+([12][0-9]{2}\.\d+)', html, re.IGNORECASE)
        print(f"\nパターン4 (center): {len(center_matches)}件")
        for i, (lat, lng) in enumerate(center_matches[:5], 1):
            print(f"  {i}. lat={lat}, lng={lng}")
        
        # パターン5: 数値のみ（緯度）
        lat_numbers = list(set(re.findall(r'\b([23][0-9]\.\d{6,})\b', html)))
        print(f"\nパターン5 (数値のみ - 緯度): {len(lat_numbers)}件")
        for i, lat in enumerate(lat_numbers[:10], 1):
            print(f"  {i}. {lat}")
        
        # パターン6: 数値のみ（経度）
        lng_numbers = list(set(re.findall(r'\b(1[234][0-9]\.\d{6,})\b', html)))
        print(f"\nパターン6 (数値のみ - 経度): {len(lng_numbers)}件")
        for i, lng in enumerate(lng_numbers[:10], 1):
            print(f"  {i}. {lng}")
        
        # JavaScriptから座標を取得
        print("\n" + "=" * 60)
        print("JavaScriptから座標を取得中...")
        print("=" * 60)
        
        try:
            # window.mapDataなどのグローバル変数を確認
            map_data = await page.evaluate("""
                () => {
                    const result = {};
                    
                    // よくある変数名をチェック
                    if (typeof mapData !== 'undefined') result.mapData = mapData;
                    if (typeof propertyData !== 'undefined') result.propertyData = propertyData;
                    if (typeof latitude !== 'undefined') result.latitude = latitude;
                    if (typeof longitude !== 'undefined') result.longitude = longitude;
                    if (typeof lat !== 'undefined') result.lat = lat;
                    if (typeof lng !== 'undefined') result.lng = lng;
                    
                    return result;
                }
            """)
            
            if map_data:
                print("JavaScriptグローバル変数:")
                for key, value in map_data.items():
                    print(f"  {key}: {value}")
            else:
                print("JavaScriptグローバル変数: 見つかりませんでした")
        except Exception as e:
            print(f"JavaScript実行エラー: {e}")
        
        print("\n" + "=" * 60)
        print("推奨される座標:")
        print("=" * 60)
        
        # 最も信頼できる座標を選択
        if center_matches:
            lat, lng = center_matches[0]
            print(f"center パラメータから: lat={lat}, lng={lng}")
            print(f"Google Maps URL: https://www.google.com/maps?q={lat},{lng}")
        elif maps_coords:
            lat, lng = maps_coords[0]
            print(f"Google Maps URLから: lat={lat}, lng={lng}")
            print(f"Google Maps URL: https://www.google.com/maps?q={lat},{lng}")
        elif lat_pattern1 and lng_pattern1:
            lat = lat_pattern1[0]
            lng = lng_pattern1[0]
            print(f"lat/lng パラメータから: lat={lat}, lng={lng}")
            print(f"Google Maps URL: https://www.google.com/maps?q={lat},{lng}")
        else:
            print("座標が見つかりませんでした")
        
        print("\n" + "=" * 60)
        print("ブラウザを閉じるには、ウィンドウを閉じてください")
        print("=" * 60)
        
        # ブラウザを開いたまま待機
        await page.wait_for_timeout(300000)  # 5分間待機
        
        await browser.close()

if __name__ == '__main__':
    # テスト用URL
    url = 'https://www.athome.co.jp/mansion/6990582043/'
    asyncio.run(debug_coordinates(url))

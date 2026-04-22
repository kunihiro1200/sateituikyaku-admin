"""
FIプレフィックス売主の座標を再ジオコーディングするスクリプト

バグ: GeocodingService が FI売主の住所に「大分県」を誤付加していたため、
     誤った座標（大分県内の位置）が保存されていた。

このスクリプトは:
1. FIプレフィックスの売主で property_address が設定されている売主を取得
2. 正しい住所（「大分県」を付加しない）で再ジオコーディング
3. sellers テーブルの latitude/longitude を更新
"""

import os
import sys
import time
import urllib.request
import urllib.parse
import json

# 環境変数から設定を読み込む
SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"
GOOGLE_MAPS_API_KEY = "AIzaSyCjK1gbrfWUQ5uuvd_3VOZVvTFjQVmxP3E"


def supabase_request(method, path, data=None):
    """Supabase REST APIにリクエストを送る"""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))


def geocode_address(address):
    """Google Geocoding APIで住所を座標に変換（大分県を付加しない）"""
    encoded_address = urllib.parse.quote(address)
    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={encoded_address}&key={GOOGLE_MAPS_API_KEY}"
    
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode("utf-8"))
    
    if result["status"] == "OK" and result["results"]:
        location = result["results"][0]["geometry"]["location"]
        formatted = result["results"][0].get("formatted_address", "")
        return location["lat"], location["lng"], formatted
    
    return None, None, None


def main():
    print("=== FI売主座標再ジオコーディングスクリプト ===\n")
    
    # FIプレフィックスの売主を取得（property_addressが設定されているもの）
    print("FIプレフィックスの売主を取得中...")
    sellers = supabase_request(
        "GET",
        "sellers?seller_number=like.FI*&property_address=not.is.null&select=id,seller_number,property_address,latitude,longitude"
    )
    
    print(f"対象売主数: {len(sellers)}件\n")
    
    if not sellers:
        print("対象売主が見つかりませんでした。")
        return
    
    updated = 0
    skipped = 0
    errors = 0
    
    for seller in sellers:
        seller_number = seller["seller_number"]
        address = seller["property_address"]
        current_lat = seller.get("latitude")
        current_lng = seller.get("longitude")
        
        print(f"[{seller_number}] 住所: {address}")
        print(f"  現在の座標: lat={current_lat}, lng={current_lng}")
        
        # 再ジオコーディング（大分県を付加しない）
        lat, lng, formatted = geocode_address(address)
        
        if lat is None:
            print(f"  ❌ ジオコーディング失敗")
            errors += 1
            time.sleep(0.2)
            continue
        
        print(f"  新しい座標: lat={lat}, lng={lng}")
        print(f"  フォーマット済み住所: {formatted}")
        
        # 座標が変わった場合のみ更新
        if current_lat == lat and current_lng == lng:
            print(f"  ⏭️  座標変更なし、スキップ")
            skipped += 1
        else:
            # DBを更新
            supabase_request(
                "PATCH",
                f"sellers?seller_number=eq.{seller_number}",
                {"latitude": lat, "longitude": lng}
            )
            print(f"  ✅ 座標を更新しました")
            updated += 1
        
        print()
        time.sleep(0.2)  # API制限対策
    
    print("=== 完了 ===")
    print(f"更新: {updated}件")
    print(f"スキップ: {skipped}件")
    print(f"エラー: {errors}件")


if __name__ == "__main__":
    main()

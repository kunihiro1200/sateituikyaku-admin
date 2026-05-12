import os
import requests
from dotenv import load_dotenv

# .envファイルを読み込む
load_dotenv('backend/.env.local')
load_dotenv('backend/.env')

# Google Maps APIキーを取得
api_key = os.getenv('GOOGLE_MAPS_API_KEY')

print("=== AA14088 座標確認 ===")
print()

# 現在の座標
current_lat = 33.2370297
current_lng = 131.6016492
print(f"現在の座標: 緯度 {current_lat}, 経度 {current_lng}")
print(f"現在のGoogleマップURL: https://www.google.com/maps?q={current_lat},{current_lng}")
print()

# 正しい住所
correct_address = "大分県大分市大字光吉光吉新町3-5-10"
print(f"正しい住所: {correct_address}")
print()

# ジオコーディング
url = f"https://maps.googleapis.com/maps/api/geocode/json?address={correct_address}&key={api_key}&language=ja"
try:
    response = requests.get(url, timeout=10)
    data = response.json()
    
    print(f"APIステータス: {data['status']}")
    
    if data['status'] == 'OK' and data['results']:
        location = data['results'][0]['geometry']['location']
        formatted_address = data['results'][0]['formatted_address']
        
        print(f"APIから取得した住所: {formatted_address}")
        print(f"正しい座標: 緯度 {location['lat']}, 経度 {location['lng']}")
        print(f"正しいGoogleマップURL: https://www.google.com/maps?q={location['lat']},{location['lng']}")
        print()
        
        # 距離を計算
        from math import radians, cos, sin, asin, sqrt
        
        def haversine(lon1, lat1, lon2, lat2):
            lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
            dlon = lon2 - lon1
            dlat = lat2 - lat1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * asin(sqrt(a))
            r = 6371  # 地球の半径（km）
            return c * r * 1000  # メートルに変換
        
        distance = haversine(current_lng, current_lat, location['lng'], location['lat'])
        print(f"現在の座標と正しい座標の距離: {distance:.1f}メートル")
        print()
        
        if distance > 100:
            print("⚠️ 警告: 座標が100メートル以上ずれています！")
            print("修正が必要です。")
        else:
            print("✅ 座標は正しい範囲内です（100メートル以内）")
    else:
        print(f"ジオコーディング失敗: {data.get('error_message', 'Unknown error')}")
        
except Exception as e:
    print(f"エラー: {e}")
    print()
    print("手動確認:")
    print(f"1. 現在の座標をブラウザで開く: https://www.google.com/maps?q={current_lat},{current_lng}")
    print(f"2. 正しい住所で検索: {correct_address}")
    print("3. 両方の位置を比較してください")

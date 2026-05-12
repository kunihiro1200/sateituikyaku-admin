import os
import requests
from dotenv import load_dotenv

# .envファイルを読み込む
load_dotenv('backend/.env.local')
load_dotenv('backend/.env')

# Google Maps APIキーを取得
api_key = os.getenv('GOOGLE_MAPS_API_KEY')

# AA14088の座標
lat = 33.2370297
lng = 131.6016492

print(f"AA14088の座標: 緯度 {lat}, 経度 {lng}")
print(f"GoogleマップURL: https://www.google.com/maps?q={lat},{lng}")
print()

# 逆ジオコーディングで座標から住所を取得
url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={api_key}&language=ja"
response = requests.get(url)
data = response.json()

if data['status'] == 'OK' and data['results']:
    print("この座標の住所:")
    print(data['results'][0]['formatted_address'])
    print()
    
print("正しい住所: 大分市大字光吉光吉新町3-5-10")
print()

# 正しい住所をジオコーディング
correct_address = "大分市大字光吉光吉新町3-5-10"
url2 = f"https://maps.googleapis.com/maps/api/geocode/json?address={correct_address}&key={api_key}&language=ja"
response2 = requests.get(url2)
data2 = response2.json()

if data2['status'] == 'OK' and data2['results']:
    location = data2['results'][0]['geometry']['location']
    print(f"正しい住所の座標: 緯度 {location['lat']}, 経度 {location['lng']}")
    print(f"GoogleマップURL: https://www.google.com/maps?q={location['lat']},{location['lng']}")
    print()
    
    # 距離を計算（簡易計算）
    from math import radians, cos, sin, asin, sqrt
    
    def haversine(lon1, lat1, lon2, lat2):
        lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        r = 6371  # 地球の半径（km）
        return c * r * 1000  # メートルに変換
    
    distance = haversine(lng, lat, location['lng'], location['lat'])
    print(f"現在の座標と正しい座標の距離: {distance:.1f}メートル")
    
    if distance > 100:
        print("⚠️ 警告: 座標が100メートル以上ずれています！")
    else:
        print("✅ 座標は正しい範囲内です")

import os
import requests
from supabase import create_client
from dotenv import load_dotenv

# .envファイルを読み込む
load_dotenv('backend/.env.local')
load_dotenv('backend/.env')

supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')

# APIキーを直接読み込む
api_key = None
with open('backend/.env', 'r', encoding='utf-8') as f:
    for line in f:
        if line.startswith('GOOGLE_MAPS_API_KEY='):
            api_key = line.split('=')[1].strip()
            break

supabase = create_client(supabase_url, supabase_key)

print("=== AA14088 住所・座標修正 ===")
print()

# 現在のデータを取得
response = supabase.table('sellers').select('seller_number, property_address, latitude, longitude').eq('seller_number', 'AA14088').single().execute()

if response.data:
    data = response.data
    print(f"物件番号: {data['seller_number']}")
    print(f"現在の住所: {data['property_address']}")
    print(f"現在の緯度: {data['latitude']}")
    print(f"現在の経度: {data['longitude']}")
    print(f"現在のURL: https://www.google.com/maps?q={data['latitude']},{data['longitude']}")
    print()
    
    # 正しい住所
    correct_address = "大分市大字光吉3-5-10"
    full_address = f"大分県{correct_address}"
    
    print(f"正しい住所: {correct_address}")
    print(f"ジオコーディング実行: {full_address}")
    print()
    
    # ジオコーディング
    url = f"https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        'address': full_address,
        'key': api_key,
        'language': 'ja',
        'region': 'jp'
    }
    
    try:
        response_geo = requests.get(url, params=params, timeout=10)
        data_geo = response_geo.json()
        
        if data_geo['status'] == 'OK' and data_geo['results']:
            location = data_geo['results'][0]['geometry']['location']
            formatted_address = data_geo['results'][0]['formatted_address']
            
            new_lat = location['lat']
            new_lng = location['lng']
            
            print(f"取得した住所: {formatted_address}")
            print(f"新しい緯度: {new_lat}")
            print(f"新しい経度: {new_lng}")
            print(f"新しいURL: https://www.google.com/maps?q={new_lat},{new_lng}")
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
                return c * r
            
            distance = haversine(data['longitude'], data['latitude'], new_lng, new_lat)
            print(f"現在の座標からの距離: {distance:.2f}km")
            print()
            
            # データベースを更新
            print("データベースを更新中...")
            update_response = supabase.table('sellers').update({
                'property_address': correct_address,
                'latitude': new_lat,
                'longitude': new_lng
            }).eq('seller_number', 'AA14088').execute()
            
            if update_response.data:
                print("✅ 住所と座標を更新しました")
                print()
                print("更新内容:")
                print(f"  住所: {data['property_address']} → {correct_address}")
                print(f"  緯度: {data['latitude']} → {new_lat}")
                print(f"  経度: {data['longitude']} → {new_lng}")
                print()
                print("確認:")
                print(f"新しいGoogleマップURL: https://www.google.com/maps?q={new_lat},{new_lng}")
                print("このURLをブラウザで開いて、正しい場所（大分市光吉地区）が表示されるか確認してください")
            else:
                print("❌ 更新に失敗しました")
        else:
            print(f"❌ ジオコーディング失敗: {data_geo['status']}")
            
    except Exception as e:
        print(f"❌ エラー: {e}")
else:
    print("データが見つかりませんでした")

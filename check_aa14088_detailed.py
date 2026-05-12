import os
from supabase import create_client
from dotenv import load_dotenv

# .envファイルを読み込む
load_dotenv('backend/.env.local')
load_dotenv('backend/.env')

supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')

supabase = create_client(supabase_url, supabase_key)

# AA14088の物件データを取得
response = supabase.table('sellers').select('*').eq('seller_number', 'AA14088').single().execute()

if response.data:
    data = response.data
    print("=== AA14088 詳細情報 ===")
    print()
    print(f"物件番号: {data['seller_number']}")
    print(f"物件住所: {data['property_address']}")
    print(f"緯度: {data['latitude']}")
    print(f"経度: {data['longitude']}")
    print()
    
    if data['latitude'] and data['longitude']:
        lat = data['latitude']
        lng = data['longitude']
        print(f"GoogleマップURL: https://www.google.com/maps?q={lat},{lng}")
        print()
        
        # 大分市光吉地区のおおよその座標範囲
        # 光吉地区は大分市の北東部に位置
        print("大分市光吉地区の座標範囲（おおよそ）:")
        print("  緯度: 33.23～33.25")
        print("  経度: 131.60～131.62")
        print()
        
        if 33.23 <= lat <= 33.25 and 131.60 <= lng <= 131.62:
            print("✅ 座標は大分市光吉地区の範囲内です")
        else:
            print("⚠️ 警告: 座標が大分市光吉地区の範囲外です！")
            print()
            print("考えられる原因:")
            print("1. 住所のジオコーディングが失敗している")
            print("2. 住所に誤りがある")
            print("3. Google Maps APIが間違った座標を返している")
        
        print()
        print("確認方法:")
        print(f"1. ブラウザで開く: https://www.google.com/maps?q={lat},{lng}")
        print("2. 表示された場所が「大分市大字光吉光吉新町3-5-10」付近か確認")
        print("3. もし違う場所が表示されている場合は、座標の再取得が必要")
    else:
        print("⚠️ 座標が設定されていません")
else:
    print("データが見つかりませんでした")

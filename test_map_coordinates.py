# -*- coding: utf-8 -*-
"""
地図座標のテストスクリプト

athome_scrape_result.jsonの座標が正しいか確認する
"""

import json

# スクレイピング結果を読み込む
with open('athome_scrape_result.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=" * 60)
print("スクレイピング結果の座標確認")
print("=" * 60)
print(f"URL: {data['url']}")
print(f"タイトル: {data['title']}")
print(f"住所: {data['details'].get('所在地', 'なし')}")
print()
print(f"取得された座標:")
print(f"  緯度 (lat): {data['lat']}")
print(f"  経度 (lng): {data['lng']}")
print()
print(f"Google Maps URL:")
print(f"  https://www.google.com/maps?q={data['lat']},{data['lng']}")
print()
print("=" * 60)
print("確認方法:")
print("1. 上記のGoogle Maps URLをブラウザで開く")
print("2. 表示された位置が正しいか確認する")
print("3. 住所と一致しているか確認する")
print("=" * 60)

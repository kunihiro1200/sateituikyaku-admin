# -*- coding: utf-8 -*-
"""
地図座標の取得精度を改善するスクリプト

問題: スクレイピングサーバーが間違った座標を取得している
解決: より正確な正規表現パターンを使用する
"""

# ファイルを読み込む
with open('scrape-server/scrape_server.py', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 現在のコード（108-121行目）
old_code = """        # 緯度経度（日本全国対応: 緯度24-46度、経度122-154度）
        # より精度の高い抽出：HTMLのJSONデータから取得
        lat_candidates = list(set(re.findall(r'(?:lat|latitude)["\s:=]+([23][0-9]\.\d{5,})', html, re.IGNORECASE)))
        lng_candidates = list(set(re.findall(r'(?:lng|lon|longitude)["\s:=]+(1[234][0-9]\.\d{5,})', html, re.IGNORECASE)))

        # フォールバック: 数値パターンで抽出
        if not lat_candidates:
            lat_candidates = list(set(re.findall(r'[23][0-9]\.\d{6,}', html)))
        if not lng_candidates:
            lng_candidates = list(set(re.findall(r'1[234][0-9]\.\d{6,}', html)))

        if lat_candidates:
            result['lat'] = float(lat_candidates[0])
        if lng_candidates:
            result['lng'] = float(lng_candidates[0])"""

# 新しいコード（より正確な抽出）
new_code = """        # 緯度経度（日本全国対応: 緯度24-46度、経度122-154度）
        # パターン1: HTMLのJSONデータから取得（最も正確）
        # 例: "lat":33.227352, "latitude":"33.227352"
        lat_candidates = list(set(re.findall(r'(?:lat|latitude)["\'\\s:=]+([23][0-9]\\.\d{5,})', html, re.IGNORECASE)))
        lng_candidates = list(set(re.findall(r'(?:lng|lon|longitude)["\'\\s:=]+(1[234][0-9]\\.\d{5,})', html, re.IGNORECASE)))

        # パターン2: Google Maps URLから抽出（より正確）
        # 例: https://maps.google.com/?q=33.227352,131.586999
        if not lat_candidates or not lng_candidates:
            maps_coords = re.findall(r'maps\\.google\\.com/\\?q=([23][0-9]\\.\\d+),\\s*(1[234][0-9]\\.\\d+)', html)
            if maps_coords:
                lat_candidates = [maps_coords[0][0]]
                lng_candidates = [maps_coords[0][1]]

        # パターン3: center パラメータから抽出
        # 例: center: {lat: 33.227352, lng: 131.586999}
        if not lat_candidates or not lng_candidates:
            center_match = re.search(r'center[\\s:]*\\{[^}]*lat[\\s:]+([23][0-9]\\.\\d+)[^}]*lng[\\s:]+([12][0-9]{2}\\.\\d+)', html, re.IGNORECASE)
            if center_match:
                lat_candidates = [center_match.group(1)]
                lng_candidates = [center_match.group(2)]

        # フォールバック: 数値パターンで抽出（最も不正確）
        if not lat_candidates:
            lat_candidates = list(set(re.findall(r'[23][0-9]\\.\\d{6,}', html)))
        if not lng_candidates:
            lng_candidates = list(set(re.findall(r'1[234][0-9]\\.\\d{6,}', html)))

        if lat_candidates:
            result['lat'] = float(lat_candidates[0])
            print(f'[scrape] Latitude: {result["lat"]} (from {len(lat_candidates)} candidates)')
        if lng_candidates:
            result['lng'] = float(lng_candidates[0])
            print(f'[scrape] Longitude: {result["lng"]} (from {len(lng_candidates)} candidates)')"""

if old_code in text:
    text = text.replace(old_code, new_code)
    print("✅ 地図座標の取得精度を改善しました")
else:
    print("❌ 対象コードが見つかりませんでした")
    print("\n現在のコードを確認してください:")
    # 108行目付近を表示
    lines = text.split('\n')
    for i, line in enumerate(lines[105:125], start=106):
        print(f"{i}: {line}")

# UTF-8で書き込む
with open('scrape-server/scrape_server.py', 'wb') as f:
    f.write(text.encode('utf-8'))

print("Done!")

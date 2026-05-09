import base64
import os

asset_dir = r"C:\Users\kunih\sateituikyaku-admin\frontend\frontend\public\ifoo-assets"
output_ts = r"C:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\utils\printHtmlGenerators.ts"

files = {
    "logo":        "logo.png",
    "charaLeft":   "chara-left.png",
    "houseHeart":  "house-heart.png",
    "charaRight":  "chara-right.png",
    "waHouses":    "wa-houses.png",
}

b64 = {}
for key, fname in files.items():
    with open(os.path.join(asset_dir, fname), "rb") as f:
        b64[key] = base64.b64encode(f.read()).decode("ascii")

# 現在のTSファイルを読み込む
with open(output_ts, "rb") as f:
    content = f.read().decode("utf-8")

# generateViewingPrep2Html 関数全体を置換
old_marker = "export function generateViewingPrep2Html("
end_marker = "// ============================================================\n// ページ2: 買付申込書"

# 関数の開始は // === コメント2行前から
start_idx = content.rfind("// ============================================================\n// 内覧準備資料２:", 0, content.find(old_marker))
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("ERROR: markers not found")
    print("start_idx:", start_idx, "end_idx:", end_idx)
    exit(1)

new_func = f'''// ============================================================
// 内覧準備資料２: 挨拶状（いふうスタイル・実画像埋め込み版）
// ============================================================
export function generateViewingPrep2Html(buyer: Record<string,unknown>, _today: string): string {{
  const rawName = (buyer.name as string) || '';
  const nameWithSama = rawName
    ? (rawName.endsWith('様') ? rawName : rawName + '様')
    : '';

  const imgLogo       = 'data:image/png;base64,{b64["logo"]}';
  const imgCharaLeft  = 'data:image/png;base64,{b64["charaLeft"]}';
  const imgHouseHeart = 'data:image/png;base64,{b64["houseHeart"]}';
  const imgCharaRight = 'data:image/png;base64,{b64["charaRight"]}';
  const imgWaHouses   = 'data:image/png;base64,{b64["waHouses"]}';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  @page {{ size: A4 portrait; margin: 0; }}
  * {{ box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }}
  body {{ margin: 0; padding: 0; background: #fff; font-family: "Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif; color: #000; }}
</style>
</head>
<body>
<div style="width:794px;height:1123px;padding:18px;background:#fff;">
<div style="border:2px solid #f5c518;width:100%;height:100%;padding:28px 40px;display:flex;flex-direction:column;">

  <!-- ロゴ（左上） -->
  <div style="margin-bottom:20px;">
    <img src="${{imgLogo}}" height="56" style="display:block;"/>
  </div>

  <!-- 買主名（中央・大） -->
  <div style="text-align:center;margin-bottom:14px;">
    <span style="font-size:24pt;font-weight:bold;letter-spacing:0.05em;">${{esc(nameWithSama)}}</span>
  </div>

  <!-- 横線（黒） -->
  <div style="border-bottom:1.5px solid #000;margin-bottom:22px;"></div>

  <!-- お礼メッセージ -->
  <div style="text-align:center;margin-bottom:28px;">
    <div style="font-size:12.5pt;font-weight:bold;line-height:2.0;">本日は貴重なお時間いただきまして</div>
    <div style="font-size:12.5pt;font-weight:bold;line-height:2.0;">誠にありがとうございます</div>
  </div>

  <!-- 中段：左キャラ＋中央本文＋右家イラスト -->
  <div style="display:flex;align-items:flex-start;flex:1;">

    <!-- 左：吹き出し＋女性キャラ -->
    <div style="width:155px;flex-shrink:0;">
      <img src="${{imgCharaLeft}}" width="155" style="display:block;"/>
    </div>

    <!-- 中央：本文 -->
    <div style="flex:1;padding:8px 10px 0 6px;text-align:center;">
      <div style="font-size:11pt;line-height:2.1;margin-bottom:8px;">
        大分市・別府市の不動産購入は<br>
        いふうにおまかせください！
      </div>
      <div style="font-size:10pt;line-height:2.0;text-align:left;display:inline-block;">
        「資金計画」や「現地見学」「売買契約」など、<br>
        お住まい購入時の流れやポイントを<br>
        丁寧にご説明いたします<br>
        お気軽にご相談ください！
      </div>
    </div>

    <!-- 右：家＋ハートイラスト -->
    <div style="width:130px;flex-shrink:0;">
      <img src="${{imgHouseHeart}}" width="130" style="display:block;"/>
    </div>
  </div>

  <!-- 右下：どーんっ！女性キャラ -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:18px;margin-top:4px;">
    <img src="${{imgCharaRight}}" width="190" style="display:block;"/>
  </div>

  <!-- 横線（グレー） -->
  <div style="border-bottom:1px solid #ccc;margin-bottom:16px;"></div>

  <!-- フッター：左に和柄家、右に会社情報 -->
  <div style="display:flex;align-items:center;justify-content:space-between;">
    <img src="${{imgWaHouses}}" width="210" style="display:block;"/>
    <div style="text-align:left;">
      <div style="font-size:8.5pt;margin-bottom:5px;">不動産のことなら「いふう」へ</div>
      <div style="background:#f5c518;padding:5px 20px;font-size:11pt;font-weight:bold;text-align:center;margin-bottom:7px;">株式会社いふう</div>
      <div style="font-size:9pt;line-height:1.9;">
        大分市舞鶴町1-3-30<br>
        TEL：097-533-2022<br>
        FAX：097-529-7160
      </div>
    </div>
  </div>

</div>
</div>
</body>
</html>`;
}}

'''

new_content = content[:start_idx] + new_func + content[end_idx:]

with open(output_ts, "wb") as f:
    f.write(new_content.encode("utf-8"))

print("Done! File written successfully.")
print(f"New function length: {len(new_func)} chars")

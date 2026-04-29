# encoding: utf-8
with open('backend/src/routes/sellers.ts', 'rb') as f:
    text = f.read().decode('utf-8')

# promptの開始から backtick終了まで置換
prompt_start = "    const prompt = `あなたは不動産売買仲介会社の営業担当者です。"
prompt_end = "- 「※本レポートの数値は市場動向に基づく概算値です。実際の取引価格は個別物件の状況により異なります。」`;"

start_idx = text.find(prompt_start)
end_idx = text.find(prompt_end)

if start_idx == -1:
    print('ERROR: prompt start not found')
elif end_idx == -1:
    print('ERROR: prompt end not found')
else:
    end_idx += len(prompt_end)
    
    new_prompt = '''    // AIにはJSONで数値・コメントだけ返させる（HTMLラベルはコードで制御）
    const jsonPrompt = `以下のエリアについて、不動産売却資料用のデータをJSON形式で返してください。

対象エリア: ${detailArea}（${cityLabel}内）
物件種別: ${propertyType || '不動産'}
現在年: 2026年

以下のJSON形式で返してください。数値は概算で構いません。

{
  "population": [
    {"year": "2015年", "city": 数値, "area": 数値},
    {"year": "2018年", "city": 数値, "area": 数値},
    {"year": "2021年", "city": 数値, "area": 数値},
    {"year": "2024年", "city": 数値, "area": 数値},
    {"year": "2025年", "city": 数値, "area": 数値}
  ],
  "populationComment": "分析コメント（エリアの特徴を強調）",
  "household": [
    {"type": "単身世帯", "city": "XX%", "area": "XX%"},
    {"type": "夫婦のみ", "city": "XX%", "area": "XX%"},
    {"type": "核家族", "city": "XX%", "area": "XX%"},
    {"type": "三世代同居", "city": "XX%", "area": "XX%"}
  ],
  "householdComment": "分析コメント",
  "transactions": [
    {"year": "2020年", "city": 数値, "area": 数値},
    {"year": "2021年", "city": 数値, "area": 数値},
    {"year": "2022年", "city": 数値, "area": 数値},
    {"year": "2023年", "city": 数値, "area": 数値},
    {"year": "2024年", "city": 数値, "area": 数値},
    {"year": "2025年", "city": 数値, "area": 数値}
  ],
  "transactionsComment": "分析コメント",
  "prices": [
    {"year": "2020年", "city": 数値, "area": 数値},
    {"year": "2021年", "city": 数値, "area": 数値},
    {"year": "2022年", "city": 数値, "area": 数値},
    {"year": "2023年", "city": 数値, "area": 数値},
    {"year": "2024年", "city": 数値, "area": 数値},
    {"year": "2025年", "city": 数値, "area": 数値}
  ],
  "pricesComment": "分析コメント",
  "summary": ["理由1", "理由2", "理由3", "理由4", "理由5"]
}

JSONのみ返してください。説明文は不要です。`;'''
    
    new_text = text[:start_idx] + new_prompt + text[end_idx:]
    with open('backend/src/routes/sellers.ts', 'wb') as f:
        f.write(new_text.encode('utf-8'))
    print('Done! Replaced prompt.')

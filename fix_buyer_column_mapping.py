#!/usr/bin/env python3
"""
buyer-column-mapping.jsonのlatest_viewing_dateをviewing_dateに修正
"""
import json

filepath = 'backend/dist/src/config/buyer-column-mapping.json'

with open(filepath, 'r', encoding='utf-8') as f:
    data = json.load(f)

# spreadsheetToDatabaseセクションを修正
if '●内覧日(最新）' in data['spreadsheetToDatabase']:
    data['spreadsheetToDatabase']['●内覧日(最新）'] = 'viewing_date'
    print('✅ spreadsheetToDatabase: ●内覧日(最新） → viewing_date')

# typeConversionsセクションを修正
if 'latest_viewing_date' in data['typeConversions']:
    data['typeConversions']['viewing_date'] = data['typeConversions'].pop('latest_viewing_date')
    print('✅ typeConversions: latest_viewing_date → viewing_date')

# ファイルに書き込む
with open(filepath, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)

print(f'\n✅ {filepath} を修正しました')

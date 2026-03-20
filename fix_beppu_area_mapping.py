# cityAreaMapping.ts の getBeppuCityAreas を仕様に従って更新する
# - 「大字」を削除してから判定
# - 「別府市」が含まれていることが前提
# - 仕様の町名リストを BEPPU_CITY_AREA_MAP に追加

with open('backend/src/utils/cityAreaMapping.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 旧 getBeppuCityAreas 関数を新しい実装に置き換える
old_func = '''/**
 * 住所から別府市のエリア番号を判定する
 * @param address 住所文字列
 * @returns マッチしたエリア番号の配列（例: ["⑨", "㊸"]）
 */
export function getBeppuCityAreas(address: string): string[] {
  const matched = new Set<string>();
  for (const [areaNum, towns] of Object.entries(BEPPU_CITY_AREA_MAP)) {
    for (const town of towns) {
      if (address.includes(town)) {
        matched.add(areaNum);
        break;
      }
    }
  }
  return Array.from(matched);
}'''

new_func = '''/**
 * 住所から別府市のエリア番号を判定する
 * 仕様:
 *   - 「大字」を削除してから判定
 *   - 「別府市」が含まれていることが前提
 *   - 町名の部分一致で判定（丁目・番地・号は無視）
 *   - より具体的な条件を優先（長い町名を先に検索）
 * @param address 住所文字列
 * @returns マッチしたエリア番号の配列（例: ["⑨", "㊸"]）
 */
export function getBeppuCityAreas(address: string): string[] {
  // 「大字」を削除して正規化
  const normalized = address.replace(/大字/g, '');

  // 「別府市」が含まれていない場合は空配列を返す
  if (!normalized.includes('別府市')) {
    return [];
  }

  const matched = new Set<string>();

  // BEPPU_CITY_AREA_MAP を使って判定
  // 長い町名を先に検索することで、より具体的な条件を優先する
  for (const [areaNum, towns] of Object.entries(BEPPU_CITY_AREA_MAP)) {
    // 長い町名を先に検索（具体的な条件を優先）
    const sortedTowns = [...towns].sort((a, b) => b.length - a.length);
    for (const town of sortedTowns) {
      if (normalized.includes(town)) {
        matched.add(areaNum);
        break;
      }
    }
  }

  return Array.from(matched);
}'''

if old_func in text:
    text = text.replace(old_func, new_func)
    print('✅ getBeppuCityAreas 関数を更新しました')
else:
    print('❌ 対象テキストが見つかりませんでした')
    idx = text.find('getBeppuCityAreas')
    print(repr(text[idx:idx+300]))

# 次に BEPPU_CITY_AREA_MAP に仕様の町名を追加する
# 仕様で指定された町名を既存マップに追加（重複は除く）

# 仕様の町名リスト（番号→エリア記号のマッピング）
spec_additions = {
    '⑩': ['駅前町', '上人本町', '元町', '荘園', '鶴見', '新港町', '緑丘町', '京町'],
    '⑪': ['スパランド豊海', '上人ケ浜町', '亀川浜田町', '平田町', '亀川四の湯町', '亀川東町', '野田'],
    '⑨': ['南立石', '鶴見', '古市町', '春木'],
    '⑫': ['大畑', '鉄輪', '竹の内'],
    '⑭': ['実相寺', '浜町'],
    '⑮': ['浜脇', '中島町', '楠町', '立田町', '火売', '新別府町'],
}

# 仕様の「石垣西9丁目」→⑪、「石垣西4丁目」→⑨、「石垣西10丁目」→⑫ は
# 丁目番号で区別が必要なため、特別処理が必要
# 現在の実装では「石垣西」が⑩と⑭に含まれているが、
# 仕様では丁目番号で⑨⑪⑫に分かれる
# → 丁目番号付きの具体的な町名を追加する

spec_additions_with_chome = {
    '⑪': ['石垣西9丁目'],
    '⑨': ['石垣西4丁目'],
    '⑫': ['石垣西10丁目'],
    '⑫': ['鶴見2521', '鶴見2522', '鶴見2523', '鶴見2524', '鶴見2525', '鶴見2526', '鶴見2527', '鶴見2528', '鶴見2529'],
    '⑨': ['鶴見4548', '鶴見4549'],
}

# BEPPU_CITY_AREA_MAP の各エリアに仕様の町名を追加
for area_symbol, towns_to_add in spec_additions.items():
    # 現在のマップから該当エリアの町名リストを取得
    search_key = f'"{area_symbol}": ['
    idx = text.find(search_key)
    if idx == -1:
        print(f'❌ エリア {area_symbol} が見つかりません')
        continue
    
    # 既存の町名リストの終わりを見つける
    end_idx = text.find('],', idx)
    if end_idx == -1:
        print(f'❌ エリア {area_symbol} の終端が見つかりません')
        continue
    
    existing_section = text[idx:end_idx]
    
    # 追加する町名（既存に含まれていないもの）
    new_towns = []
    for town in towns_to_add:
        if f'"{town}"' not in existing_section:
            new_towns.append(town)
    
    if new_towns:
        # 既存リストの末尾に追加
        new_towns_str = ','.join([f'"{t}"' for t in new_towns])
        old_section_end = text[end_idx-1:end_idx+2]  # "],の前後
        # 末尾の"],"の前に追加
        insert_pos = end_idx
        text = text[:insert_pos] + ',' + new_towns_str + text[insert_pos:]
        print(f'✅ エリア {area_symbol} に追加: {new_towns}')
    else:
        print(f'ℹ️  エリア {area_symbol}: 追加する新しい町名なし')

# 丁目番号付きの町名を追加（石垣西の丁目別判定）
# ⑪に石垣西9丁目を追加
for area_symbol, towns_to_add in [('⑪', ['石垣西9丁目']), ('⑨', ['石垣西4丁目']), ('⑫', ['石垣西10丁目'])]:
    search_key = f'"{area_symbol}": ['
    idx = text.find(search_key)
    if idx == -1:
        print(f'❌ エリア {area_symbol} が見つかりません')
        continue
    end_idx = text.find('],', idx)
    existing_section = text[idx:end_idx]
    new_towns = [t for t in towns_to_add if f'"{t}"' not in existing_section]
    if new_towns:
        new_towns_str = ','.join([f'"{t}"' for t in new_towns])
        text = text[:end_idx] + ',' + new_towns_str + text[end_idx:]
        print(f'✅ エリア {area_symbol} に丁目付き追加: {new_towns}')

# 「北石垣」→⑪、「北石垣（特定地番）」→⑫ の処理
# 「北石垣」は⑪に追加（既存チェック）
for area_symbol, towns_to_add in [('⑪', ['北石垣', '野田']), ('⑫', ['北鉄輪'])]:
    search_key = f'"{area_symbol}": ['
    idx = text.find(search_key)
    if idx == -1:
        continue
    end_idx = text.find('],', idx)
    existing_section = text[idx:end_idx]
    new_towns = [t for t in towns_to_add if f'"{t}"' not in existing_section]
    if new_towns:
        new_towns_str = ','.join([f'"{t}"' for t in new_towns])
        text = text[:end_idx] + ',' + new_towns_str + text[end_idx:]
        print(f'✅ エリア {area_symbol} に追加: {new_towns}')

with open('backend/src/utils/cityAreaMapping.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n✅ cityAreaMapping.ts を更新しました')

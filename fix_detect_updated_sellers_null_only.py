"""
detectUpdatedSellers の比較ロジックを修正:
- property_address: DBが空欄または「不明」の場合のみ更新対象
- name: DBがnullの場合のみ更新対象（既存ロジックはそのまま）
- valuation_amount_1/2/3: DBがnullの場合のみ更新対象
- valuation_method: DBが空欄の場合のみ更新対象
- current_status: DBが空欄の場合のみ更新対象（既存ロジックはそのまま）
"""

filepath = 'backend/src/services/EnhancedAutoSyncService.ts'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. property_addressの比較を「DBが空欄または不明の場合のみ」に変更
old_property_address = """          // property_addressの比較
          const dbPropertyAddress = dbSeller.property_address || '';
          const sheetPropertyAddress = sheetRow['物件所在地'] || '';
          if (sheetPropertyAddress !== dbPropertyAddress) {
            needsUpdate = true;
          }"""

new_property_address = """          // property_addressの比較（DBが空欄または「不明」の場合のみ更新）
          const dbPropertyAddress = dbSeller.property_address || '';
          const sheetPropertyAddress = sheetRow['物件所在地'] || '';
          if (sheetPropertyAddress && (dbPropertyAddress === '' || dbPropertyAddress === '不明')) {
            needsUpdate = true;
          }"""

if old_property_address not in text:
    print('❌ property_address比較ロジックが見つかりませんでした')
    exit(1)

text = text.replace(old_property_address, new_property_address, 1)
print('✅ property_address比較ロジックを修正しました')

# 2. 査定額の比較を「DBがnullの場合のみ」に変更
old_valuation = """          // 査定額の比較（手動入力優先、なければ自動計算）
          const sheetVal1Raw = sheetRow['査定額1'] || sheetRow['査定額1（自動計算）v'];
          const sheetVal2Raw = sheetRow['査定額2'] || sheetRow['査定額2（自動計算）v'];
          const sheetVal3Raw = sheetRow['査定額3'] || sheetRow['査定額3（自動計算）v'];
          const sheetVal1 = this.parseNumeric(sheetVal1Raw);
          const sheetVal2 = this.parseNumeric(sheetVal2Raw);
          const sheetVal3 = this.parseNumeric(sheetVal3Raw);
          // スプシは万円単位、DBは円単位
          const sheetVal1Yen = sheetVal1 !== null ? sheetVal1 * 10000 : null;
          const sheetVal2Yen = sheetVal2 !== null ? sheetVal2 * 10000 : null;
          const sheetVal3Yen = sheetVal3 !== null ? sheetVal3 * 10000 : null;
          if (sheetVal1Yen !== (dbSeller.valuation_amount_1 ?? null)) {
            needsUpdate = true;
          }
          if (sheetVal2Yen !== (dbSeller.valuation_amount_2 ?? null)) {
            needsUpdate = true;
          }
          if (sheetVal3Yen !=="""

new_valuation = """          // 査定額の比較（DBがnullの場合のみ更新）
          const sheetVal1Raw = sheetRow['査定額1'] || sheetRow['査定額1（自動計算）v'];
          const sheetVal2Raw = sheetRow['査定額2'] || sheetRow['査定額2（自動計算）v'];
          const sheetVal3Raw = sheetRow['査定額3'] || sheetRow['査定額3（自動計算）v'];
          const sheetVal1 = this.parseNumeric(sheetVal1Raw);
          const sheetVal2 = this.parseNumeric(sheetVal2Raw);
          const sheetVal3 = this.parseNumeric(sheetVal3Raw);
          // スプシは万円単位、DBは円単位
          const sheetVal1Yen = sheetVal1 !== null ? sheetVal1 * 10000 : null;
          const sheetVal2Yen = sheetVal2 !== null ? sheetVal2 * 10000 : null;
          const sheetVal3Yen = sheetVal3 !== null ? sheetVal3 * 10000 : null;
          if (sheetVal1Yen !== null && dbSeller.valuation_amount_1 === null) {
            needsUpdate = true;
          }
          if (sheetVal2Yen !== null && dbSeller.valuation_amount_2 === null) {
            needsUpdate = true;
          }
          if (sheetVal3Yen !=="""

if old_valuation not in text:
    print('❌ 査定額比較ロジックが見つかりませんでした')
    exit(1)

text = text.replace(old_valuation, new_valuation, 1)
print('✅ 査定額比較ロジックを修正しました')

# 3. 査定額3の残りの比較も修正（切れていた部分）
old_val3_end = """          if (sheetVal3Yen !== (dbSeller.valuation_amount_3 ?? null)) {
            needsUpdate = true;
          }"""

new_val3_end = """          if (sheetVal3Yen !== null && dbSeller.valuation_amount_3 === null) {
            needsUpdate = true;
          }"""

if old_val3_end not in text:
    print('❌ 査定額3比較ロジックが見つかりませんでした')
    exit(1)

text = text.replace(old_val3_end, new_val3_end, 1)
print('✅ 査定額3比較ロジックを修正しました')

# 4. valuation_methodの比較を「DBが空欄の場合のみ」に変更
old_valuation_method = """          // valuation_methodの比較
          const dbValuationMethod = dbSeller.valuation_method || '';
          const sheetValuationMethod = sheetRow['査定方法'] || '';
          if (sheetValuationMethod !== dbValuationMethod) {
            needsUpdate = true;
          }"""

new_valuation_method = """          // valuation_methodの比較（DBが空欄の場合のみ更新）
          const dbValuationMethod = dbSeller.valuation_method || '';
          const sheetValuationMethod = sheetRow['査定方法'] || '';
          if (sheetValuationMethod && dbValuationMethod === '') {
            needsUpdate = true;
          }"""

if old_valuation_method not in text:
    print('❌ valuation_method比較ロジックが見つかりませんでした')
    exit(1)

text = text.replace(old_valuation_method, new_valuation_method, 1)
print('✅ valuation_method比較ロジックを修正しました')

# UTF-8で書き込む（BOMなし）
with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')

# BOMチェック
with open(filepath, 'rb') as f:
    first_bytes = f.read(3)
if first_bytes == b'\xef\xbb\xbf':
    print('⚠️  BOM付きUTF-8です')
else:
    print('✅ BOMなしUTF-8です（正常）')

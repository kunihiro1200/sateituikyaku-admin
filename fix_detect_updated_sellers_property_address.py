"""
detectUpdatedSellers に property_address と current_status の比較を追加するスクリプト
"""
import re

filepath = 'backend/src/services/EnhancedAutoSyncService.ts'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. selectクエリに property_address と current_status を追加
old_select = "        .select('seller_number, status, contract_year_month, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, next_call_date, unreachable_status, inquiry_date, comments, valuation_amount_1, valuation_amount_2, valuation_amount_3, first_call_person, valuation_reason, valuation_method, name, updated_at')"
new_select = "        .select('seller_number, status, contract_year_month, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, next_call_date, unreachable_status, inquiry_date, comments, valuation_amount_1, valuation_amount_2, valuation_amount_3, first_call_person, valuation_reason, valuation_method, name, property_address, current_status, updated_at')"

if old_select not in text:
    print('❌ selectクエリが見つかりませんでした')
    exit(1)

text = text.replace(old_select, new_select, 1)
print('✅ selectクエリに property_address, current_status を追加しました')

# 2. 査定額比較の直前に property_address と current_status の比較を追加
# 「// 査定額の比較」の直前に挿入する
old_valuation_comment = """          // 査定額の比較（手動入力優先、なければ自動計算）
          const sheetVal1Raw = sheetRow['査定額1'] || sheetRow['査定額1（自動計算）v'];"""

new_valuation_comment = """          // property_addressの比較
          const dbPropertyAddress = dbSeller.property_address || '';
          const sheetPropertyAddress = sheetRow['物件所在地'] || '';
          if (sheetPropertyAddress !== dbPropertyAddress) {
            needsUpdate = true;
          }

          // current_statusの比較
          const dbCurrentStatus = dbSeller.current_status || '';
          const sheetCurrentStatus = sheetRow['状況（売主）'] || '';
          if (sheetCurrentStatus !== dbCurrentStatus) {
            needsUpdate = true;
          }

          // 査定額の比較（手動入力優先、なければ自動計算）
          const sheetVal1Raw = sheetRow['査定額1'] || sheetRow['査定額1（自動計算）v'];"""

if old_valuation_comment not in text:
    print('❌ 査定額比較コメントが見つかりませんでした')
    exit(1)

text = text.replace(old_valuation_comment, new_valuation_comment, 1)
print('✅ property_address と current_status の比較ロジックを追加しました')

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

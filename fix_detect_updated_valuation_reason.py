"""
detectUpdatedSellersにvaluation_reasonの比較を追加
"""

with open('backend/src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. selectにvaluation_reasonを追加
old_select = "        .select('seller_number, status, contract_year_month, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, next_call_date, unreachable_status, inquiry_date, comments, valuation_amount_1, valuation_amount_2, valuation_amount_3, first_call_person, updated_at')"
new_select = "        .select('seller_number, status, contract_year_month, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, next_call_date, unreachable_status, inquiry_date, comments, valuation_amount_1, valuation_amount_2, valuation_amount_3, first_call_person, valuation_reason, valuation_method, updated_at')"

count1 = text.count(old_select)
print(f"select修正対象: {count1}件")

if count1 > 0:
    text = text.replace(old_select, new_select)
    print("✅ selectにvaluation_reason, valuation_methodを追加")

# 2. first_call_personの比較の後にvaluation_reasonの比較を追加
old_comparison = """          // 査定額の比較（手動入力優先、なければ自動計算）
          const sheetVal1Raw = sheetRow['査定額1'] || sheetRow['査定額1（自動計算）v'];"""

new_comparison = """          // valuation_reasonの比較
          const dbValuationReason = dbSeller.valuation_reason || '';
          const sheetValuationReason = sheetRow['査定理由（査定サイトから転記）'] || '';
          if (sheetValuationReason !== dbValuationReason) {
            needsUpdate = true;
          }

          // valuation_methodの比較
          const dbValuationMethod = dbSeller.valuation_method || '';
          const sheetValuationMethod = sheetRow['査定方法'] || '';
          if (sheetValuationMethod !== dbValuationMethod) {
            needsUpdate = true;
          }

          // 査定額の比較（手動入力優先、なければ自動計算）
          const sheetVal1Raw = sheetRow['査定額1'] || sheetRow['査定額1（自動計算）v'];"""

count2 = text.count(old_comparison)
print(f"比較ロジック追加対象: {count2}件")

if count2 > 0:
    text = text.replace(old_comparison, new_comparison)
    print("✅ valuation_reason, valuation_methodの比較ロジックを追加")

with open('backend/src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n完了")

"""
修正2: detectUpdatedSellers に name（氏名）の変更検出を追加
- name は暗号化フィールドなのでDBと直接比較できない
- スプシに name がある場合は常に needsUpdate = true にする
  （氏名が変わっても検出できるようにするため）
- ただし、DBの name が null/空 の場合のみ強制更新（初回同期漏れ対応）
  → より安全な方法: スプシの name が空でない場合は常に更新対象
"""

with open('backend/src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# detectUpdatedSellers の select 文に name を追加
old = "        .select('seller_number, status, contract_year_month, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, next_call_date, unreachable_status, inquiry_date, comments, valuation_amount_1, valuation_amount_2, valuation_amount_3, first_call_person, valuation_reason, valuation_method, updated_at')"
new = "        .select('seller_number, status, contract_year_month, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, next_call_date, unreachable_status, inquiry_date, comments, valuation_amount_1, valuation_amount_2, valuation_amount_3, first_call_person, valuation_reason, valuation_method, name, updated_at')"

if old in text:
    text = text.replace(old, new)
    print("✅ select文に name を追加しました")
else:
    print("❌ select文が見つかりませんでした")

# valuation_method の比較の後に name の比較を追加
old = """          // 査定額の比較（手動入力優先、なければ自動計算）"""
new = """          // nameの比較（暗号化フィールドのため直接比較不可）
          // スプシに name がある場合、DBの name が null/空なら更新対象にする
          // （氏名未同期の案件を検出するため）
          const sheetName = sheetRow['名前(漢字のみ）'] || '';
          if (sheetName && sheetName.trim() !== '' && !dbSeller.name) {
            needsUpdate = true;
          }

          // 査定額の比較（手動入力優先、なければ自動計算）"""

if old in text:
    text = text.replace(old, new)
    print("✅ name の変更検出ロジックを追加しました")
else:
    print("❌ 査定額比較の前の文字列が見つかりませんでした")

with open('backend/src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print("完了")

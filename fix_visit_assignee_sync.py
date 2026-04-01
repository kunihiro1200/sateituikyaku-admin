# -*- coding: utf-8 -*-
with open('gas_complete_code.js', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 「外す」をnullに変換する処理を削除
# 変更前: (!rawVisitAssignee || rawVisitAssignee === '外す') ? null : String(rawVisitAssignee)
# 変更後: rawVisitAssignee ? String(rawVisitAssignee) : null

text = text.replace(
    "(!rawVisitAssignee || rawVisitAssignee === '外す') ? null : String(rawVisitAssignee)",
    "rawVisitAssignee ? String(rawVisitAssignee) : null"
)

# UTF-8で書き込む（BOMなし）
with open('gas_complete_code.js', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 修正完了: 営業担当「外す」をそのまま同期するように変更しました')

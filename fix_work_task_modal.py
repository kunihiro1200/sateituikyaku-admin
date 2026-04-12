with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# mediation_completed フィールドに type="date" を追加
old = '      <EditableField label="媒介作成完了" field="mediation_completed" />'
new = '      <EditableField label="媒介作成完了" field="mediation_completed" type="date" />'

if old not in text:
    print('ERROR: 対象文字列が見つかりません')
    exit(1)

text = text.replace(old, new, 1)

with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! WorkTaskDetailModal.tsx を修正しました')

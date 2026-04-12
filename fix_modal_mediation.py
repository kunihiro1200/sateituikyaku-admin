with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = '      <EditableField label="\u5a92\u4ecb\u4f5c\u6210\u5b8c\u4e86" field="mediation_completed" />'
new = '      <EditableField label="\u5a92\u4ecb\u4f5c\u6210\u5b8c\u4e86" field="mediation_completed" type="date" />'

if old not in text:
    print('ERROR: 対象文字列が見つかりません')
    # デバッグ用に周辺を表示
    idx = text.find('mediation_completed" />')
    if idx >= 0:
        print('Found at:', idx)
        print(repr(text[idx-60:idx+40]))
    exit(1)

text = text.replace(old, new, 1)

with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')

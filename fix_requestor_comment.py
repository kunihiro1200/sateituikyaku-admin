# サイト登録依頼コメントのデフォルト値バグ修正
# 1. requester の参照先を site_registration_requester に修正
# 2. デフォルト表示条件を「浅沼様で始まらない場合」に変更

with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: requester の参照先を site_registration_requester に修正
old1 = "      const requester = getValue('site_registration_requestor') || '';"
new1 = "      const requester = getValue('site_registration_requester') || '';"
text = text.replace(old1, new1)

# 修正2: デフォルト表示条件を変更
# 「R」などの短い値が入っている場合もデフォルト定型文を表示する
# 「浅沼様」で始まる文字列が入っている場合のみ既存値を使う
old2 = "            value={getValue('site_registration_requestor') || generateDefaultRequestorComment()}"
new2 = "            value={(() => { const v = getValue('site_registration_requestor'); return (v && String(v).startsWith('浅沼様')) ? v : generateDefaultRequestorComment(); })()}"
text = text.replace(old2, new2)

with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
print('修正1:', '適用済み' if new1 in text else '失敗')
print('修正2:', '適用済み' if 'startsWith' in text else '失敗')

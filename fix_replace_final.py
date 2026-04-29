# encoding: utf-8
with open('backend/src/routes/sellers.ts', 'rb') as f:
    text = f.read().decode('utf-8')

# 壊れた置換ブロックを探して削除
start_marker = '\n    // AIが勝手に市名に町名を付け足した場合を強制修正'
end_marker = '\n    // 印刷時に背景色'

start_idx = text.find(start_marker)
end_idx = text.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print('markers not found')
    print('start:', start_idx, 'end:', end_idx)
else:
    # 置換ブロックを削除（印刷CSSの前まで）
    new_text = text[:start_idx] + '\n    // 印刷時に背景色' + text[end_idx + len('\n    // 印刷時に背景色'):]
    with open('backend/src/routes/sellers.ts', 'wb') as f:
        f.write(new_text.encode('utf-8'))
    print('Done! Removed broken replace block.')

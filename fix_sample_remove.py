# encoding: utf-8
with open('backend/src/routes/sellers.ts', 'rb') as f:
    text = f.read().decode('utf-8')

# HTMLが混入している開始位置を探す
start_marker = '/**\n * エリア情勢レポートを生成（AI使用）\n'
bad_start = start_marker + '<div'

# 終了マーカー
end_marker = '</div>`;\n}'

start_idx = text.find(bad_start)
if start_idx == -1:
    print('bad_start not found, checking...')
    idx = text.find('エリア情勢レポートを生成')
    print(repr(text[idx-5:idx+100]))
else:
    # end_markerを探す（start_idxより後）
    end_idx = text.find(end_marker, start_idx)
    if end_idx == -1:
        print('end_marker not found')
        idx2 = text.find('概算値です。実際の取引価格')
        print(repr(text[idx2:idx2+50]))
    else:
        end_idx += len(end_marker)
        new_text = text[:start_idx] + start_marker + text[end_idx:]
        with open('backend/src/routes/sellers.ts', 'wb') as f:
            f.write(new_text.encode('utf-8'))
        print('Done! Removed sample HTML.')

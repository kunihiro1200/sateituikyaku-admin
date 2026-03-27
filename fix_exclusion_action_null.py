# exclusionAction が null の場合はリクエストに含めないよう修正
# DBに exclusion_action カラムが存在しない間のエラー回避

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# exclusionAction: exclusionAction || null, を
# ...(exclusionAction ? { exclusionAction } : {}), に変更
old = '        exclusionAction: exclusionAction || null,'
new = '        ...(exclusionAction ? { exclusionAction } : {}),'

if old in text:
    text = text.replace(old, new)
    with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('Done! exclusionAction null guard applied.')
else:
    print('ERROR: target string not found')
    # 周辺を確認
    idx = text.find('exclusionAction: exclusionAction')
    if idx >= 0:
        print('Found at:', idx)
        print(repr(text[idx-5:idx+60]))
    else:
        print('exclusionAction not found at all')

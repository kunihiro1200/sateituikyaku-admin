# 確度のonSaveからsetStatusChanged(true)を削除
# 確度は即時保存なのでステータスボタンと切り離す

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = '''                    onSave={async (newValue) => {
                      await api.put(`/api/sellers/${id}`, {
                        confidence: newValue,
                      });
                      // ローカル状態を更新
                      setSeller(prev => prev ? { ...prev, confidence: newValue } : prev);
                      setEditedConfidence(newValue as ConfidenceLevel);
                      setStatusChanged(true);
                    }}'''

new = '''                    onSave={async (newValue) => {
                      await api.put(`/api/sellers/${id}`, {
                        confidence: newValue,
                      });
                      // ローカル状態を更新
                      setSeller(prev => prev ? { ...prev, confidence: newValue } : prev);
                      setEditedConfidence(newValue as ConfidenceLevel);
                      // 確度は即時保存のためstatusChangedは変更しない
                    }}'''

if old in text:
    text = text.replace(old, new)
    with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('Done!')
else:
    print('ERROR: target not found')
    idx = text.find('setStatusChanged(true)')
    print(f'setStatusChanged occurrences: {text.count("setStatusChanged(true)")}')

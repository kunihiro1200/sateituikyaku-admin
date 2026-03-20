with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. editableComments と savingComments のstate追加
old_state = '''  // 通話メモ入力欄の状態
  const [callMemo, setCallMemo] = useState<string>('');
  const [savingMemo, setSavingMemo] = useState(false);'''

new_state = '''  // 通話メモ入力欄の状態
  const [callMemo, setCallMemo] = useState<string>('');
  const [savingMemo, setSavingMemo] = useState(false);

  // コメント直接編集の状態
  const [editableComments, setEditableComments] = useState<string>('');
  const [savingComments, setSavingComments] = useState(false);'''

if old_state in text:
    text = text.replace(old_state, new_state)
    print('✅ state追加完了')
else:
    print('❌ state追加対象が見つかりませんでした')

# 2. handleSaveComments関数をhandleSaveCallMemoの直前に追加
old_handler_start = '''  // 通話メモの保存処理
  const handleSaveCallMemo = async () => {'''

new_handler_start = '''  // コメント直接編集の保存処理
  const handleSaveComments = async () => {
    try {
      setSavingComments(true);
      setError(null);

      await api.put(`/api/sellers/${id}`, {
        comments: editableComments,
      });

      setSuccessMessage('コメントを保存しました');
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err: any) {
      console.error('コメント保存エラー:', err);
      setError('コメントの保存に失敗しました');
    } finally {
      setSavingComments(false);
    }
  };

  // 通話メモの保存処理
  const handleSaveCallMemo = async () => {'''

if old_handler_start in text:
    text = text.replace(old_handler_start, new_handler_start)
    print('✅ handleSaveComments追加完了')
else:
    print('❌ handleSaveCallMemo対象が見つかりませんでした')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')

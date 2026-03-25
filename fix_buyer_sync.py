import re

# BuyerDetailPage.tsx の修正
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# handleInlineFieldSave の sync: false を sync: true に変更し、
# syncStatus の確認を追加する
old_inline = '''  const handleInlineFieldSave = async (fieldName: string, newValue: any) => {
    if (!buyer) return;

    try {
      // 日付フィールドの空文字は null に変換（timestamp エラー防止）
      const DATE_FIELDS = ['next_call_date', 'reception_date', 'visit_date', 'contract_date'];
      const sanitizedValue = DATE_FIELDS.includes(fieldName) && newValue === '' ? null : newValue;

      // UIは呼び出し元で楽観的更新済み。DBのみ保存（スプシ同期は保存ボタン押下時）
      await buyerApi.update(
        buyer_number!,
        { [fieldName]: sanitizedValue },
        { sync: false }
      );

      return { success: true };
    } catch (error: any) {
      console.error('Failed to update field:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || '更新に失敗しました' 
      };
    }
  };'''

new_inline = '''  const handleInlineFieldSave = async (fieldName: string, newValue: any) => {
    if (!buyer) return;

    try {
      // 日付フィールドの空文字は null に変換（timestamp エラー防止）
      const DATE_FIELDS = ['next_call_date', 'reception_date', 'visit_date', 'contract_date'];
      const sanitizedValue = DATE_FIELDS.includes(fieldName) && newValue === '' ? null : newValue;

      // DBへの保存と同時にスプシへの同期も実行
      const result = await buyerApi.update(
        buyer_number!,
        { [fieldName]: sanitizedValue },
        { sync: true }
      );

      // 同期失敗の通知（DBへの保存は成功）
      if (result?.syncStatus === 'pending' || result?.syncStatus === 'failed') {
        setSnackbar({
          open: true,
          message: 'DBへの保存は完了しましたが、スプレッドシートへの同期に失敗しました',
          severity: 'warning',
        });
      }

      return { success: true };
    } catch (error: any) {
      console.error('Failed to update field:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || '更新に失敗しました' 
      };
    }
  };'''

if old_inline in text:
    text = text.replace(old_inline, new_inline)
    print('✅ handleInlineFieldSave を修正しました')
else:
    print('❌ handleInlineFieldSave の対象箇所が見つかりませんでした')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')

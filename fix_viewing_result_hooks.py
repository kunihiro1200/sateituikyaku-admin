import re

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# JSX内のuseCallbackを全てトップレベルのコールバックに置き換える
# 各フィールド用のコールバックをトップレベルで定義し、JSXでは参照するだけにする

# 1. handleInlineFieldSave の useCallback 定義の後に、各フィールド用コールバックを追加
# まず既存のuseCallback定義を見つける
old_callback_def = """  const handleInlineFieldSave = useCallback(async (fieldName: string, newValue: any): Promise<void> => {
    if (!buyerRef.current) return;

    try {
      console.log(`[BuyerViewingResultPage] Saving field: ${fieldName}, value:`, newValue);
      
      // sync: false にして高速化（スプレッドシート同期は自動同期サービスに任せる）
      const result = await buyerApi.update(
        buyer_number!,
        { [fieldName]: newValue },
        { sync: false }
      );
      
      console.log(`[BuyerViewingResultPage] Save result for ${fieldName}:`, result.buyer[fieldName]);
      
      buyerRef.current = result.buyer;
      setBuyer(result.buyer);
    } catch (error: any) {
      console.error('Failed to update field:', error);
      throw new Error(error.response?.data?.error || '更新に失敗しました');
    }
  }, [buyer_number]);"""

new_callback_def = """  const handleInlineFieldSave = useCallback(async (fieldName: string, newValue: any): Promise<void> => {
    if (!buyerRef.current) return;

    try {
      console.log(`[BuyerViewingResultPage] Saving field: ${fieldName}, value:`, newValue);
      
      // sync: false にして高速化（スプレッドシート同期は自動同期サービスに任せる）
      const result = await buyerApi.update(
        buyer_number!,
        { [fieldName]: newValue },
        { sync: false }
      );
      
      console.log(`[BuyerViewingResultPage] Save result for ${fieldName}:`, result.buyer[fieldName]);
      
      buyerRef.current = result.buyer;
      setBuyer(result.buyer);
    } catch (error: any) {
      console.error('Failed to update field:', error);
      throw new Error(error.response?.data?.error || '更新に失敗しました');
    }
  }, [buyer_number]);

  // JSX内でuseCallbackを使えないため、各フィールド用コールバックをトップレベルで定義
  const handleSaveLatestViewingDate = useCallback(
    (newValue: any) => {
      console.log('[BuyerViewingResultPage] InlineEditableField onSave called with:', newValue);
      return handleInlineFieldSave('latest_viewing_date', newValue);
    },
    [handleInlineFieldSave]
  );

  const handleSaveViewingTime = useCallback(
    (newValue: any) => handleInlineFieldSave('viewing_time', newValue),
    [handleInlineFieldSave]
  );

  const handleSaveViewingResultFollowUp = useCallback(
    (newValue: any) => handleInlineFieldSave('viewing_result_follow_up', newValue),
    [handleInlineFieldSave]
  );

  const handleSaveLatestStatus = useCallback(
    (newValue: any) => handleInlineFieldSave('latest_status', newValue),
    [handleInlineFieldSave]
  );

  const handleSaveOfferComment = useCallback(
    (newValue: any) => handleInlineFieldSave('offer_comment', newValue),
    [handleInlineFieldSave]
  );"""

content = content.replace(old_callback_def, new_callback_def)

# 2. JSX内のuseCallbackを対応するコールバック参照に置き換える

# latest_viewing_date
content = content.replace(
    """                onSave={useCallback((newValue: any) => {
                  console.log('[BuyerViewingResultPage] InlineEditableField onSave called with:', newValue);
                  return handleInlineFieldSave('latest_viewing_date', newValue);
                }, [handleInlineFieldSave])}""",
    "                onSave={handleSaveLatestViewingDate}"
)

# viewing_time
content = content.replace(
    "                onSave={useCallback((newValue: any) => handleInlineFieldSave('viewing_time', newValue), [handleInlineFieldSave])}",
    "                onSave={handleSaveViewingTime}"
)

# viewing_result_follow_up
content = content.replace(
    "              onSave={useCallback((newValue: any) => handleInlineFieldSave('viewing_result_follow_up', newValue), [handleInlineFieldSave])}",
    "              onSave={handleSaveViewingResultFollowUp}"
)

# latest_status
content = content.replace(
    "                  onSave={useCallback((newValue: any) => handleInlineFieldSave('latest_status', newValue), [handleInlineFieldSave])}",
    "                  onSave={handleSaveLatestStatus}"
)

# offer_comment (2箇所)
content = content.replace(
    "                    onSave={useCallback((newValue: any) => handleInlineFieldSave('offer_comment', newValue), [handleInlineFieldSave])}",
    "                    onSave={handleSaveOfferComment}"
)

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done!')

# 確認
remaining = content.count('onSave={useCallback')
print(f'Remaining onSave={{useCallback}}: {remaining}')

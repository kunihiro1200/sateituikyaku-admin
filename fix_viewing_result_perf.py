"""
BuyerViewingResultPage の編集レスポンス改善
- handleInlineFieldSave の useCallback 依存配列から buyer を除去（useRef で参照）
- onSave プロップを useCallback でメモ化して InlineEditableField の再マウントを防止
- useRef の import を追加
"""
import re

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. useRef を import に追加
text = text.replace(
    "import { useState, useEffect, useCallback } from 'react';",
    "import { useState, useEffect, useCallback, useRef } from 'react';"
)

# 2. buyer state 宣言の直後に buyerRef を追加
text = text.replace(
    "  const [buyer, setBuyer] = useState<Buyer | null>(null);",
    "  const [buyer, setBuyer] = useState<Buyer | null>(null);\n  const buyerRef = useRef<Buyer | null>(null); // handleInlineFieldSave から buyer を参照するための ref"
)

# 3. setBuyer を呼ぶ箇所で buyerRef も更新するヘルパー関数を追加
# fetchBuyer の setBuyer(res.data) の直前に buyerRef 更新を追加
text = text.replace(
    "      setBuyer(res.data);\n    } catch (error) {\n      console.error('Failed to fetch buyer:', error);",
    "      buyerRef.current = res.data;\n      setBuyer(res.data);\n    } catch (error) {\n      console.error('Failed to fetch buyer:', error);"
)

# 4. handleInlineFieldSave 内の setBuyer(result.buyer) の直前に buyerRef 更新を追加
text = text.replace(
    "      console.log(`[BuyerViewingResultPage] Save result for ${fieldName}:`, result.buyer[fieldName]);\n      \n      setBuyer(result.buyer);",
    "      console.log(`[BuyerViewingResultPage] Save result for ${fieldName}:`, result.buyer[fieldName]);\n      \n      buyerRef.current = result.buyer;\n      setBuyer(result.buyer);"
)

# 5. handleInlineFieldSave の useCallback を buyer → buyerRef.current に変更し、依存配列から buyer を除去
text = text.replace(
    """  const handleInlineFieldSave = useCallback(async (fieldName: string, newValue: any): Promise<void> => {
    if (!buyer) return;

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
  }, [buyer, buyer_number]);""",
    """  const handleInlineFieldSave = useCallback(async (fieldName: string, newValue: any): Promise<void> => {
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
)

# 6. InlineEditableField の onSave インライン関数をメモ化した関数に置き換え
# 内覧日
text = text.replace(
    """                onSave={(newValue) => {
                  console.log('[BuyerViewingResultPage] InlineEditableField onSave called with:', newValue);
                  return handleInlineFieldSave('latest_viewing_date', newValue);
                }}
                fieldType="date\"""",
    """                onSave={useCallback((newValue: any) => {
                  console.log('[BuyerViewingResultPage] InlineEditableField onSave called with:', newValue);
                  return handleInlineFieldSave('latest_viewing_date', newValue);
                }, [handleInlineFieldSave])}
                fieldType="date\""""
)

# 時間
text = text.replace(
    'onSave={(newValue) => handleInlineFieldSave(\'viewing_time\', newValue)}\n                fieldType="time"',
    'onSave={useCallback((newValue: any) => handleInlineFieldSave(\'viewing_time\', newValue), [handleInlineFieldSave])}\n                fieldType="time"'
)

# viewing_result_follow_up
text = text.replace(
    'onSave={(newValue) => handleInlineFieldSave(\'viewing_result_follow_up\', newValue)}\n              fieldType="textarea"',
    'onSave={useCallback((newValue: any) => handleInlineFieldSave(\'viewing_result_follow_up\', newValue), [handleInlineFieldSave])}\n              fieldType="textarea"'
)

# latest_status
text = text.replace(
    'onSave={(newValue) => handleInlineFieldSave(\'latest_status\', newValue)}\n                  fieldType="dropdown"',
    'onSave={useCallback((newValue: any) => handleInlineFieldSave(\'latest_status\', newValue), [handleInlineFieldSave])}\n                  fieldType="dropdown"'
)

# offer_comment (2箇所)
count = 0
def replace_offer_comment(m):
    global count
    count += 1
    return 'onSave={useCallback((newValue: any) => handleInlineFieldSave(\'offer_comment\', newValue), [handleInlineFieldSave])}\n                    fieldType="textarea"'

text = re.sub(
    r"onSave=\{.*?handleInlineFieldSave\('offer_comment', newValue\)\}\n                    fieldType=\"textarea\"",
    replace_offer_comment,
    text
)

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'Done! offer_comment replacements: {count}')

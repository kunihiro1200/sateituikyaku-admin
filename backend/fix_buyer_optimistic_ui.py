#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerViewingResultPage.tsx の handleInlineFieldSave を Optimistic UI に変更する
- クリック時に即座にUIを更新（setBuyer を先に呼ぶ）
- API失敗時に元の値に戻す
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_func = """  const handleInlineFieldSave = useCallback(async (fieldName: string, newValue: any): Promise<void> => {
    if (!buyerRef.current) return;

    try {
      console.log(`[BuyerViewingResultPage] Saving field: ${fieldName}, value:`, newValue);
      
      // 内覧関連フィールドとlatest_statusはsync: trueでスプレッドシートに即時同期する
      const SYNC_FIELDS = [
        'latest_status',
        'viewing_date',
        'viewing_time',
        'follow_up_assignee',
        'viewing_unconfirmed',
        'viewing_result_follow_up',
        'pre_viewing_notes',
        'viewing_notes',
        'pre_viewing_hearing',
        'seller_viewing_contact',
        'buyer_viewing_contact',
        'notification_sender',
        'inquiry_hearing',
        'post_viewing_seller_contact',
        'viewing_mobile',
        'viewing_type_general',
        'offer_comment',
        'build_year',
        'renovation_history',
        'other_valuation_done',
        'owner_name',
        'loan_balance',
        'visit_desk',
        'seller_list_copy',
      ];
      const shouldSync = SYNC_FIELDS.includes(fieldName);
      const result = await buyerApi.update(
        buyer_number!,
        { [fieldName]: newValue },
        { sync: shouldSync, force: shouldSync }
      );
      
      console.log(`[BuyerViewingResultPage] Save result for ${fieldName}:`, result.buyer[fieldName]);
      
      buyerRef.current = result.buyer;
      setBuyer(result.buyer);
    } catch (error: any) {
      console.error('Failed to update field:', error);
      throw new Error(error.response?.data?.error || '更新に失敗しました');
    }
  }, [buyer_number]);"""

new_func = """  const handleInlineFieldSave = useCallback(async (fieldName: string, newValue: any): Promise<void> => {
    if (!buyerRef.current) return;

    // Optimistic UI: APIを待たずに即座にUIを更新する
    const previousBuyer = buyerRef.current;
    const optimisticBuyer = { ...buyerRef.current, [fieldName]: newValue };
    buyerRef.current = optimisticBuyer;
    setBuyer(optimisticBuyer);

    try {
      console.log(`[BuyerViewingResultPage] Saving field: ${fieldName}, value:`, newValue);
      
      // 内覧関連フィールドとlatest_statusはsync: trueでスプレッドシートに即時同期する
      const SYNC_FIELDS = [
        'latest_status',
        'viewing_date',
        'viewing_time',
        'follow_up_assignee',
        'viewing_unconfirmed',
        'viewing_result_follow_up',
        'pre_viewing_notes',
        'viewing_notes',
        'pre_viewing_hearing',
        'seller_viewing_contact',
        'buyer_viewing_contact',
        'notification_sender',
        'inquiry_hearing',
        'post_viewing_seller_contact',
        'viewing_mobile',
        'viewing_type_general',
        'offer_comment',
        'build_year',
        'renovation_history',
        'other_valuation_done',
        'owner_name',
        'loan_balance',
        'visit_desk',
        'seller_list_copy',
      ];
      const shouldSync = SYNC_FIELDS.includes(fieldName);
      const result = await buyerApi.update(
        buyer_number!,
        { [fieldName]: newValue },
        { sync: shouldSync, force: shouldSync }
      );
      
      console.log(`[BuyerViewingResultPage] Save result for ${fieldName}:`, result.buyer[fieldName]);
      
      // API成功後はサーバーの値で確定する
      buyerRef.current = result.buyer;
      setBuyer(result.buyer);
    } catch (error: any) {
      // API失敗時は元の値に戻す（ロールバック）
      console.error('Failed to update field:', error);
      buyerRef.current = previousBuyer;
      setBuyer(previousBuyer);
      throw new Error(error.response?.data?.error || '更新に失敗しました');
    }
  }, [buyer_number]);"""

if old_func in text:
    text = text.replace(old_func, new_func)
    print('✓ handleInlineFieldSave updated to Optimistic UI')
else:
    print('✗ Target function not found')

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')

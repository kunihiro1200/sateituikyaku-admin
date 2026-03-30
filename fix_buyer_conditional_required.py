# -*- coding: utf-8 -*-
"""
タスク2.1: isInitialAssigneeConditionallyRequired 関数を追加
タスク3.1: checkMissingFields の initial_assignee チェックを拡張
"""

import sys

FILE_PATH = 'frontend/frontend/src/pages/BuyerDetailPage.tsx'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# タスク2.1: isInitialAssigneeConditionallyRequired 関数を追加
# checkMissingFields 関数の直前に挿入する
# ============================================================

NEW_HELPER_FUNC = '''  // 初動担当の条件付き必須判定
  // AND([受付日]>="2026/3/30", OR([_THISROW_BEFORE].[inquiry_email_phone]<>[inquiry_email_phone], AND(ISNOTBLANK([inquiry_hearing]),[inquiry_hearing]<>[_THISROW_BEFORE].[inquiry_hearing])))
  const isInitialAssigneeConditionallyRequired = (
    currentBuyer: any,
    changedFields: Record<string, any>
  ): boolean => {
    if (!currentBuyer?.reception_date) return false;
    const receptionDate = new Date(currentBuyer.reception_date);
    if (receptionDate < new Date('2026-03-30')) return false;

    // inquiry_email_phone が変更されたか
    const emailPhoneChanged =
      'inquiry_email_phone' in changedFields &&
      changedFields.inquiry_email_phone !== initialInquiryEmailPhoneRef.current;

    // inquiry_hearing が変更されかつ空でないか
    const hearingNewValue = 'inquiry_hearing' in changedFields
      ? changedFields.inquiry_hearing
      : currentBuyer.inquiry_hearing;
    const hearingChanged =
      'inquiry_hearing' in changedFields &&
      changedFields.inquiry_hearing !== initialInquiryHearingRef.current;
    const hearingFilledAndChanged =
      hearingChanged && hearingNewValue && String(hearingNewValue).trim().length > 0;

    return emailPhoneChanged || Boolean(hearingFilledAndChanged);
  };

  // 未入力の必須項目の表示名リストを返す（空配列 = 全て入力済み）
'''

OLD_CHECK_MISSING_HEADER = '  // 未入力の必須項目の表示名リストを返す（空配列 = 全て入力済み）\n'

if NEW_HELPER_FUNC in text:
    print('isInitialAssigneeConditionallyRequired は既に追加済みです。スキップします。')
elif OLD_CHECK_MISSING_HEADER in text:
    text = text.replace(OLD_CHECK_MISSING_HEADER, NEW_HELPER_FUNC, 1)
    print('isInitialAssigneeConditionallyRequired 関数を追加しました。')
else:
    print('ERROR: checkMissingFields のヘッダーコメントが見つかりません。', file=sys.stderr)
    sys.exit(1)

# ============================================================
# タスク3.1: checkMissingFields の initial_assignee チェックを拡張
# 既存の「常に必須」ブロックを、条件付き必須も含む統合ブロックに置換する
# ============================================================

OLD_INITIAL_ASSIGNEE_CHECK = '''    // 常に必須
    if (!buyer.initial_assignee || !String(buyer.initial_assignee).trim()) {
      missingKeys.push('initial_assignee');
    }'''

NEW_INITIAL_ASSIGNEE_CHECK = '''    // 初動担当：常時必須 OR 条件付き必須（重複追加なし）
    const allChangedFields = Object.values(sectionChangedFields)
      .reduce((acc: Record<string, any>, fields) => ({ ...acc, ...fields }), {});
    const conditionallyRequired = isInitialAssigneeConditionallyRequired(buyer, allChangedFields);
    if (!buyer.initial_assignee || !String(buyer.initial_assignee).trim() || conditionallyRequired) {
      missingKeys.push('initial_assignee');
    }'''

if NEW_INITIAL_ASSIGNEE_CHECK in text:
    print('checkMissingFields の initial_assignee チェックは既に拡張済みです。スキップします。')
elif OLD_INITIAL_ASSIGNEE_CHECK in text:
    text = text.replace(OLD_INITIAL_ASSIGNEE_CHECK, NEW_INITIAL_ASSIGNEE_CHECK, 1)
    print('checkMissingFields の initial_assignee チェックを拡張しました。')
else:
    print('ERROR: 既存の initial_assignee チェックブロックが見つかりません。', file=sys.stderr)
    sys.exit(1)

# ============================================================
# UTF-8 で書き戻す
# ============================================================
with open(FILE_PATH, 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了: BuyerDetailPage.tsx を UTF-8 で書き戻しました。')

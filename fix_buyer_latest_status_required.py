"""
BuyerDetailPage.tsx の latest_status 必須チェック条件バグを修正する。

修正箇所:
1. checkMissingFields 内の latest_status チェック
2. fetchBuyer 内の initialMissing の latest_status チェック

正しい必須条件:
  AND(
    OR(
      AND(inquiry_hearingが空欄でない, inquiry_sourceに"電話"を含む),
      inquiry_email_phoneが"済"
    ),
    reception_dateが2026-02-08以降,
    broker_inquiryが空欄
  )
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ===== 修正1: checkMissingFields 内の latest_status チェック =====
# isLatestStatusRequired ヘルパーを checkMissingFields の直前に追加し、
# 既存の単純チェックを条件付きチェックに置き換える

OLD_CHECK_MISSING = '''  // 未入力の必須項目の表示名リストを返す（空配列 = 全て入力済み）
  const checkMissingFields = (): string[] => {
    if (!buyer) return [];

    const missingKeys: string[] = [];

    // 常に必須
    if (!buyer.initial_assignee || !String(buyer.initial_assignee).trim()) {
      missingKeys.push('initial_assignee');
    }
    // broker_inquiryが「業者問合せ」の場合はinquiry_sourceを必須としない
    if (buyer.broker_inquiry !== '業者問合せ' && (!buyer.inquiry_source || !String(buyer.inquiry_source).trim())) {
      missingKeys.push('inquiry_source');
    }
    if (!buyer.latest_status || !String(buyer.latest_status).trim()) {
      missingKeys.push('latest_status');
    }'''

NEW_CHECK_MISSING = '''  // latest_status が必須かどうかを判定するヘルパー
  // 正しい必須条件: 条件A AND 条件B AND 条件C
  //   条件A: (inquiry_hearingが空欄でない AND inquiry_sourceに「電話」を含む) OR inquiry_email_phoneが「済」
  //   条件B: reception_date が 2026-02-08 以降
  //   条件C: broker_inquiry が空欄
  const isLatestStatusRequired = (data: any): boolean => {
    // 条件C: broker_inquiry が空欄でなければ必須でない
    if (data.broker_inquiry && String(data.broker_inquiry).trim()) return false;
    // 条件B: reception_date が 2026-02-08 以降でなければ必須でない
    if (!data.reception_date) return false;
    const receptionDate = new Date(data.reception_date);
    if (receptionDate < new Date('2026-02-08')) return false;
    // 条件A: (inquiry_hearingが空欄でない AND inquiry_sourceに「電話」を含む) OR inquiry_email_phoneが「済」
    const hearingFilled = data.inquiry_hearing && String(data.inquiry_hearing).trim();
    const hasPhone = data.inquiry_source && String(data.inquiry_source).includes('電話');
    const emailPhoneDone = data.inquiry_email_phone && String(data.inquiry_email_phone) === '済';
    if (!((hearingFilled && hasPhone) || emailPhoneDone)) return false;
    return true;
  };

  // 未入力の必須項目の表示名リストを返す（空配列 = 全て入力済み）
  const checkMissingFields = (): string[] => {
    if (!buyer) return [];

    const missingKeys: string[] = [];

    // 常に必須
    if (!buyer.initial_assignee || !String(buyer.initial_assignee).trim()) {
      missingKeys.push('initial_assignee');
    }
    // broker_inquiryが「業者問合せ」の場合はinquiry_sourceを必須としない
    if (buyer.broker_inquiry !== '業者問合せ' && (!buyer.inquiry_source || !String(buyer.inquiry_source).trim())) {
      missingKeys.push('inquiry_source');
    }
    // 正しい必須条件を満たす場合のみ latest_status を必須扱いする
    if (isLatestStatusRequired(buyer) && (!buyer.latest_status || !String(buyer.latest_status).trim())) {
      missingKeys.push('latest_status');
    }'''

if OLD_CHECK_MISSING in text:
    text = text.replace(OLD_CHECK_MISSING, NEW_CHECK_MISSING)
    print('修正1 (checkMissingFields) 完了')
else:
    print('ERROR: 修正1のターゲットが見つかりません')

# ===== 修正2: fetchBuyer 内の initialMissing の latest_status チェック =====
OLD_INITIAL_MISSING = '''      if (!res.data.latest_status || !String(res.data.latest_status).trim()) {
        initialMissing.push('latest_status');
      }'''

NEW_INITIAL_MISSING = '''      // 正しい必須条件を満たす場合のみ latest_status を必須扱いする
      if (isLatestStatusRequired(res.data) && (!res.data.latest_status || !String(res.data.latest_status).trim())) {
        initialMissing.push('latest_status');
      }'''

if OLD_INITIAL_MISSING in text:
    text = text.replace(OLD_INITIAL_MISSING, NEW_INITIAL_MISSING)
    print('修正2 (initialMissing) 完了')
else:
    print('ERROR: 修正2のターゲットが見つかりません')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了: BuyerDetailPage.tsx を UTF-8 で保存しました')

# BOMチェック
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    head = f.read(3)
print('BOM check:', repr(head[:3]))

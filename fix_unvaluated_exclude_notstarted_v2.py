"""
修正: isUnvaluated から isTodayCallNotStarted 対象を除外
- isTodayCallNotStarted は isUnvaluated より後に定義されているため、
  関数呼び出しではなく条件をインライン展開する
- 未着手の追加条件: 不通が空 + 反響日付が2026/1/1以降 + 確度がダブり/D/AI査定でない
  → これらを満たす場合は未査定から除外
"""

with open('frontend/frontend/src/utils/sellerStatusFilters.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# isTodayCallNotStarted 呼び出しをインライン条件に置き換え
old = """  // 当日TEL_未着手の条件を満たす場合は未査定から除外（未着手が優先）
  if (isTodayCallNotStarted(seller)) {
    return false;
  }

  return normalizedInquiryDate >= CUTOFF_DATE_STR;"""

new = """  // 当日TEL_未着手の条件を満たす場合は未査定から除外（未着手が優先）
  // ※ isTodayCallNotStarted は後方で定義されるため、条件をインライン展開
  // 未着手の追加条件: 不通が空 + 反響日付が2026/1/1以降 + 確度がダブり/D/AI査定でない
  const NOTSTARTED_CUTOFF = '2026-01-01';
  const unreachableForCheck = seller.unreachableStatus || seller.unreachable_status || '';
  const confidenceForCheck = seller.confidence || seller.confidenceLevel || seller.confidence_level || '';
  const exclusionDateForCheck = seller.exclusionDate || seller.exclusion_date || '';
  const isNotStarted = isTodayCallBase(seller) &&
    !hasContactInfo(seller) &&
    !hasVisitAssignee(seller) &&
    (seller.status || '') === '追客中' &&
    (!unreachableForCheck || unreachableForCheck.trim() === '') &&
    confidenceForCheck !== 'ダブり' && confidenceForCheck !== 'D' && confidenceForCheck !== 'AI査定' &&
    (!exclusionDateForCheck || exclusionDateForCheck.trim() === '') &&
    normalizedInquiryDate >= NOTSTARTED_CUTOFF;
  if (isNotStarted) {
    return false;
  }

  return normalizedInquiryDate >= CUTOFF_DATE_STR;"""

if old in text:
    text = text.replace(old, new)
    print("✅ isUnvaluated に未着手除外ロジック（インライン展開）を追加しました")
else:
    print("❌ 対象の文字列が見つかりませんでした")

with open('frontend/frontend/src/utils/sellerStatusFilters.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print("完了")

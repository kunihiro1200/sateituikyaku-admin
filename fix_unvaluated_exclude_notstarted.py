"""
修正1: isUnvaluated から isTodayCallNotStarted 対象を除外
- 未着手（⑦当日TEL_未着手）の条件を満たす案件は未査定（⑤未査定）に含めない
"""

with open('frontend/frontend/src/utils/sellerStatusFilters.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# isUnvaluated の最後の return 文の前に未着手チェックを追加
old = """  return normalizedInquiryDate >= CUTOFF_DATE_STR;
};

/**
 * 査定（郵送）判定"""

new = """  // 当日TEL_未着手の条件を満たす場合は未査定から除外（未着手が優先）
  if (isTodayCallNotStarted(seller)) {
    return false;
  }

  return normalizedInquiryDate >= CUTOFF_DATE_STR;
};

/**
 * 査定（郵送）判定"""

if old in text:
    text = text.replace(old, new)
    print("✅ isUnvaluated に未着手除外ロジックを追加しました")
else:
    print("❌ 対象の文字列が見つかりませんでした")

with open('frontend/frontend/src/utils/sellerStatusFilters.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print("完了")

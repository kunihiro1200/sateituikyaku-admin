# GAS syncSellerList関数の更新手順

## 概要

`syncSellerList`関数に3つの新しいカテゴリー（専任、一般、訪問後他決）のカウント計算ロジックを追加します。

## 追加するカテゴリー

1. **専任カテゴリー** (`exclusive`)
   - 条件: `exclusive_other_decision_meeting <> "完了"` AND `next_call_date <> TODAY()` AND `status IN ("専任媒介", "他決→専任", "リースバック（専任）")`

2. **一般カテゴリー** (`general`)
   - 条件: `exclusive_other_decision_meeting <> "完了"` AND `next_call_date <> TODAY()` AND `status = "一般媒介"` AND `contract_year_month >= "2025/6/23"`

3. **訪問後他決カテゴリー** (`visitOtherDecision`)
   - 条件: `exclusive_other_decision_meeting <> "完了"` AND `next_call_date <> TODAY()` AND `status IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取")` AND `visit_assignee <> ""`

## 実装例（JavaScript/GAS）

```javascript
// 今日の日付を取得（YYYY-MM-DD形式）
const today = new Date();
const todayStr = Utilities.formatDate(today, 'Asia/Tokyo', 'yyyy-MM-dd');

// 専任カテゴリーのカウント
let exclusiveCount = 0;
for (let i = 0; i < sellers.length; i++) {
  const seller = sellers[i];
  const exclusiveOtherDecisionMeeting = seller['専任他決打合せ'] || '';
  const nextCallDate = seller['次電日'] || '';
  const status = seller['状況（当社）'] || '';
  
  if (exclusiveOtherDecisionMeeting !== '完了' &&
      nextCallDate !== todayStr &&
      (status === '専任媒介' || status === '他決→専任' || status === 'リースバック（専任）')) {
    exclusiveCount++;
  }
}

// 一般カテゴリーのカウント
let generalCount = 0;
for (let i = 0; i < sellers.length; i++) {
  const seller = sellers[i];
  const exclusiveOtherDecisionMeeting = seller['専任他決打合せ'] || '';
  const nextCallDate = seller['次電日'] || '';
  const status = seller['状況（当社）'] || '';
  const contractYearMonth = seller['契約年月 他決は分かった時点'] || '';
  
  if (exclusiveOtherDecisionMeeting !== '完了' &&
      nextCallDate !== todayStr &&
      status === '一般媒介' &&
      contractYearMonth >= '2025-06-23') {
    generalCount++;
  }
}

// 訪問後他決カテゴリーのカウント
let visitOtherDecisionCount = 0;
for (let i = 0; i < sellers.length; i++) {
  const seller = sellers[i];
  const exclusiveOtherDecisionMeeting = seller['専任他決打合せ'] || '';
  const nextCallDate = seller['次電日'] || '';
  const status = seller['状況（当社）'] || '';
  const visitAssignee = seller['営担'] || '';
  
  if (exclusiveOtherDecisionMeeting !== '完了' &&
      nextCallDate !== todayStr &&
      (status === '他決→追客' || status === '他決→追客不要' || status === '一般→他決' || status === '他社買取') &&
      visitAssignee !== '' && visitAssignee !== '外す') {
    visitOtherDecisionCount++;
  }
}

// seller_sidebar_countsテーブルに保存
const countsToSave = [
  // ... 既存のカテゴリー
  { category: 'exclusive', count: exclusiveCount, label: null, assignee: null },
  { category: 'general', count: generalCount, label: null, assignee: null },
  { category: 'visitOtherDecision', count: visitOtherDecisionCount, label: null, assignee: null },
];

// Supabase APIにPOSTリクエストを送信
// （既存のコードに追加）
```

## 注意事項

1. **日付比較**: `next_call_date <> TODAY()` は「次電日が今日ではない」という条件です。GASでは`nextCallDate !== todayStr`で実装します。

2. **営担の判定**: 「外す」は担当なしと同じ扱いです。`visitAssignee !== '' && visitAssignee !== '外す'`で判定します。

3. **契約年月の比較**: 日付文字列の比較は`>=`演算子で行います。`contractYearMonth >= '2025-06-23'`

4. **Supabase APIへの保存**: 既存の`seller_sidebar_counts`テーブルへの保存ロジックに3つの新しいカテゴリーを追加します。

## テスト

GASの更新後、以下を確認してください：

1. GASのトリガーが正常に実行されること
2. `seller_sidebar_counts`テーブルに3つの新しいカテゴリーのレコードが作成されること
3. カウント値が正しいこと（手動計算と比較）

## デプロイ

1. Google Apps Scriptエディタで`syncSellerList`関数を更新
2. 保存して、手動で一度実行してテスト
3. 10分トリガーが正常に動作することを確認

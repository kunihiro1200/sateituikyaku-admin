# バグ修正要件定義書

## Introduction

買主リストの「問合メール未対応」サイドバーカテゴリーにおいて、カウント表示（5件）とフィルタリング結果（0件）が一致しない問題を修正します。

この不一致は、ステータス計算ロジック（BuyerStatusCalculator.ts）とサイドバーカウント計算ロジック（BuyerService.ts）で異なるフィールドを参照していることが原因です。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN サイドバーカウント計算で `viewing_date` フィールドを使用して「問合メール未対応」の件数を計算する THEN カウントが5件と表示される

1.2 WHEN ステータス計算ロジックで `latest_viewing_date` フィールドを使用して「問合メール未対応」の判定を行う THEN フィルタリング結果が0件となる

1.3 WHEN ユーザーが「問合メール未対応: 5件」をクリックする THEN 「買主データみつかりません」と表示される

### Expected Behavior (Correct)

2.1 WHEN サイドバーカウント計算とステータス計算ロジックの両方で同じフィールド（`latest_viewing_date`）を使用する THEN カウント表示とフィルタリング結果が一致する

2.2 WHEN ユーザーが「問合メール未対応: 5件」をクリックする THEN 5件の買主データが正しく表示される

2.3 WHEN 「問合メール未対応」の条件判定を行う THEN 以下の条件で統一される
- 電話対応が "未" OR
- メール返信が "未" OR
- (内覧日（latest_viewing_date）が空欄 AND 電話対応が "不要" AND (メール返信が "未" OR メール返信が空欄))

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 他のサイドバーカテゴリー（「内覧日前日」「当日TEL」など）のカウント計算を行う THEN 既存の動作を維持する

3.2 WHEN ステータス計算ロジックの他の優先順位（Priority 1-4, 6-38）の判定を行う THEN 既存の動作を維持する

3.3 WHEN 「問合メール未対応」以外のフィルタリングを行う THEN 既存の動作を維持する

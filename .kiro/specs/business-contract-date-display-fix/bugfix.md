# バグ修正要件ドキュメント

## はじめに

業務詳細画面（WorkTaskDetailModal）の「媒介契約」タブにおいて、「媒介作成完了」フィールド（`mediation_completed`）の日付が正しく表示されないバグを修正する。

このフィールドはDATE型（例: `2026/4/11`）であるにもかかわらず、フロントエンドでは通常のテキストフィールドとして扱われており、DBから返されるISO 8601形式の文字列（例: `2026-04-11T00:00:00.000Z`）がそのまま表示されてしまっている。

また、業務一覧（WorkTaskSection）の「媒介契約」カテゴリでも同様に、`formatValue`関数の日付判定条件（`key.includes('date') || key.includes('deadline')`）が`mediation_completed`にマッチしないため、日付フォーマットが適用されず生の文字列が表示される。

---

## バグ分析

### 現在の動作（不具合）

1.1 WHEN 業務詳細画面の「媒介契約」タブを開き、`mediation_completed`フィールドに日付データが存在する THEN システムはISO 8601形式の生文字列（例: `2026-04-11T00:00:00.000Z`）をそのまま表示する

1.2 WHEN 業務詳細画面の「媒介契約」タブで`mediation_completed`フィールドを編集しようとする THEN システムはDATE型ピッカーではなく通常のテキスト入力フィールドを表示する

1.3 WHEN 業務一覧（WorkTaskSection）の「媒介契約」カテゴリで`mediation_completed`の値を表示する THEN システムはISO 8601形式の生文字列をそのまま表示する（`formatValue`の日付判定が`mediation_completed`にマッチしないため）

### 期待される動作（正しい動作）

2.1 WHEN 業務詳細画面の「媒介契約」タブを開き、`mediation_completed`フィールドに日付データが存在する THEN システムは日本語ロケールの日付形式（例: `2026/4/11`）で正しく表示する SHALL

2.2 WHEN 業務詳細画面の「媒介契約」タブで`mediation_completed`フィールドを編集しようとする THEN システムはDATE型ピッカー（`type="date"`）を表示する SHALL

2.3 WHEN 業務一覧（WorkTaskSection）の「媒介契約」カテゴリで`mediation_completed`の値を表示する THEN システムは日本語ロケールの日付形式（例: `2026/4/11`）で正しく表示する SHALL

### 変更しない動作（リグレッション防止）

3.1 WHEN `mediation_completed`フィールドが空欄またはnullの場合 THEN システムは引き続き `-` を表示する SHALL CONTINUE TO

3.2 WHEN `mediation_deadline`など既存の日付フィールドを表示・編集する THEN システムは引き続き正しい日付フォーマットで表示・編集できる SHALL CONTINUE TO

3.3 WHEN 「媒介契約」タブの他のフィールド（媒介形態、媒介作成者、媒介備考など）を操作する THEN システムは引き続き正常に動作する SHALL CONTINUE TO

3.4 WHEN `mediation_completed`フィールドに日付を入力して保存する THEN システムは引き続き正しくDBに保存できる SHALL CONTINUE TO

# バグ修正要件ドキュメント

## はじめに

売り主リストの通話モードページ（CallModePage）において、査定額メール送信テンプレートの本文に「土地<<土（㎡）>>㎡、建物<<建（㎡）>>㎡で算出しております」という文言がある。
この面積値の取得ロジックにバグがある。「土地面積（当社調べ）」（`landAreaVerified`）または「建物面積（当社調べ）」（`buildingAreaVerified`）フィールドに値が入力されている場合、それらを優先してメール本文に表示すべきだが、現状では「当社調べ」の値が存在しても通常の土地面積・建物面積（`landArea` / `buildingArea`）の値がそのまま使用されてしまっている。

**影響範囲**: `frontend/frontend/src/pages/CallModePage.tsx` の `handleShowValuationEmailConfirm` 関数

## バグ分析

### 現在の動作（不具合）

1.1 WHEN 「土地面積（当社調べ）」（`landAreaVerified`）フィールドに値が入力されている場合 THEN システムは `landAreaVerified` の値を無視し、通常の `landArea` の値をメール本文の面積表示に使用する

1.2 WHEN 「建物面積（当社調べ）」（`buildingAreaVerified`）フィールドに値が入力されている場合 THEN システムは `buildingAreaVerified` の値を無視し、通常の `buildingArea` の値をメール本文の面積表示に使用する

1.3 WHEN 「土地面積（当社調べ）」と「建物面積（当社調べ）」の両方に値が入力されている場合 THEN システムはどちらの「当社調べ」値も無視し、通常の `landArea` / `buildingArea` の値をメール本文に表示する

### 期待される動作（正しい動作）

2.1 WHEN 「土地面積（当社調べ）」（`landAreaVerified`）フィールドに値が入力されている場合 THEN システムは `landAreaVerified` の値を優先してメール本文の土地面積表示に使用する

2.2 WHEN 「建物面積（当社調べ）」（`buildingAreaVerified`）フィールドに値が入力されている場合 THEN システムは `buildingAreaVerified` の値を優先してメール本文の建物面積表示に使用する

2.3 WHEN 「土地面積（当社調べ）」フィールドに値がない場合 THEN システムは通常の `landArea` の値をメール本文の土地面積表示に使用する

2.4 WHEN 「建物面積（当社調べ）」フィールドに値がない場合 THEN システムは通常の `buildingArea` の値をメール本文の建物面積表示に使用する

### 変更しない動作（リグレッション防止）

3.1 WHEN 「土地面積（当社調べ）」「建物面積（当社調べ）」の両方に値がない場合 THEN システムは引き続き通常の `landArea` / `buildingArea` の値をメール本文に表示する

3.2 WHEN 通常の `landArea` / `buildingArea` フィールドのみに値がある場合 THEN システムは引き続きそれらの値を使ってメール本文の面積を正しく表示する

3.3 WHEN 査定額メール送信以外の通話モードページの操作（査定額計算、SMS送信、売主情報保存など）を行う場合 THEN システムは引き続き既存の動作を維持する

# Bugfix Requirements Document

## Introduction

`BuyerDesiredConditionsPage.tsx` の希望条件ページにおいて、配信メールが「要」の買主に対して希望条件（エリア・希望種別・価格帯）を正しく入力しているにもかかわらず、保存時にバリデーションエラーが発生して保存できないバグを修正する。

根本原因は `handleSaveAll` 関数内のバリデーションロジックにある。`pendingChanges` に複数フィールドの変更が蓄積されている場合、各フィールドを**個別に**バリデーションしているため、他の `pendingChanges` が考慮されない。例えば `desired_area` をチェックする際に `{ ...buyer, desired_area: '㊶別府' }` という仮想状態を作るが、同じ `pendingChanges` 内にある `price_range_land` は反映されないため、「価格帯（土地）がない」と誤判定される。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `pendingChanges` に複数フィールド（例: `desired_area`・`desired_property_type`・`price_range_land`）が含まれており、かつ配信メールが「要」の場合 THEN `handleSaveAll` は各フィールドを個別にバリデーションするため、他の `pendingChanges` が考慮されず、全フィールドが揃っているにもかかわらずエラーメッセージ「配信メールが「要」の場合、エリア・価格帯（土地）は必須です。希望条件を入力してください。」を表示して保存を中断する

1.2 WHEN `checkDistributionRequiredFields(fieldName, newValue)` が `{ ...buyer, [fieldName]: newValue }` という1フィールドのみを適用した仮想状態でバリデーションを行う場合 THEN 同じ `pendingChanges` 内の他フィールドの変更が無視され、必須フィールドが未入力と誤判定される

### Expected Behavior (Correct)

2.1 WHEN `pendingChanges` に複数フィールドが含まれており、かつ配信メールが「要」の場合 THEN `handleSaveAll` は `{ ...buyer, ...pendingChanges }` として全 `pendingChanges` を一括適用した仮想状態でバリデーションを行い、全必須フィールドが揃っていれば正常に保存を実行する

2.2 WHEN `handleSaveAll` のバリデーションが `pendingChanges` 全体を考慮した状態で必須チェックを行う場合 THEN エリア・希望種別・価格帯（希望種別に応じた種類）が全て入力済みであればエラーを表示せず保存処理を続行する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `pendingChanges` に1フィールドのみが含まれており、かつ配信メールが「要」で必須フィールドが未入力の場合 THEN システムは SHALL CONTINUE TO バリデーションエラーを表示して保存を中断する

3.2 WHEN 配信メールが「要」以外（例: 「不要」や未設定）の場合 THEN システムは SHALL CONTINUE TO バリデーションなしで保存処理を実行する

3.3 WHEN `InlineEditableField` から個別フィールドを直接保存する `handleInlineFieldSave` が呼ばれる場合 THEN システムは SHALL CONTINUE TO 既存の1フィールド単位のバリデーションロジック（`checkDistributionRequiredFields`）を使用して保存する

3.4 WHEN 配信メールが「要」で希望種別が「土地」かつ `price_range_land` が未入力の場合 THEN システムは SHALL CONTINUE TO 「価格帯（土地）は必須です」エラーを表示して保存を中断する

3.5 WHEN 配信メールが「要」で `desired_area` が未入力の場合 THEN システムは SHALL CONTINUE TO 「エリアは必須です」エラーを表示して保存を中断する

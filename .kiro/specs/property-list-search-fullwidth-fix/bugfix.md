# Bugfix Requirements Document

## Introduction

物件リスト（売主管理システムのフロントエンド）の検索バーにおいて、全角文字（例：「１２３」「ＡＢＣ」「アイウ」など）で入力しても検索がヒットしない問題を修正する。現在の実装では `toLowerCase()` のみが適用されており、全角→半角の正規化処理が行われていないため、全角文字での検索が機能しない。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが全角英数字（例：「ＡＡ１２３４５」「１２３」）を検索バーに入力する THEN the system 検索結果が0件になり、対応する物件がヒットしない

1.2 WHEN ユーザーが全角カタカナ（例：「アイウ」）を検索バーに入力する THEN the system 検索結果が0件になり、対応する物件がヒットしない

1.3 WHEN ユーザーが全角英字（例：「ＡＢＣ」）を検索バーに入力する THEN the system 検索結果が0件になり、半角で同じ文字列を入力した場合と異なる結果になる

### Expected Behavior (Correct)

2.1 WHEN ユーザーが全角英数字（例：「ＡＡ１２３４５」「１２３」）を検索バーに入力する THEN the system SHALL 対応する半角文字列（「AA12345」「123」）と同じ検索結果を返す

2.2 WHEN ユーザーが全角カタカナ（例：「アイウ」）を検索バーに入力する THEN the system SHALL 対応する半角カタカナ（「ｱｲｳ」）と同じ検索結果を返す

2.3 WHEN ユーザーが全角英字（例：「ＡＢＣ」）を検索バーに入力する THEN the system SHALL 半角英字（「ABC」）と同じ検索結果を返す

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが半角英数字（例：「AA12345」「123」）を検索バーに入力する THEN the system SHALL CONTINUE TO 物件番号・所在地・売主名・売主メール・買主名に対して正常に検索結果を返す

3.2 WHEN ユーザーが日本語（ひらがな・漢字）を検索バーに入力する THEN the system SHALL CONTINUE TO 所在地・売主名・買主名に対して正常に検索結果を返す

3.3 WHEN 検索クエリが空の場合 THEN the system SHALL CONTINUE TO 全件を表示する

3.4 WHEN サイドバーフィルターが選択されている状態で検索バーに入力する THEN the system SHALL CONTINUE TO サイドバーフィルターをクリアして検索結果を表示する

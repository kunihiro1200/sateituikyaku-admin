# Bugfix Requirements Document

## Introduction

買主詳細画面（BuyerDetailPage）のヘッダーにある買主番号検索バーで、買主番号を入力してEnterキーを押しても遷移しないバグを修正する。
半角・全角どちらの入力でも動作するようにする。

根本原因は2つある：
1. `handleNavigate` 関数が `/buyers/:id` への遷移でも必須フィールドのバリデーションチェックを実行し、未入力フィールドがある場合に遷移をブロックする
2. 全角数字（例：「４３７０」）を入力した場合、`toHalfWidth` 変換は実装済みだが、`handleNavigate` のブロックにより変換後の値でも遷移できない

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主詳細画面で必須フィールドが未入力の状態で、検索バーに買主番号（半角・全角問わず）を入力してEnterキーを押す THEN the system はバリデーション警告ダイアログを表示して遷移をブロックする

1.2 WHEN ユーザーが全角数字（例：「４３７０」）を検索バーに入力してEnterキーを押す THEN the system は `handleNavigate` のバリデーションチェックにより遷移がブロックされ、別の買主詳細画面に遷移できない

1.3 WHEN ユーザーが半角数字（例：「4370」）を検索バーに入力してEnterキーを押す THEN the system は `handleNavigate` のバリデーションチェックにより遷移がブロックされ、別の買主詳細画面に遷移できない（必須フィールドが未入力の場合）

### Expected Behavior (Correct)

2.1 WHEN ユーザーが半角数字（例：「4370」）を検索バーに入力してEnterキーを押す THEN the system SHALL バリデーションチェックをスキップして `/buyers/4370` へ直接遷移する

2.2 WHEN ユーザーが全角数字（例：「４３７０」）を検索バーに入力してEnterキーを押す THEN the system SHALL 全角数字を半角数字に変換した上でバリデーションチェックをスキップして `/buyers/4370` へ直接遷移する

2.3 WHEN ユーザーが検索バーから別の買主番号で遷移する THEN the system SHALL 現在の買主の必須フィールド入力状況に関わらず遷移を実行する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが検索バーに何も入力せずEnterキーを押す THEN the system SHALL CONTINUE TO ナビゲーションを実行しない

3.2 WHEN ユーザーが検索バーのクリアボタンをクリックする THEN the system SHALL CONTINUE TO 検索バーの入力値をクリアする

3.3 WHEN ユーザーが買主詳細画面から希望条件ページ以外のページ（例：買主一覧）へ遷移しようとする THEN the system SHALL CONTINUE TO 必須フィールドのバリデーションチェックを実行する（検索バーからの遷移を除く）

3.4 WHEN ユーザーが希望条件ページへ遷移する THEN the system SHALL CONTINUE TO バリデーションをスキップして遷移する

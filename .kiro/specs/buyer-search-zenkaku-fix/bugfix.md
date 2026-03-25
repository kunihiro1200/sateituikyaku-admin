# Bugfix Requirements Document

## Introduction

買主詳細画面のヘッダーにある買主番号検索バーで、全角数字（例：「４３７０」）を入力しても検索が機能しないバグを修正する。
`buyer_number` カラムはTEXT型で半角数字（例：「4370」）として保存されているため、全角数字のまま検索すると一致しない。
ユーザーが全角・半角どちらで入力しても同じ検索結果が得られるよう、入力値を自動的に半角数字に変換してから検索を実行する。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが全角数字（例：「４３７０」）を検索バーに入力してEnterキーを押す THEN the system は `/buyers/４３７０` へ遷移し、買主が見つからない（または一致しない）

1.2 WHEN ユーザーが全角数字を含む文字列を入力してEnterキーを押す THEN the system は全角数字をそのままURLパラメータとして使用するため、半角数字で登録された `buyer_number` と一致しない

### Expected Behavior (Correct)

2.1 WHEN ユーザーが全角数字（例：「４３７０」）を検索バーに入力してEnterキーを押す THEN the system SHALL 全角数字を半角数字（例：「4370」）に自動変換してから `/buyers/4370` へ遷移する

2.2 WHEN ユーザーが全角数字を含む文字列を入力してEnterキーを押す THEN the system SHALL 全角数字部分を半角数字に変換した上でナビゲーションを実行し、正しい買主詳細画面を表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが半角数字（例：「4370」）を検索バーに入力してEnterキーを押す THEN the system SHALL CONTINUE TO そのまま `/buyers/4370` へ遷移し、正しい買主詳細画面を表示する

3.2 WHEN ユーザーが検索バーのクリアボタンをクリックする THEN the system SHALL CONTINUE TO 検索バーの入力値をクリアする

3.3 WHEN ユーザーが検索バーに何も入力せずEnterキーを押す THEN the system SHALL CONTINUE TO ナビゲーションを実行しない

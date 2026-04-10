# Bugfix Requirements Document

## Introduction

買主リストの検索バーでメールアドレス検索ができないバグの修正。
`backend/src/services/BuyerService.ts` の `getAll()` メソッドの検索クエリにemailフィールドが含まれていないため、キャッシュなし（初回ロード時など）の状態でメールアドレスを検索しても該当する買主が表示されない。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN キャッシュが存在しない状態で買主リストの検索バーにメールアドレスを入力する THEN the system は該当する買主を表示しない（0件になる）
1.2 WHEN `/api/buyers?search=<email>` が呼び出される THEN the system はemailフィールドを検索対象に含めずクエリを実行する

### Expected Behavior (Correct)

2.1 WHEN キャッシュが存在しない状態で買主リストの検索バーにメールアドレスを入力する THEN the system SHALL 該当するメールアドレスを持つ買主を表示する
2.2 WHEN `/api/buyers?search=<email>` が呼び出される THEN the system SHALL emailフィールドを含む検索クエリを実行し、部分一致する買主を返す

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 検索バーに買主番号（4〜5桁の数字）を入力する THEN the system SHALL CONTINUE TO 完全一致で買主を検索・表示する
3.2 WHEN 検索バーに氏名を入力する THEN the system SHALL CONTINUE TO 部分一致で買主を検索・表示する
3.3 WHEN 検索バーに電話番号を入力する THEN the system SHALL CONTINUE TO 部分一致で買主を検索・表示する
3.4 WHEN 検索バーに物件番号を入力する THEN the system SHALL CONTINUE TO 部分一致で買主を検索・表示する
3.5 WHEN 全件データがキャッシュされている状態でメールアドレスを検索する THEN the system SHALL CONTINUE TO フロントエンドのローカルフィルタリングで正常に買主を表示する

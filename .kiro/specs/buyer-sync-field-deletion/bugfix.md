# バグ修正要件定義書：買主リスト（buyers）の同期バグ修正

## Introduction

買主番号7230の内覧日がスプレッドシートで削除されたが、データベースには古い値が残ったままになる問題を修正します。この問題は内覧日だけでなく、全フィールド（全カラム）で発生しています。スプレッドシートでフィールドの値が削除（空欄に）されたら、データベースでも該当フィールドがnullまたは空文字列に更新されるべきです。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN スプレッドシートでフィールドの値を削除（空欄に）する THEN データベースには古い値が残り続ける

1.2 WHEN 買主番号7230の内覧日をスプレッドシートで削除する THEN データベースの`viewing_date`カラムには古い値が残ったまま

1.3 WHEN GASの`syncUpdatesToSupabase_`関数が実行される THEN 空欄フィールドの更新が検出されない（`needsUpdate`フラグがfalseのまま）

1.4 WHEN スプレッドシートで任意のフィールドを空欄にする THEN データベースの該当カラムは更新されない

### Expected Behavior (Correct)

2.1 WHEN スプレッドシートでフィールドの値を削除（空欄に）する THEN データベースの該当カラムもnullまたは空文字列に更新される

2.2 WHEN 買主番号7230の内覧日をスプレッドシートで削除する THEN データベースの`viewing_date`カラムもnullに更新される

2.3 WHEN GASの`syncUpdatesToSupabase_`関数が実行される THEN 空欄フィールドの変更も検出される（`needsUpdate`フラグがtrueになる）

2.4 WHEN スプレッドシートで任意のフィールドを空欄にする THEN データベースの該当カラムも確実に更新される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN スプレッドシートで新しい値を入力する THEN データベースには引き続き正しく同期される

3.2 WHEN 買主サイドバーカウント更新処理が実行される THEN システムは引き続き`buyer_sidebar_counts`テーブルを正しく更新する

3.3 WHEN GASの10分トリガーが実行される THEN システムは引き続き10分ごとに同期処理を実行する

3.4 WHEN 追加同期（Phase 1）が実行される THEN システムは引き続きスプレッドシートにあってDBにない買主を正しく追加する

3.5 WHEN 削除同期（Phase 3）が実行される THEN システムは引き続きDBにあってスプレッドシートにない買主を正しく削除する

# Bugfix Requirements Document

## Introduction

売主新規登録画面（`/sellers/new`）の「買主コピー」機能で、既存の買主番号（例: 7211）を入力すると「該当する買主が見つかりません」と表示され、バックエンドで500 Internal Server Errorが発生するバグを修正する。

根本原因は2つある：

1. **バックエンド（型不一致）**: `BuyerService.search()` が数字のみのクエリに対して `buyer_number.eq.7211`（数値）でSupabaseクエリを発行するが、`buyer_number` カラムはTEXT型のため型不一致で500エラーが発生する。

2. **フロントエンド（フィールド名不一致）**: `BuyerService.search()` が返すレスポンスのフィールド名はスネークケース（`buyer_number`）だが、フロントエンドの `buyerCopyOptions` の型定義はキャメルケース（`buyerNumber`）を期待しているため、`option.buyerNumber` が `undefined` になる。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主コピーフィールドに数字のみの買主番号（例: 7211）を入力する THEN バックエンドが `buyer_number.eq.7211`（数値）でクエリを発行し、TEXT型カラムとの型不一致で500 Internal Server Errorが発生する

1.2 WHEN バックエンドの `/api/buyers/search` が買主データを返す THEN レスポンスのフィールド名がスネークケース（`buyer_number`）であるため、フロントエンドがキャメルケース（`buyerNumber`）として参照すると `undefined` になり、Autocompleteの選択肢が正しく表示されない

1.3 WHEN 買主コピーフィールドに数字のみの買主番号を入力する THEN 「該当する買主が見つかりません」と表示され、情報のコピーができない

### Expected Behavior (Correct)

2.1 WHEN 買主コピーフィールドに数字のみの買主番号（例: 7211）を入力する THEN バックエンドが `buyer_number.eq.'7211'`（文字列）でクエリを発行し、TEXT型カラムと正しく照合して該当する買主を返す

2.2 WHEN バックエンドの `/api/buyers/search` が買主データを返す THEN フロントエンドがレスポンスのフィールド名（`buyer_number`）を正しく参照し、Autocompleteの選択肢に買主番号と名前が表示される

2.3 WHEN 買主コピーフィールドで買主を選択する THEN 該当買主の名前・電話番号・メールアドレスが売主登録フォームにコピーされる

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 買主コピーフィールドに文字列を含む検索クエリ（例: 「田中」）を入力する THEN システムは SHALL CONTINUE TO `ilike` 検索で該当する買主の一覧を返す

3.2 WHEN 買主コピーフィールドに2文字未満の入力をする THEN システムは SHALL CONTINUE TO 検索を実行せず選択肢を表示しない

3.3 WHEN 売主コピーフィールドで既存売主を検索・選択する THEN システムは SHALL CONTINUE TO 売主情報を正しくフォームにコピーする

3.4 WHEN 買主番号以外の通常の買主検索（`/api/buyers/search`）を使用する THEN システムは SHALL CONTINUE TO 既存の検索動作を維持する

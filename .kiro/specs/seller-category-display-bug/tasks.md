# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 専任・公開中の担当者別分解バグ
  - **重要**: このテストは未修正コードで必ず FAIL すること（バグの存在を確認するため）
  - **修正やコードを直そうとしないこと（テストが失敗しても）**
  - **注意**: このテストは期待動作をエンコードしている。修正後にパスすることでバグ修正を検証する
  - **目的**: バグが存在することを示す反例を見つける
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - `PropertySidebarStatus.tsx` の `statusCounts` useMemo に対してテストを作成する
  - テスト対象: `sidebar_status === '専任・公開中'` かつ `sales_assignee === '林'` の物件を渡した場合
  - バグ条件（design.md の isBugCondition より）:
    - `listing.sidebar_status === '専任・公開中'`
    - `listing.sales_assignee` が `ASSIGNEE_TO_SENIN_STATUS` のキーに存在する（例: `'林'`）
    - カテゴリー表示が `'林・専任公開中'` ではなく `'専任・公開中'` になっている
  - テストケース1: `sidebar_status='専任・公開中'`, `sales_assignee='林'`, `workTaskMap` あり → `'専任・公開中'` が表示される（バグ）
  - テストケース2: `sidebar_status='専任・公開中'`, `sales_assignee='林'`, `price_reduction_scheduled_date` が今日以前 → `calculatePropertyStatus` が `price_reduction_due` を返して `return` するため `'林・専任公開中'` がカウントされない
  - テストケース3: `sidebar_status='専任・公開中'`, `sales_assignee='林'`, `report_date` が今日以前 → `calculatePropertyStatus` が `unreported` を返して `return` するため `'林・専任公開中'` がカウントされない
  - 未修正コードでテストを実行する
  - **期待される結果**: テスト FAIL（これが正しい。バグの存在を証明する）
  - 見つかった反例を記録して根本原因を理解する（例: `calculatePrice(0, 10)` がクラッシュする代わりに `'N/A'` を返すべき）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 既存の担当者別専任公開中カテゴリーの保持
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ条件の入力（`isBugCondition` が false を返すケース）の動作を観察する
  - 観察: `sidebar_status='林・専任公開中'`（新形式）の物件は `'林・専任公開中'` としてカウントされる
  - 観察: `sidebar_status='専任・公開中'`, `sales_assignee='山本'` は `'Y専任公開中'` としてカウントされる（同様のバグがある可能性あり）
  - 観察: `sidebar_status='専任・公開中'`, `sales_assignee=null` は `'専任・公開中'` としてカウントされる（正常動作）
  - 観察: `sidebar_status='未完了'` などの他カテゴリーは修正の影響を受けない
  - 保全要件（design.md の Preservation Requirements より）に基づいてプロパティベーステストを作成する:
    - `sidebar_status` がすでに担当者別形式（`'林・専任公開中'` など）の物件は引き続き正しく表示される
    - 他の担当者（山本→Y専任公開中、生野→生・専任公開中、久→久・専任公開中、裏→U専任公開中、国広→K専任公開中、木村→R専任公開中、角井→I専任公開中）の専任公開中カテゴリーは変わらず表示される
    - `sales_assignee` が未設定またはマッピングに存在しない場合は `'専任・公開中'` としてカウントされ続ける
    - `'要値下げ'`、`'未報告'` などの他カテゴリーの表示・カウントは変わらない
  - 未修正コードでテストを実行する
  - **期待される結果**: テスト PASS（ベースラインの動作を確認する）
  - テストを作成・実行し、未修正コードでパスしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 専任・公開中の担当者別分解バグを修正する

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/components/PropertySidebarStatus.tsx` の `statusCounts` useMemo を修正する
    - `sidebar_status === '専任・公開中'` の分解処理を `calculatePropertyStatus` の結果（`price_reduction_due` / `unreported` による早期 `return`）に依存しない形に変更する
    - 修正案: `sidebar_status === '専任・公開中'` の物件は `ASSIGNEE_TO_SENIN_STATUS` による分解処理を先に実行し、`return` する（`workTaskMap` の処理より前に配置）
    - 具体的な変更（design.md の Fix Implementation より）:
      - `calculatePropertyStatus` が `price_reduction_due` または `unreported` を返す前に `sidebar_status === '専任・公開中'` の分解処理を実行する
      - または、`sidebar_status === '専任・公開中'` の場合は `calculatePropertyStatus` の結果に関わらず `ASSIGNEE_TO_SENIN_STATUS` で分解してカウントする
    - _Bug_Condition: `listing.sidebar_status === '専任・公開中'` かつ `listing.sales_assignee` が `ASSIGNEE_TO_SENIN_STATUS` に存在するにもかかわらず担当者別カテゴリーに分解されない_
    - _Expected_Behavior: `sidebar_status === '専任・公開中'` かつ `sales_assignee` が `ASSIGNEE_TO_SENIN_STATUS` に存在する場合、`ASSIGNEE_TO_SENIN_STATUS[sales_assignee]`（例: `'林・専任公開中'`）としてカウントされる_
    - _Preservation: `sidebar_status` がすでに担当者別形式の物件・他の担当者の専任公開中カテゴリー・`sales_assignee` 未設定の場合の動作は変わらない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件の探索テストがパスすることを確認する
    - **Property 1: Expected Behavior** - 専任・公開中の担当者別分解
    - **重要**: タスク1で作成した同じテストを再実行すること。新しいテストを書かないこと
    - タスク1のテストは期待動作をエンコードしている
    - このテストがパスすれば、期待動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テスト PASS（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続きパスすることを確認する
    - **Property 2: Preservation** - 既存の担当者別専任公開中カテゴリーの保持
    - **重要**: タスク2で作成した同じテストを再実行すること。新しいテストを書かないこと
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テスト PASS（リグレッションがないことを確認する）
    - 修正後も全テストがパスすることを確認する（リグレッションなし）

- [x] 4. チェックポイント - 全テストがパスすることを確認する
  - 全テストがパスすることを確認する。疑問点があればユーザーに確認する。

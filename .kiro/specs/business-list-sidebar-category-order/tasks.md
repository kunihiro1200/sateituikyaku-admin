# 実装計画: 業務依頼サイドバーカテゴリー順番整理

## 概要

`frontend/frontend/src/utils/workTaskStatusUtils.ts` の `CATEGORY_ORDER` 配列と `CATEGORY_GROUP_COLORS` 配列の並び順を、業務フロー（媒介契約 → サイト登録 → 売買契約 → 台帳作成 → その他 → 保留）に合わせて変更する。

変更はエンコーディング保護のためPythonスクリプトで適用する。

## タスク

- [ ] 1. Pythonスクリプトの作成と実行
  - [x] 1.1 変更適用用Pythonスクリプトを作成する
    - `apply_category_order_change.py` をプロジェクトルートに作成
    - `CATEGORY_ORDER` 配列を業務フロー順に並び替える（媒介作成_締日 → サイト登録依頼してください → サイト依頼済み納品待ち → サイト登録要確認 → 売買契約 依頼未 → 売買契約　営業確認中 → 売買契約 入力待ち → 売買契約 製本待ち → 要台帳作成 → 決済完了チャット送信未 → 入金確認未 → 保留）
    - `CATEGORY_GROUP_COLORS` 配列を新しい `CATEGORY_ORDER` と同じ順番に整合させる
    - UTF-8エンコーディングで読み書きする（`rb`/`wb` + `.encode('utf-8')`）
    - _要件: 1.1, 2.1_

  - [x] 1.2 Pythonスクリプトを実行して変更を適用する
    - `python apply_category_order_change.py` を実行
    - 変更が正しく適用されたことを確認（`CATEGORY_ORDER` の最初の要素が `媒介作成_締日`、最後が `保留` であること）
    - _要件: 1.1, 2.1_

- [ ] 2. プロパティベーステストの作成
  - [ ] 2.1 テスト環境のセットアップを確認する
    - `frontend/frontend` ディレクトリで `fast-check` が利用可能か確認
    - テストファイルの配置場所を確認（既存テストの慣習に従う）
    - _要件: 3.4, 3.5_

  - [ ]* 2.2 Property 1: カテゴリー表示順番の正確性テストを書く
    - **Property 1: カテゴリー表示順番の正確性**
    - 任意のタスクデータセットに対して `getStatusCategories()` の返却順が `CATEGORY_ORDER` と一致することを検証
    - **Validates: Requirements 1.1**

  - [ ]* 2.3 Property 2: `All` エントリーの最上部表示テストを書く
    - **Property 2: All エントリーの最上部表示**
    - 任意のタスクデータセット（空配列含む）に対して最初の要素が `'All'` であることを検証
    - **Validates: Requirements 1.3**

  - [ ]* 2.4 Property 3: 0件カテゴリーの非表示テストを書く
    - **Property 3: 0件カテゴリーの非表示**
    - `All` を除く全カテゴリーの `count` が 1 以上であることを検証
    - **Validates: Requirements 1.4**

  - [ ]* 2.5 Property 4: プレフィックスマッチングによる背景色適用テストを書く
    - **Property 4: プレフィックスマッチングによる背景色適用**
    - `CATEGORY_ORDER` 内の任意のプレフィックスで始まるラベルに対して `getCategoryGroupColor()` が `undefined` 以外を返すことを検証
    - **Validates: Requirements 2.2**

  - [ ]* 2.6 Property 6: カウントとフィルタリング結果の一致テストを書く
    - **Property 6: カウントとフィルタリング結果の一致**
    - 各カテゴリーの `count` と `filter` 関数でフィルタリングした件数が一致することを検証
    - **Validates: Requirements 3.2**

- [x] 3. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVPとして省略可能
- 各タスクは対応する要件番号を参照している
- `workTaskStatusUtils.ts` は日本語文字列を含むため、`strReplace` ツールは使用せずPythonスクリプトで変更を適用すること
- バックエンドへの変更は不要

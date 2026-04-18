# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 専任・公開中のラベル文字列不一致バグ
  - **重要**: このテストは修正前のコードで必ず FAIL すること — FAIL がバグの存在を証明する
  - **修正を試みないこと** — テストが失敗しても、コードを修正しない
  - **注意**: このテストは期待される動作をエンコードしている — 実装後に PASS することで修正を検証する
  - **目的**: バグが存在することを示すカウンターサンプルを発見する
  - **スコープ付き PBT アプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - `calculateSidebarStatus()` に以下の入力を渡してテストする（design.md の Bug Condition より）:
    - 専任・公開中、suumo_url 空、S不要でない、公開予定日が昨日以前
    - 期待値: `'レインズ登録＋SUUMO URL 要登録'` が返される
    - 修正前の実際の返り値: `'レインズ登録＋SUUMO登録'`（バグ）
  - 一般・公開中の場合も確認する（こちらは既に正しい `'SUUMO URL　要登録'` が返される）
  - テストを修正前のコードで実行する
  - **期待される結果**: テスト FAIL（これが正しい — バグの存在を証明する）
  - カウンターサンプルを記録して根本原因を理解する（例: `calculateSidebarStatus()` が `'レインズ登録＋SUUMO URL 要登録'` ではなく `'レインズ登録＋SUUMO登録'` を返す）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - バグ条件に該当しない物件の動作保持
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで、バグ条件に該当しない入力の動作を観察する:
    - 観察: suumo_url が入力済みの場合、`'SUUMO URL　要登録'` 系カテゴリーは返されない
    - 観察: suumo_registered = 'S不要' の場合、どちらのカテゴリーも返されない
    - 観察: atbb_status が「一般・公開中」でも「専任・公開中」でもない場合、条件⑥は発動しない
    - 観察: 公開予定日が今日以降の場合、条件⑥は発動しない
    - 観察: 他のカテゴリー（未報告、未完了、本日公開予定など）の計算結果は変わらない
  - プロパティベーステストを作成する（design.md の Preservation Requirements より）:
    - ランダムな suumo_url パターン（null、空文字以外の値）を生成し、バグ条件が成立しないことを検証
    - ランダムな atbb_status 値（「一般・公開中」「専任・公開中」以外）を生成し、条件⑥が発動しないことを検証
    - ランダムな公開予定日（TODAY() 以降）を生成し、条件⑥が発動しないことを検証
    - `calculateSidebarStatus()` の優先度順（①未報告 → ②未完了 → ... → ⑥SUUMO/レインズ）が変わらないことを検証
  - 修正前のコードでテストを実行する
  - **期待される結果**: テスト PASS（これがベースラインの動作を確認する）
  - テストを作成し、実行し、修正前コードで PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [-] 3. SUUMO URL 要登録サイドバー表示バグの修正

  - [x] 3.1 `calculateSidebarStatus()` のラベル文字列を修正する
    - `backend/src/services/PropertyListingSyncService.ts` を編集する
    - 条件⑥の専任・公開中の場合に返すラベルを修正する:
      ```typescript
      // 修正前
      return atbbStatus === '一般・公開中'
        ? 'SUUMO URL　要登録'
        : 'レインズ登録＋SUUMO登録';

      // 修正後
      return atbbStatus === '一般・公開中'
        ? 'SUUMO URL　要登録'
        : 'レインズ登録＋SUUMO URL 要登録';
      ```
    - _Bug_Condition: isBugCondition(property) — atbb_status IN ['一般・公開中', '専任・公開中'] AND publishDate <= TODAY()-1 AND suumoUrl IS EMPTY AND suumoReg != 'S不要'_
    - _Expected_Behavior: atbb_status = '専任・公開中' の場合 `'レインズ登録＋SUUMO URL 要登録'` を返す_
    - _Preservation: suumo_url 入力済み・S不要・公開中以外・公開予定日未来の物件は影響を受けない_
    - _Requirements: 2.2, 2.3_

  - [x] 3.2 フロントエンドの `PROPERTY_STATUS_DEFINITIONS` のラベルを修正する
    - `frontend/frontend/src/utils/propertyListingStatusUtils.ts` を編集する
    - `reins_suumo_required` のラベルを修正する:
      ```typescript
      // 修正前
      { key: 'reins_suumo_required', label: 'レインズ登録＋SUUMO登録', color: '#3f51b5' },

      // 修正後
      { key: 'reins_suumo_required', label: 'レインズ登録＋SUUMO URL 要登録', color: '#3f51b5' },
      ```
    - _Bug_Condition: フロントエンドのカテゴリーラベルがバックエンドの返すラベルと一致していない_
    - _Expected_Behavior: バックエンドが返す `'レインズ登録＋SUUMO URL 要登録'` とフロントエンドのラベルが一致する_
    - _Preservation: 他のカテゴリー定義（color、key など）は変更しない_
    - _Requirements: 2.2_

  - [x] 3.3 `PropertyListingService.update()` の `suumo_url` 空時の再計算条件を修正する
    - `backend/src/services/PropertyListingService.ts` を編集する
    - `suumo_url` が空文字列で更新された場合も `sidebar_status` を再計算するよう条件を修正する:
      ```typescript
      // 修正前
      if ('suumo_url' in updates && updates.suumo_url && String(updates.suumo_url).trim() !== '') {

      // 修正後
      if ('suumo_url' in updates) {
      ```
    - _Bug_Condition: suumo_url が空文字列で更新された場合に sidebar_status の再計算が行われない_
    - _Expected_Behavior: suumo_url の更新（空文字列を含む）時に sidebar_status を再計算する_
    - _Preservation: suumo_url が updates に含まれない場合の動作は変わらない_
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 既存テストのラベル期待値を修正する
    - `'レインズ登録＋SUUMO登録'` というラベルを期待している既存テストを検索する
    - 正しいラベル `'レインズ登録＋SUUMO URL 要登録'` に更新する
    - _Requirements: 2.2_

  - [x] 3.5 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 専任・公開中のラベル文字列修正
    - **重要**: タスク 1 で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク 1 のテストは期待される動作をエンコードしている
    - このテストが PASS することで、期待される動作が満たされたことを確認する
    - バグ条件の探索テスト（タスク 1）を実行する
    - **期待される結果**: テスト PASS（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.6 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - バグ条件に該当しない物件の動作保持
    - **重要**: タスク 2 で作成した同じテストを再実行する — 新しいテストを書かない
    - 保全プロパティテスト（タスク 2）を実行する
    - **期待される結果**: テスト PASS（リグレッションがないことを確認）
    - 修正後も全ての保全テストが PASS することを確認する

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
  - バグ条件の探索テスト（タスク 1）が PASS していることを確認する
  - 保全プロパティテスト（タスク 2）が PASS していることを確認する
  - AA3959 の実データで正しいカテゴリーに表示されることを確認する（可能であれば）
  - フロントエンドのサイドバーで「SUUMO URL 要登録」「レインズ登録＋SUUMO URL 要登録」カテゴリーが表示されることを確認する

# Implementation Plan

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - `sendEmailsDirectly()` に渡す `propertyData` に必要なフィールドが欠落しているため、プレースホルダーが置換されないバグ
  - **CRITICAL**: このテストは未修正コードで FAIL する — FAIL することがバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示す反例を見つける
  - テスト対象: `frontend/frontend/src/__tests__/price-reduction-email-placeholder-bug-exploration.test.ts` を新規作成
  - `replacePlaceholders(template.body, { propertyNumber: 'AA1234', address: '大分市中央町1-1-1' })` を呼び出す（Bug Condition: `propertyData` に `publicUrl`、`priceChangeText`、`signature`、`buyerName` が欠落）
  - テストアサーション: 結果に `{publicUrl}`、`{priceChangeText}`、`{signature}`、`{buyerName}` が含まれないことを期待する
  - 未修正コードで実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（プレースホルダーが置換されずそのまま残るため）
  - 反例を記録する（例: `replacePlaceholders(body, { propertyNumber: 'AA1234', address: '大分市' })` の結果に `{publicUrl}` が含まれる）
  - テストを作成し、実行し、FAIL を確認したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. 保持確認テストを作成する（修正前に実施）
  - **Property 2: Preservation** - 買主フィルタリング・個別名前差し込み・フォールバック処理が変わらないことを確認する
  - **IMPORTANT**: 観察優先メソドロジーに従う — 未修正コードで動作を観察してからテストを書く
  - テスト対象: `frontend/frontend/src/__tests__/price-reduction-email-placeholder-preservation.test.ts` を新規作成
  - 観察1: `replacePlaceholders(template.body, { propertyNumber: 'AA1234', address: '大分市', publicUrl: 'https://example.com', priceChangeText: '1850万円 → 1350万円（500万円値下げ）', signature: 'SIGNATURE', buyerName: '田中様' })` → すべてのプレースホルダーが置換されることを確認
  - 観察2: `buyerName = null` の場合、`{buyerName}` が空文字に置換されること（`replacePlaceholders` の仕様）
  - 観察3: `GmailDistributionButton` 内のローカル `replacePlaceholders` 関数（フォールバック処理用）は正しく動作することを確認
  - プロパティベーステスト: ランダムな `publicUrl`、`priceChangeText`、`signature`、`buyerName` を生成し、完全な `propertyData` を渡した場合に `{...}` 形式のプレースホルダーが残らないことを検証（fast-check 使用）
  - 未修正コードで実行する
  - **EXPECTED OUTCOME**: テストが PASS する（ベースライン動作の確認）
  - テストを作成し、実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. プレースホルダー未置換バグを修正する

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/components/GmailDistributionButton.tsx` の `handleConfirmationConfirm` を修正する
    - `sendEmailsDirectly()` の第2引数 `propertyData` に不足フィールドを追加する
    - 修正前:
      ```typescript
      {
        propertyNumber: propertyNumber,
        address: propertyAddress || ''
      }
      ```
    - 修正後:
      ```typescript
      {
        propertyNumber: propertyNumber,
        address: propertyAddress || '',
        publicUrl: publicUrl || '',
        priceChangeText: generatePriceChangeText(),
        signature: SIGNATURE,
        buyerName: buyerName,
        propertyType: propertyType || '',
        price: getPriceText()
      }
      ```
    - `buyerName` は `handleConfirmationConfirm` 内で既に定義済みの変数をそのまま使用する
    - _Bug_Condition: `propertyData` に `publicUrl`、`priceChangeText`、`signature`、`buyerName` が欠落_
    - _Expected_Behavior: すべてのプレースホルダーが実際の値に置換される_
    - _Preservation: 買主フィルタリング・送信フロー・ログ記録・フォールバック処理は変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 バグ条件探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 修正後、すべてのプレースホルダーが置換される
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク1のテスト（`price-reduction-email-placeholder-bug-exploration.test.ts`）を再実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.3 保持確認テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 既存の送信フロー・フィルタリングが変わらない
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク2のテスト（`price-reduction-email-placeholder-preservation.test.ts`）を再実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - `price-reduction-email-placeholder-bug-exploration.test.ts` が PASS することを確認する
  - `price-reduction-email-placeholder-preservation.test.ts` が PASS することを確認する
  - 疑問点があればユーザーに確認する

- [x] 5. デプロイする
  - `git add` で変更ファイルをステージングする
  - `git commit` でコミットする（メッセージ例: `fix: add missing propertyData fields to sendEmailsDirectly call`）
  - `git push` でリモートにプッシュする

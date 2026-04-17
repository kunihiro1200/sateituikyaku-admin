# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - onChatSend prop 欠落 & 空文字列保存バグ
  - **重要**: このテストは未修正コードで必ず FAIL する — 失敗がバグの存在を証明する
  - **修正やコードを直そうとしないこと（失敗しても）**
  - **目的**: バグが存在することを示す反例を見つける
  - **スコープ付き PBT アプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト1: `onChatSend` prop を渡さずに `PriceSection` をレンダリングし、TypeScript エラーまたはボタン非表示を確認
    - `priceReductionScheduledDate={null}` かつ `isEditMode={false}` の状態で `onChatSend` なしでレンダリング
    - 「物件担当へCHAT送信」ボタンが表示されないことを確認（バグ条件: `onChatSendPropPassed === false`）
  - テスト2: バックエンドの PUT 処理に `price_reduction_scheduled_date: ""` を送信し、DB に `""` が保存されることを確認
    - `price_reduction_scheduled_date` が `""` のまま変換されずに Supabase に渡されることを確認
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 反例を記録して根本原因を理解する（例: `onChatSend` prop が渡されていないため TypeScript エラー発生）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを書く（修正実装の前に）
  - **Property 2: Preservation** - 値下げ予約日あり・編集モードでのボタン非表示
  - **重要**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`isBugCondition` が false になるケース）の動作を観察する
  - 観察1: `priceReductionScheduledDate="2026/05/01"` かつ `isEditMode={false}` → ボタンが非表示
  - 観察2: `isEditMode={true}` かつ `priceReductionScheduledDate={null}` → ボタンが非表示
  - 観察3: `priceReductionScheduledDate={null}` かつ `isEditMode={false}` → ボタンが表示（正常動作）
  - プロパティベーステスト: 任意の非空文字列の `priceReductionScheduledDate` に対して `showChatButton === false` を検証
  - プロパティベーステスト: 任意の `isEditMode={true}` に対して `showChatButton === false` を検証
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが PASS する（ベースライン動作を確認）
  - テストを書き、実行し、未修正コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. onChatSend prop 欠落 & 空文字列保存バグの修正

  - [x] 3.1 修正1: `PropertyListingDetailPage.tsx` に `handlePropertyChatSend` を追加し `onChatSend` prop を渡す
    - `handlePriceChatSendSuccess` 関数の近くに `handlePropertyChatSend` ハンドラーを追加する
      ```typescript
      const handlePropertyChatSend = async (data: PropertyChatSendData) => {
        // PriceSection 内部で直接 Webhook に送信するため、
        // このハンドラーは将来のバックエンド移行用プレースホルダー
      };
      ```
    - `PriceSection` JSX（行 2140-2156 付近）に `onChatSend={handlePropertyChatSend}` を追加する
    - _Bug_Condition: `onChatSendPropPassed === false` の場合に TypeScript 必須 prop 違反が発生_
    - _Expected_Behavior: `onChatSend` prop が正しく渡され、`showChatButton` が `true` になる_
    - _Preservation: 値下げ予約日あり・編集モードでのボタン非表示は変更なし_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 修正2: `backend/src/routes/propertyListings.ts` に `price_reduction_scheduled_date` の空文字列→null 変換を追加する
    - PUT 処理（行 278-283 付近）の `OFFER_FIELDS` 変換の後に以下を追加する
      ```typescript
      if (safeUpdates.price_reduction_scheduled_date === '') {
        safeUpdates.price_reduction_scheduled_date = null;
      }
      ```
    - _Bug_Condition: `price_reduction_scheduled_date === ''` の場合に DB に空文字列が保存される_
    - _Expected_Behavior: 空文字列が `null` に変換されて DB に保存される_
    - _Preservation: `OFFER_FIELDS` の空文字列→null 変換は変更なし_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - onChatSend prop 欠落 & 空文字列保存バグ
    - **重要**: タスク1 と同じテストを再実行する — 新しいテストを書かないこと
    - タスク1 のテストは期待動作をエンコードしている
    - このテストが PASS すれば、期待動作が満たされたことを確認できる
    - タスク1 のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 値下げ予約日あり・編集モードでのボタン非表示
    - **重要**: タスク2 と同じテストを再実行する — 新しいテストを書かないこと
    - タスク2 の保全プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。

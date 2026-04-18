# 実装計画

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - オレンジバーCHAT送信時の確認ステータス変更バグ
  - **重要**: このテストは修正前のコードで実行し、**必ず失敗すること** — 失敗がバグの存在を証明する
  - **修正前にテストを書くこと。テストが失敗しても修正しないこと**
  - **目的**: バグが存在することを示す反例を見つける
  - **スコープ付きPBTアプローチ**: バグ条件 `isBugCondition(X)` が成立するケース（`X.source = 'orange_bar'` かつ `X.sendResult = 'success'`）に絞ってテストを実施する
  - `PriceSection.tsx` をレンダリングし、オレンジバー「物件担当へCHAT送信（画像添付可能）」のCHAT送信成功時に `onChatSendSuccess` が呼ばれることを確認する（修正前は呼ばれる = バグ）
  - `onChatSendSuccess` が呼ばれた際に確認ステータスが変更されることを確認する（修正前は変わる = バグ）
  - `onChatSendSuccess` 経由で `PUT /api/property-listings/:id/confirmation` APIが呼ばれることを確認する（修正前は呼ばれる = バグ）
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが**失敗**する（これが正しい — バグの存在を証明する）
  - 見つかった反例を記録する（例: 「オレンジバー送信成功時に `onChatSendSuccess` が呼ばれ、確認ステータスが変更された」）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 青いバーCHAT送信時の確認ステータス更新動作の保全
  - **重要**: 観察優先メソドロジーに従うこと
  - バグ条件が成立しないケース（`isBugCondition(X) = false`、つまり青いバーからの送信成功）で修正前のコードの動作を観察する
  - 観察: 青いバー「CHAT送信」の送信成功時に確認ステータスが「未」に更新されることを確認する
  - 観察: 青いバーの送信成功時に `PUT /api/property-listings/:id/confirmation` APIが呼ばれることを確認する
  - 観察: 青いバーの送信成功時に `propertyConfirmationUpdated` イベントが発火することを確認する
  - プロパティベーステスト: 様々な確認ステータス初期値（「済」「未」など）に対して、青いバー送信成功後は常に確認ステータスが「未」になることを検証する
  - プロパティベーステスト: 様々な物件状態に対して、青いバー送信失敗時は確認ステータスが変更されないことを検証する
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが**成功**する（これが正しい — 保全すべきベースライン動作を確認する）
  - テストを書き、実行し、成功を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. オレンジバーCHAT送信時の確認ステータス変更バグを修正する

  - [x] 3.1 `PriceSection.tsx` に `onPriceReductionChatSendSuccess` props を追加する
    - `frontend/frontend/src/components/PriceSection.tsx` を編集する
    - `PriceSectionProps` インターフェースに `onPriceReductionChatSendSuccess?: (message: string) => void` を追加する
    - `handleSendPriceReductionChat` 内の `onChatSendSuccess(...)` 呼び出しを `(onPriceReductionChatSendSuccess ?? onChatSendSuccess)(...)` に変更する
    - 後方互換性を保ちつつ、専用コールバックが渡された場合はそちらを優先する
    - _Bug_Condition: `isBugCondition(X)` where `X.source = 'orange_bar' AND X.sendResult = 'success'`_
    - _Expected_Behavior: オレンジバー送信成功時に確認ステータスを変更しない、APIを呼ばない、イベントを発火しない_
    - _Preservation: 青いバー送信成功時は `onChatSendSuccess`（= `handlePriceChatSendSuccess`）が引き続き呼ばれ、確認ステータスが「未」に更新される_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

  - [x] 3.2 `PropertyListingDetailPage.tsx` に `handlePriceReductionChatSendSuccess` を追加する
    - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` を編集する
    - `handlePriceReductionChatSendSuccess` 関数を追加する（スナックバー表示と `priceSavedButNotSent` フラグのリセットのみ行い、確認ステータスの更新・API呼び出し・イベント発火は行わない）
    - `<PriceSection>` に `onPriceReductionChatSendSuccess={handlePriceReductionChatSendSuccess}` を渡す
    - _Bug_Condition: `isBugCondition(X)` where `X.source = 'orange_bar' AND X.sendResult = 'success'`_
    - _Expected_Behavior: `handlePriceReductionChatSendSuccess` はスナックバー表示と `priceSavedButNotSent` リセットのみ実行する_
    - _Preservation: `handlePriceChatSendSuccess` は変更せず、青いバー経由の呼び出しは従来通り動作する_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.5_

  - [x] 3.3 バグ条件探索テストが成功することを確認する
    - **Property 1: Expected Behavior** - オレンジバーCHAT送信時の確認ステータス不変
    - **重要**: タスク1で作成した**同じテスト**を再実行する — 新しいテストを書かないこと
    - タスク1のテストは期待される動作をエンコードしており、修正後はこのテストが成功するはず
    - バグ条件探索テスト（タスク1）を実行する
    - **期待される結果**: テストが**成功**する（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 保全テストが引き続き成功することを確認する
    - **Property 2: Preservation** - 青いバーCHAT送信時の確認ステータス更新動作の保全
    - **重要**: タスク2で作成した**同じテスト**を再実行する — 新しいテストを書かないこと
    - 保全プロパティテスト（タスク2）を実行する
    - **期待される結果**: テストが**成功**する（リグレッションがないことを確認する）
    - 修正後も青いバーの動作が変わっていないことを確認する

- [x] 4. チェックポイント — 全テストの成功を確認する
  - タスク1のバグ条件探索テストが成功することを確認する
  - タスク2の保全プロパティテストが成功することを確認する
  - 疑問点があればユーザーに確認する

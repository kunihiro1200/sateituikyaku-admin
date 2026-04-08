# 実装計画

- [ ] 1. バグ条件探索テストを作成
  - **Property 1: Bug Condition** - 事務へCHAT送信時のサイドバー即時更新
  - **重要**: このテストは修正前のコードで実行し、失敗することを確認する（バグの存在を証明）
  - **目標**: バグを実証する反例を表面化させる
  - **スコープ付きPBTアプローチ**: 決定的なバグのため、具体的な失敗ケース（「事務へCHAT」送信時）にプロパティをスコープする
  - テスト実装の詳細（Bug Conditionから）:
    - 「事務へCHAT」ボタンを押した時（`action == 'send-chat-to-office'`）
    - 確認フィールドがDBで「未」に更新される（`confirmationFieldUpdatedInDB(propertyNumber)`）
    - キャッシュがクリアされない（`NOT cacheCleared(propertyNumber)`）
    - イベントが発火されない（`NOT eventFired(propertyNumber)`）
    - スプレッドシートに同期されない（`NOT spreadsheetSynced(propertyNumber)`）
  - テストアサーションはExpected Behavior Propertiesと一致させる:
    - `pageDataCache.invalidate(CACHE_KEYS.PROPERTY_LISTINGS)`が呼ばれる
    - `sessionStorage.setItem('propertyListingsNeedsRefresh', 'true')`が呼ばれる
    - `window.dispatchEvent(new CustomEvent('propertyConfirmationUpdated', ...))`が呼ばれる
    - スプレッドシートのDQ列に「未」が同期される
  - 修正前のコードで実行
  - **期待される結果**: テスト失敗（これは正しい - バグの存在を証明）
  - 反例を文書化して根本原因を理解する
  - テストが作成され、実行され、失敗が文書化されたらタスク完了とする
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 2. 保存プロパティテストを作成（修正実装前）
  - **Property 2: Preservation** - 手動変更時の既存動作維持
  - **重要**: 観察優先の方法論に従う
  - 観察: 修正前のコードで非バグ条件入力（手動での確認フィールド変更）の動作を観察
  - 観察: `handleUpdateConfirmation`メソッドでキャッシュクリア、sessionStorageフラグ設定、カスタムイベント発火が実行される
  - 観察: 確認フィールドが「未」の場合、サイドバーステータスが「未完了」を返す
  - Preservation Requirementsからプロパティベーステストを作成:
    - 全ての非バグ条件入力（手動での確認フィールド変更）に対して、既存動作が維持される
    - `handleUpdateConfirmation`メソッドの動作が継続する
    - サイドバーステータス計算ロジックが継続する
  - プロパティベーステストは多くのテストケースを自動生成し、より強力な保証を提供する
  - 修正前のコードでテストを実行
  - **期待される結果**: テスト成功（ベースライン動作を確認）
  - テストが作成され、実行され、修正前のコードで成功したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. 事務へCHAT送信時の確認フィールド同期バグ修正

  - [ ] 3.1 フロントエンドの修正を実装
    - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`の`handleSendChatToOffice`メソッドを修正
    - キャッシュクリアを追加: `pageDataCache.invalidate(CACHE_KEYS.PROPERTY_LISTINGS)`
    - sessionStorageフラグを設定: `sessionStorage.setItem('propertyListingsNeedsRefresh', 'true')`
    - カスタムイベントを発火: `window.dispatchEvent(new CustomEvent('propertyConfirmationUpdated', { detail: { propertyNumber, confirmation: '未' } }))`
    - ログ出力を追加: `console.log('[PropertyListingDetailPage] イベント発火:', { propertyNumber, confirmation: '未' })`
    - _Bug_Condition: isBugCondition(input) where input.action == 'send-chat-to-office' AND confirmationFieldUpdatedInDB(input.propertyNumber) AND NOT cacheCleared(input.propertyNumber) AND NOT eventFired(input.propertyNumber) AND NOT spreadsheetSynced(input.propertyNumber)_
    - _Expected_Behavior: expectedBehavior(result) from design - キャッシュクリア、sessionStorageフラグ設定、カスタムイベント発火、スプレッドシート同期が実行される_
    - _Preservation: Preservation Requirements from design - 手動での確認フィールド変更時の既存動作が維持される_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 3.2 バックエンドのスプレッドシート同期を確認・改善（オプション）
    - `backend/src/services/PropertyListingSpreadsheetSync.ts`の`syncConfirmationToSpreadsheet`メソッドを確認
    - エラーログを詳細化（GoogleSheetsClientの認証エラー、範囲指定エラー、アクセス権限エラーを区別）
    - リトライロジックを追加（最大3回リトライ、オプション）
    - 同期結果をレスポンスに含める（オプション）
    - _Requirements: 2.4, 2.5_

  - [ ] 3.3 バグ条件探索テストが成功することを確認
    - **Property 1: Expected Behavior** - 事務へCHAT送信時のサイドバー即時更新
    - **重要**: タスク1で作成した同じテストを再実行 - 新しいテストを作成しない
    - タスク1のテストはExpected Behaviorをエンコードしている
    - このテストが成功すれば、Expected Behaviorが満たされていることを確認
    - タスク1のバグ条件探索テストを再実行
    - **期待される結果**: テスト成功（バグが修正されたことを確認）
    - _Requirements: Expected Behavior Properties from design - 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 3.4 保存テストが引き続き成功することを確認
    - **Property 2: Preservation** - 手動変更時の既存動作維持
    - **重要**: タスク2で作成した同じテストを再実行 - 新しいテストを作成しない
    - タスク2の保存プロパティテストを再実行
    - **期待される結果**: テスト成功（リグレッションがないことを確認）
    - 修正後も全てのテストが成功することを確認（リグレッションなし）

- [ ] 4. チェックポイント - 全てのテストが成功することを確認
  - 全てのテストが成功することを確認し、質問があればユーザーに確認する

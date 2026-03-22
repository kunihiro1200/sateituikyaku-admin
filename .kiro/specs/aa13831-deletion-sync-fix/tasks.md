# 実装計画

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - executeSoftDelete がハードデリートを実行するバグ
  - **重要**: このテストは未修正コードで実行し、**失敗することを確認する**（バグの存在を証明）
  - **目的**: バグが存在することを示す反例を見つける
  - **スコープ**: `executeSoftDelete('AA13831')` を呼び出し、Supabase クライアントをモックして `.delete()` が呼ばれることを確認
  - バグ条件: `seller.deleted_at = null` かつ `seller_number` がスプレッドシートに存在しない（設計書の `isBugCondition` 参照）
  - テスト内容: `executeSoftDelete()` を呼び出した後、DBに `.delete()` が発行され `deleted_at` が設定されないことをアサート
  - 未修正コードで実行 → **失敗が期待される結果**（バグの存在を確認）
  - 反例を記録する（例: `executeSoftDelete('AA13831')` が `deleted_at` を設定せず `.delete()` を呼ぶ）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - スプレッドシートに存在する売主・アクティブ契約ありの売主が影響を受けない
  - **重要**: 観察優先アプローチに従う
  - 観察: 未修正コードで `isBugCondition = false` の入力（スプレッドシートに存在する売主）を実行
  - 観察: `detectDeletedSellers()` がスプレッドシートに存在する売主を検出しないことを確認
  - 観察: `validateDeletion()` が「専任契約中」「一般契約中」の売主をブロックすることを確認
  - 観察: `getAllActiveDbSellerNumbers()` が `deleted_at` 設定済みの売主を除外することを確認
  - プロパティベーステスト: スプレッドシートに存在する売主は `detectDeletedSellers()` の結果に含まれない（設計書の Preservation Requirements 参照）
  - 未修正コードで実行 → **成功が期待される結果**（ベースライン動作を確認）
  - テストを書き、実行し、成功を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. executeSoftDelete のハードデリートをソフトデリートに修正する

  - [x] 3.1 修正を実装する
    - `backend/src/services/EnhancedAutoSyncService.ts` の `executeSoftDelete()` メソッドを修正
    - `.delete().eq('seller_number', sellerNumber)` を `.update({ deleted_at: new Date().toISOString() }).eq('seller_number', sellerNumber).is('deleted_at', null)` に変更
    - コメントを「売主を完全削除（ハードデリート）」から「売主をソフトデリート（deleted_at を設定）」に修正
    - エラー変数名を `deleteError` から `updateError` に変更
    - ログメッセージを「Deleted successfully」から「Soft-deleted successfully (deleted_at: ...)」に変更
    - _Bug_Condition: `seller.deleted_at = null` かつ `seller_number` がスプレッドシートに存在しない（設計書 Bug Condition 参照）_
    - _Expected_Behavior: `executeSoftDelete()` 実行後に `deleted_at` が設定され、レコードがDBに残る（設計書 Fix Implementation 参照）_
    - _Preservation: スプレッドシートに存在する売主・アクティブ契約ありの売主は影響を受けない（設計書 Preservation Requirements 参照）_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 バグ条件の探索テストが成功することを確認する
    - **Property 1: Expected Behavior** - executeSoftDelete がソフトデリートを実行する
    - **重要**: タスク1で書いた**同じテスト**を再実行する（新しいテストを書かない）
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが成功すれば、バグが修正されたことを確認できる
    - 修正後のコードでテストを実行 → **成功が期待される結果**（バグ修正を確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保全テストが引き続き成功することを確認する
    - **Property 2: Preservation** - スプレッドシートに存在する売主・アクティブ契約ありの売主が影響を受けない
    - **重要**: タスク2で書いた**同じテスト**を再実行する（新しいテストを書かない）
    - 修正後のコードでテストを実行 → **成功が期待される結果**（リグレッションなしを確認）
    - 全テストが成功することを確認する

- [x] 4. チェックポイント - 全テストが成功することを確認する
  - 全テストが成功することを確認する。疑問点があればユーザーに確認する。

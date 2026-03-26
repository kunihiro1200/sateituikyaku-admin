# 実装計画: buyer-latest-status-sync

## 概要

`BuyerViewingResultPage`の`handleInlineFieldSave`で`latest_status`フィールドを保存する際に`sync: false`から`sync: true`に変更することで、両画面からの更新がDBとスプレッドシートに確実に反映されるようにする。

## タスク

- [x] 1. BuyerViewingResultPageのlatest_status同期修正
  - `frontend/frontend/src/pages/BuyerViewingResultPage.tsx`の`handleInlineFieldSave`を修正する
  - `fieldName === 'latest_status'`の場合のみ`sync: true`を使用するよう条件分岐を追加する
  - 保存成功後に`setBuyer(result.buyer)`が呼ばれることを確認する（既存実装で対応済み）
  - _Requirements: 2.1, 2.3, 4.1_

  - [ ]* 1.1 Property 1のプロパティテストを作成する
    - **Property 1: 保存ラウンドトリップ**
    - `BuyerService.updateWithSync`で任意の`latest_status`値を保存後、DBから読み取ると同じ値が返ることを検証
    - `fast-check`の`fc.string()`を使用してランダムな文字列で100回テスト
    - **Validates: Requirements 1.1, 2.1**

  - [ ]* 1.2 Property 2のプロパティテストを作成する
    - **Property 2: 後勝ちルール**
    - 値Aを保存後に値Bを保存すると、DBの`latest_status`が値Bになることを検証
    - `fast-check`の`fc.string()`を2つ使用して100回テスト
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 2. スプレッドシート同期失敗時の動作確認
  - `BuyerViewingResultPage`で`sync: true`に変更後、同期失敗時に`syncStatus: 'pending'`が返ることを確認する
  - 既存の`BuyerService.updateWithSync`の実装（RetryHandler経由のpendingキュー）が正しく動作することを確認する
  - _Requirements: 4.2_

  - [ ]* 2.1 Property 3のプロパティテストを作成する
    - **Property 3: スプレッドシート同期失敗時のDB保存成功**
    - `BuyerWriteService.updateFields`をモックしてエラーを発生させた状態で、DBへの保存は成功し`syncStatus: 'pending'`が返ることを検証
    - `fast-check`の`fc.string()`を使用して100回テスト
    - **Validates: Requirements 4.2**

- [x] 3. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [x] 4. フロントエンドUIステート更新の確認
  - `BuyerViewingResultPage`の`handleInlineFieldSave`が`latest_status`保存後に`setBuyer(result.buyer)`を呼び出すことを確認する（既存実装で対応済み）
  - `BuyerDetailPage`の`handleInlineFieldSave`が既に`sync: true`で動作し、保存後に`setBuyer(result.buyer)`を呼び出すことを確認する（変更不要）
  - _Requirements: 5.1, 5.2_

  - [ ]* 4.1 Property 4のプロパティテストを作成する
    - **Property 4: 保存後UIステート更新**
    - `buyerApi.update`をモックして、`handleInlineFieldSave('latest_status', value)`呼び出し後に`setBuyer`が保存した値を含むオブジェクトで呼ばれることを検証
    - `fast-check`の`fc.string()`を使用して100回テスト
    - **Validates: Requirements 5.1, 5.2**

- [-] 5. デプロイ
  - 変更をコミットして`git push origin main`でデプロイする
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2_

## Notes

- タスク1が唯一の実質的なコード変更（`sync: false` → `sync: true`の条件分岐）
- バックエンド（`BuyerService.updateWithSync`）と`buyer-column-mapping.json`は変更不要
- `*`付きサブタスクはオプション（スキップ可能）
- デプロイは`git push origin main`で自動デプロイされる（`deploy-procedure.md`参照）

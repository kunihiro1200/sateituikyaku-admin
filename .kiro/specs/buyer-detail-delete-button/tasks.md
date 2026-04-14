# 実装計画：買主リスト詳細画面への削除ボタン追加

## 概要

BuyerDetailPageの削除ボタンを物理削除に変更する。バックエンドに `permanentDelete` メソッドと `/api/buyers/:id/permanent` エンドポイントを追加し、フロントエンドの削除ハンドラーとダイアログメッセージを更新する。

## タスク

- [x] 1. BuyerServiceに物理削除メソッドを追加
  - `backend/src/services/BuyerService.ts` に `permanentDelete(buyerId: string): Promise<void>` メソッドを追加
  - `DELETE FROM buyers WHERE buyer_id = $1` SQLを実行する実装
  - 対象レコードが存在しない場合はエラーをスロー
  - _Requirements: 3.1, 3.5_

  - [ ]* 1.1 BuyerService.permanentDeleteのプロパティテストを作成
    - **Property 1: 物理削除後のレコード不存在**
    - **Validates: Requirements 3.1, 3.5**
    - fast-checkを使用、numRuns: 100
    - `permanentDelete` 実行後、`includeDeleted=true` でも対象レコードが見つからないことを検証

  - [ ]* 1.2 BuyerService.permanentDeleteのプロパティテストを作成
    - **Property 2: 物理削除は論理削除と異なる**
    - **Validates: Requirements 3.5**
    - `permanentDelete` 実行後、`includeDeleted=true` で検索してもレコードが見つからないことを検証（論理削除との差異確認）

- [x] 2. バックエンドに物理削除エンドポイントを追加
  - `backend/src/routes/buyers.ts` に `DELETE /api/buyers/:id/permanent` ルートを追加
  - 既存の `authenticate` ミドルウェアを適用
  - `BuyerService.permanentDelete` を呼び出し、成功時は `{ success: true }` を返す
  - 404・500エラーハンドリングを実装
  - 既存の `DELETE /api/buyers/:id`（論理削除）は削除しない
  - _Requirements: 3.2_

  - [ ]* 2.1 エンドポイントの統合テストを作成
    - `DELETE /api/buyers/:id/permanent` が正常動作することを確認（代表的な1〜2ケース）
    - 認証なしアクセスで `401` が返ることを確認
    - _Requirements: 3.2_

- [x] 3. チェックポイント - 全テストがパスすることを確認
  - 全テストがパスすることを確認し、疑問点があればユーザーに確認する。

- [x] 4. BuyerDetailPageの削除ハンドラーとダイアログを更新
  - `frontend/frontend/src/pages/BuyerDetailPage.tsx` をPythonスクリプトでUTF-8書き込みにより変更
  - `handleDeleteBuyer` の呼び出し先を `/api/buyers/${buyer.buyer_id}` から `/api/buyers/${buyer.buyer_id}/permanent` に変更
  - 削除確認ダイアログのメッセージを「この買主ナンバーが完全に削除されます。スプシも１行削除忘れないように！！」に変更
  - 削除ボタンのUI（赤色・outlined・small・DeleteIcon・「削除」テキスト）は変更しない
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 3.4_

  - [ ]* 4.1 BuyerDetailPageの削除ダイアログのユニットテストを作成
    - 削除ボタンクリックでダイアログが開くことを確認
    - ダイアログに正しいメッセージが表示されることを確認
    - キャンセルボタンでダイアログが閉じることを確認
    - 削除成功後に `/buyers` へ遷移することを確認
    - 削除失敗時にスナックバーが表示されることを確認
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.3, 3.4_

- [x] 5. 最終チェックポイント - 全テストがパスすることを確認
  - 全テストがパスすることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` 付きタスクはオプションで、MVP優先の場合はスキップ可能
- `BuyerDetailPage.tsx` は日本語を含むため、変更はPythonスクリプトでUTF-8書き込みを使用すること
- `backend/api/` は触らず、`backend/src/` のみ変更すること
- 既存の `DELETE /api/buyers/:id`（論理削除）は削除しないこと

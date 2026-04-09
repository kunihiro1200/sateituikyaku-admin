# Implementation Plan: 買主リスト検索バーにメールアドレス検索機能を追加

## Overview

買主リスト一覧画面の検索バーに、メールアドレスでの検索機能を追加します。バックエンドの`BuyerService.search()`メソッドの検索条件に`email`フィールドを追加するだけのシンプルな実装です。フロントエンドの変更は不要です。

## Tasks

- [x] 1. BuyerService.search()メソッドにメールアドレス検索を追加
  - `backend/src/services/BuyerService.ts`の`search()`メソッドを修正
  - 数字のみのクエリ（`isNumericOnly === true`）の場合：`partialMatch`クエリの`.or()`条件に`email.ilike.%${query}%`を追加
  - 文字列を含むクエリ（`isNumericOnly === false`）の場合：`.or()`条件に`email.ilike.%${query}%`を追加
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ]* 1.1 メールアドレス検索のユニットテストを作成
  - 完全なメールアドレスで検索するテスト
  - メールアドレスの一部（ドメイン名など）で検索するテスト
  - 大文字小文字を区別しない検索のテスト
  - _Requirements: 1.3_

- [ ]* 1.2 既存機能の回帰テストを実行
  - 買主番号検索が正常に動作することを確認
  - 名前検索が正常に動作することを確認
  - 電話番号検索が正常に動作することを確認
  - 物件番号検索が正常に動作することを確認
  - _Requirements: 1.5_

- [x] 2. Checkpoint - ローカル環境でテスト
  - Postmanまたはcurlで`/api/buyers/search?q=test@example.com`をテスト
  - 検索結果が正しく返されることを確認
  - 既存の検索機能が正常に動作することを確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Vercelにデプロイ
  - `backend`プロジェクトをデプロイ
  - デプロイ完了を確認
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 4. 本番環境で動作確認
  - 本番環境の買主リスト画面でメールアドレス検索をテスト
  - 既存の検索機能が正常に動作することを確認
  - 検索パフォーマンスが500ms以内であることを確認
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- タスク1.1と1.2は`*`マークが付いているため、オプションです（スキップ可能）
- 各タスクは具体的な要件番号を参照しています
- フロントエンドの変更は不要です（既存の検索バーがそのまま使用可能）
- 検索パフォーマンス目標は500ms以内です

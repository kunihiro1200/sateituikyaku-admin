# Implementation Plan: 売主リストのテンプレートメッセージ条件分岐機能

## Overview

売主番号に基づいてテンプレートメッセージ内のプレースホルダー（`<<当社住所>>`、`<<売買実績ｖ>>`）を動的に置き換える機能を実装します。

## Tasks

- [x] 1. `replacePlaceholders`関数の実装
  - `frontend/frontend/src/utils/smsTemplateGenerators.ts`に`replacePlaceholders`関数を実装
  - 売主番号に「FI」が含まれるかを判定（大文字・小文字を区別しない）
  - `<<当社住所>>`を条件に応じて置換（福岡支店 or 大分本社）
  - `<<売買実績ｖ>>`を条件に応じて置換（空文字列 or URL）
  - エラーハンドリング（null/undefined/空文字列の売主番号）
  - デフォルト値で置換する`replaceWithDefaults`ヘルパー関数を実装
  - JSDocコメントを追加（サポートされているプレースホルダー一覧、条件分岐ロジック、使用例）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4_

- [x] 2. 既存テンプレート生成関数の更新
  - [x] 2.1 `generateInitialCancellationGuidance`に`replacePlaceholders`呼び出しを追加
    - メッセージ生成後、`replacePlaceholders(message, seller)`を呼び出す
    - 既存の動作を維持（後方互換性）
    - _Requirements: 4.1_
  
  - [x] 2.2 `generateCancellationGuidance`に`replacePlaceholders`呼び出しを追加
    - メッセージ生成後、`replacePlaceholders(message, seller)`を呼び出す
    - 既存の動作を維持（後方互換性）
    - _Requirements: 4.2_
  
  - [x] 2.3 `generateValuationSMS`に`replacePlaceholders`呼び出しを追加
    - メッセージ生成後、`replacePlaceholders(message, seller)`を呼び出す
    - 既存の動作を維持（後方互換性）
    - _Requirements: 4.3_
  
  - [x] 2.4 `generateVisitReminderSMS`に`replacePlaceholders`呼び出しを追加
    - メッセージ生成後、`replacePlaceholders(message, seller)`を呼び出す
    - 既存の動作を維持（後方互換性）
    - _Requirements: 4.4_
  
  - [x] 2.5 `generatePostVisitThankYouSMS`に`replacePlaceholders`呼び出しを追加
    - メッセージ生成後、`replacePlaceholders(message, seller)`を呼び出す
    - 既存の動作を維持（後方互換性）
    - _Requirements: 4.5_
  
  - [x] 2.6 `generateLongTermCustomerSMS`に`replacePlaceholders`呼び出しを追加
    - メッセージ生成後、`replacePlaceholders(message, seller)`を呼び出す
    - 既存の動作を維持（後方互換性）
    - _Requirements: 4.6_
  
  - [x] 2.7 `generateCallReminderSMS`に`replacePlaceholders`呼び出しを追加
    - メッセージ生成後、`replacePlaceholders(message, seller)`を呼び出す
    - 既存の動作を維持（後方互換性）
    - _Requirements: 4.7_

- [x] 3. Checkpoint - 実装完了確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. ユニットテストの実装
  - [x] 4.1 `replacePlaceholders`関数のユニットテストを実装
    - `frontend/frontend/src/utils/__tests__/smsTemplateGenerators.test.ts`を作成
    - 売主番号に「FI」が含まれる場合のテスト（福岡支店の住所）
    - 売主番号に「FI」が含まれない場合のテスト（大分本社の住所）
    - 売主番号がnullの場合のテスト（デフォルト値）
    - 売主番号が空文字列の場合のテスト（デフォルト値）
    - 売主オブジェクトがnullの場合のテスト（デフォルト値）
    - `[改行]`プレースホルダーが保持されることを確認
    - 未知のプレースホルダーがそのまま残ることを確認
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [ ]* 4.2 各テンプレート生成関数のユニットテストを更新
    - 既存のテストが引き続き動作することを確認
    - プレースホルダーが正しく置き換えられることを確認
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 5. プロパティベーステストの実装
  - [ ]* 5.1 fast-checkをインストール
    - `npm install --save-dev fast-check`を実行
    - `frontend/frontend/package.json`に追加されることを確認
  
  - [ ]* 5.2 Property 1のテストを実装
    - **Property 1: 当社住所プレースホルダーの条件分岐**
    - **Validates: Requirements 1.1, 1.2**
    - `frontend/frontend/src/utils/__tests__/smsTemplateGenerators.property.test.ts`を作成
    - 任意の売主オブジェクトに対して、売主番号に「FI」が含まれる場合は福岡支店の住所、含まれない場合は大分本社の住所に置き換えられることを検証
    - 100回のイテレーションを設定
  
  - [ ]* 5.3 Property 2のテストを実装
    - **Property 2: 売買実績プレースホルダーの条件分岐**
    - **Validates: Requirements 2.1, 2.2**
    - 任意の売主オブジェクトに対して、売主番号に「FI」が含まれる場合は空文字列、含まれない場合は売買実績URLに置き換えられることを検証
    - 100回のイテレーションを設定
  
  - [ ]* 5.4 Property 3のテストを実装
    - **Property 3: 大文字・小文字を区別しない検索**
    - **Validates: Requirements 1.3, 2.3**
    - 「FI」「fi」「Fi」「fI」のいずれの大文字・小文字の組み合わせでも、同じ条件分岐結果が得られることを検証
    - 100回のイテレーションを設定
  
  - [ ]* 5.5 Property 4のテストを実装
    - **Property 4: 全てのプレースホルダーを検出して置き換える**
    - **Validates: Requirements 3.2**
    - 複数のプレースホルダーが含まれる場合、全てのプレースホルダーが正しく置き換えられることを検証
    - 100回のイテレーションを設定
  
  - [ ]* 5.6 Property 5のテストを実装
    - **Property 5: `[改行]`プレースホルダーを保持する**
    - **Validates: Requirements 3.4, 5.2**
    - `[改行]`プレースホルダーが含まれる場合、そのまま保持されることを検証
    - 100回のイテレーションを設定
  
  - [ ]* 5.7 Property 6のテストを実装
    - **Property 6: 未知のプレースホルダーをそのまま残す**
    - **Validates: Requirements 3.5**
    - 未知のプレースホルダーが含まれる場合、そのまま残されることを検証
    - 100回のイテレーションを設定
  
  - [ ]* 5.8 Property 7のテストを実装
    - **Property 7: 各テンプレート生成関数でプレースホルダー置換を実行する**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**
    - 全てのテンプレート生成関数でプレースホルダーが正しく置き換えられることを検証
    - 100回のイテレーションを設定
  
  - [ ]* 5.9 Property 8のテストを実装
    - **Property 8: プレースホルダーが含まれないメッセージは変更しない**
    - **Validates: Requirements 5.1**
    - プレースホルダーが含まれないメッセージは変更されないことを検証
    - 100回のイテレーションを設定
  
  - [ ]* 5.10 Property 9のテストを実装
    - **Property 9: 例外を発生させない**
    - **Validates: Requirements 7.3**
    - 任意の入力に対して例外を発生させないことを検証
    - 100回のイテレーションを設定
  
  - [ ]* 5.11 Property 10のテストを実装
    - **Property 10: エラー時は元のメッセージを返す**
    - **Validates: Requirements 7.4**
    - 内部エラーが発生した場合、元のメッセージをそのまま返すことを検証
    - 100回のイテレーションを設定

- [x] 6. Checkpoint - テスト完了確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. 統合テスト
  - [x] 7.1 CallModePageでテンプレートメッセージを生成
    - 売主番号に「FI」が含まれる売主でテスト
    - 売主番号に「FI」が含まれない売主でテスト
    - プレースホルダーが正しく置き換えられることを確認
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 7.2 既存の機能が壊れていないことを確認
    - 既存のテンプレートメッセージが正しく生成されることを確認
    - プレースホルダーが含まれないメッセージが変更されていないことを確認
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8. Final checkpoint - 全テスト完了確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- タスク5（プロパティベーステスト）は`*`マークが付いており、オプションです
- タスク4.2（既存テストの更新）も`*`マークが付いており、オプションです
- 各タスクは要件定義書の要件番号を参照しています
- Checkpointタスクで進捗を確認し、問題があればユーザーに質問してください
- プロパティベーステストは100回のイテレーションを設定してください
- 既存の`convertLineBreaks()`関数は呼び出し側（CallModePage）で実行されるため、生成関数内では実行しません

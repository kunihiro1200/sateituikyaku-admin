# 実装計画: 物件リスト報告ページに「報告_メモ」フィールドを追加

## 概要

物件リスト報告ページ（PropertyReportPage.tsx）に「報告_メモ」フィールドを追加する機能の実装計画です。このフィールドは報告業務に関する補足情報を記録するためのデータベース専用フィールドで、スプレッドシート同期の対象外とします。

## タスク

- [x] 1. データベーススキーマの更新
  - マイグレーションファイルを作成して `property_listings` テーブルに `report_memo` カラムを追加
  - カラム仕様: TEXT型、NULL許可、デフォルト値NULL
  - _要件: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. フロントエンド: ReportData インターフェースの更新
  - [x] 2.1 PropertyReportPage.tsx の ReportData インターフェースに `report_memo?: string` を追加
    - _要件: 2.1, 2.2_
  
  - [ ]* 2.2 ReportData インターフェースの型定義テストを作成
    - report_memo フィールドが存在することを確認
    - _要件: 2.1_

- [x] 3. フロントエンド: UIフィールドの追加
  - [x] 3.1 PropertyReportPage.tsx に「報告_メモ」入力フィールドを追加
    - SUUMO URLフィールドの下に配置
    - TextField multiline（最小3行、最大10行）
    - プレースホルダー: 「報告に関するメモを入力...」
    - _要件: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [x] 3.2 fetchData() メソッドで report_memo を取得して表示
    - APIレスポンスから report_memo を取得
    - NULL の場合は空文字列として表示
    - _要件: 2.7, 2.8_
  
  - [x] 3.3 変更検知ロジックに report_memo を追加
    - hasChanges の計算に report_memo を含める
    - _要件: 3.5_

- [x] 4. フロントエンド: 保存機能の実装
  - [x] 4.1 handleSave() メソッドで report_memo を保存
    - PUT リクエストのボディに report_memo を含める
    - 空文字列の場合は null として送信
    - _要件: 3.1, 3.2, 5.4_
  
  - [x] 4.2 保存成功・失敗時のメッセージ表示
    - 成功: 「報告情報を保存しました」
    - 失敗: 「保存に失敗しました」
    - _要件: 3.3, 3.4_

- [x] 5. バックエンド: API対応の確認
  - [x] 5.1 PropertyListingService.getByPropertyNumber() が report_memo を返すことを確認
    - 既存実装で自動的に対応されているはず
    - _要件: 5.1, 6.2, 6.3_
  
  - [x] 5.2 PropertyListingService.update() が report_memo を受け取ることを確認
    - 既存実装で自動的に対応されているはず（Record<string, any>）
    - _要件: 5.2, 5.3_

- [x] 6. スプレッドシート同期の除外確認
  - [x] 6.1 property-listing-column-mapping.json に report_memo のマッピングが存在しないことを確認
    - マッピングが存在する場合は削除
    - _要件: 4.2_
  
  - [x] 6.2 PropertyListingService.syncToSpreadsheet() が report_memo をスキップすることを確認
    - 既存実装で自動的にスキップされるはず（マッピングがないため）
    - _要件: 4.3, 4.5_

- [x] 7. Checkpoint - 基本機能の動作確認
  - 全てのテストがパスすることを確認
  - ブラウザで報告ページを開いて report_memo フィールドが表示されることを確認
  - report_memo を入力して保存できることを確認

- [ ]* 8. プロパティベーステスト: ラウンドトリップ
  - [ ]* 8.1 Property 1: 報告メモのラウンドトリップテストを作成
    - **Property 1: 報告メモのラウンドトリップ**
    - **Validates: Requirements 2.7, 3.1, 5.1, 5.2, 5.3**
    - ランダムなメモテキストを保存して取得し、同じ値が返されることを確認
    - fast-check を使用（100回実行）
    - _要件: 2.7, 3.1, 5.1, 5.2, 5.3_

- [ ]* 9. プロパティベーステスト: 複数フィールドの同時保存
  - [ ]* 9.1 Property 2: 複数フィールドの同時保存テストを作成
    - **Property 2: 複数フィールドの同時保存**
    - **Validates: Requirements 3.2**
    - report_date、report_completed、report_assignee、suumo_url、report_memo を同時に更新
    - 全てのフィールドが正しく保存されることを確認
    - fast-check を使用（100回実行）
    - _要件: 3.2_

- [ ]* 10. プロパティベーステスト: スプレッドシート同期の除外
  - [ ]* 10.1 Property 3: スプレッドシート同期の除外テストを作成
    - **Property 3: スプレッドシート同期の除外**
    - **Validates: Requirements 4.1, 4.3, 4.5**
    - report_memo を保存後、スプレッドシートに書き込まれないことを確認
    - fast-check を使用（100回実行）
    - _要件: 4.1, 4.3, 4.5_

- [ ]* 11. プロパティベーステスト: スプレッドシート同期後の保持
  - [ ]* 11.1 Property 4: スプレッドシート同期後の保持テストを作成
    - **Property 4: スプレッドシート同期後の保持**
    - **Validates: Requirements 4.4**
    - report_memo を保存後、スプレッドシート→DB同期を実行
    - report_memo の値が変更されずに保持されることを確認
    - fast-check を使用（100回実行）
    - _要件: 4.4_

- [ ]* 12. プロパティベーステスト: 最大長制限なし
  - [ ]* 12.1 Property 5: 最大長制限なしテストを作成
    - **Property 5: 最大長制限なし**
    - **Validates: Requirements 5.5**
    - 10,000文字以上の長いテキストを保存
    - エラーなく保存され、完全なテキストが返されることを確認
    - fast-check を使用（100回実行）
    - _要件: 5.5_

- [ ]* 13. ユニットテスト: データベーススキーマ
  - [ ]* 13.1 report_memo カラムの存在確認テスト
    - _要件: 1.1_
  
  - [ ]* 13.2 report_memo カラムの型確認テスト（TEXT型）
    - _要件: 1.2_
  
  - [ ]* 13.3 report_memo カラムのNULL許可確認テスト
    - _要件: 1.3_
  
  - [ ]* 13.4 report_memo カラムのデフォルト値確認テスト（NULL）
    - _要件: 1.4_
  
  - [ ]* 13.5 既存レコードの report_memo がNULLであることを確認
    - _要件: 6.1_

- [ ]* 14. ユニットテスト: エッジケース
  - [ ]* 14.1 report_memo がNULLの場合の表示テスト
    - 空のテキストフィールドが表示されることを確認
    - _要件: 2.8, 6.2_
  
  - [ ]* 14.2 report_memo がNULLの場合のAPI応答テスト
    - APIが正常にNULLを返すことを確認
    - _要件: 6.3_
  
  - [ ]* 14.3 report_memo が空文字列の場合の保存テスト
    - NULLとして保存されることを確認
    - _要件: 5.4_

- [ ]* 15. 統合テスト: スプレッドシート同期
  - [ ]* 15.1 column-mapping.json に report_memo のマッピングが存在しないことを確認
    - _要件: 4.2_

- [x] 16. Final Checkpoint - 全機能の統合テスト
  - 全てのテストがパスすることを確認
  - ブラウザで以下のシナリオをテスト:
    1. 報告ページを開いて report_memo フィールドが表示される
    2. report_memo を入力して保存できる
    3. ページをリロードして report_memo が保持されている
    4. report_memo を空にして保存できる（NULLとして保存）
    5. 他の報告情報（報告日、報告完了、報告担当、SUUMO URL）と同時に保存できる
  - スプレッドシートに report_memo が書き込まれていないことを確認
  - 既存機能（送信履歴、買主一覧）が正常に動作することを確認

## 注意事項

- タスク8-15（プロパティベーステスト、ユニットテスト）は `*` マークが付いているため、オプションです
- fast-check のインストールが必要な場合: `npm install --save-dev fast-check @types/fast-check`
- テスト用物件（TEST_PROPERTY_001-005）は各テストの前後でクリーンアップすること
- スプレッドシート同期のテスト（Property 3, 4）では、テスト専用シートを使用するか、モックを使用すること

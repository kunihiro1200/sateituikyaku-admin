# 実装タスク

## 1. バグ条件探索テスト（修正前に実行）

- [x] 1. バグ条件探索テストを作成・実行
  - **Property 1: Bug Condition** - フィールド名不一致によるバグ
  - **重要**: このテストは修正前のコードで実行し、失敗を確認する
  - **失敗が期待される**: 修正前のコードでバグが存在することを確認するため
  - **目的**: 根本原因分析を確認または反証する
  - **スコープ付きPBTアプローチ**: 買主番号7260の具体的な失敗ケースに焦点を当てる
  - テスト内容:
    - 買主番号7260の詳細ページで「業者向けアンケート」フィールドが表示されない
    - フロントエンドが `broker_survey` を参照しているが、APIレスポンスには `vendor_survey` しか含まれない
    - 新規買主ページで「業者向けアンケート」を保存する際、`broker_survey` フィールド名でデータが送信される
  - 修正前のコードで実行し、失敗を観察する
  - 失敗例を記録（例: 「買主7260の詳細ページで `buyer?.broker_survey` が `undefined` のため、フィールドが非表示」）
  - タスク完了条件: テストが作成され、実行され、失敗が記録されたら完了
  - _Requirements: 1.1, 1.2, 1.3_

## 2. 保存プロパティテスト（修正前に実行）

- [x] 2. 保存プロパティテストを作成・実行（修正前）
  - **Property 2: Preservation** - 他のフィールドの動作保持
  - **重要**: 観察優先の方法論に従う
  - 修正前のコードで他のフィールド（問合時ヒアリング、初動担当、Pinrichなど）の動作を観察する
  - 観察した動作パターンを捕捉するプロパティベーステストを作成する
  - プロパティベーステストは多くのテストケースを自動生成し、より強力な保証を提供する
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが成功する（ベースライン動作を確認）
  - タスク完了条件: テストが作成され、実行され、修正前のコードで成功したら完了
  - _Requirements: 3.1, 3.2, 3.3_

## 3. フィールド名の統一修正

- [x] 3.1 BuyerDetailPage.tsxのフィールド名を修正
  - フィールド定義の修正: `broker_survey` → `vendor_survey`
    - 行150: `'broker_survey'` → `'vendor_survey'`
    - 行163: `{ key: 'broker_survey', ...}` → `{ key: 'vendor_survey', ...}`
  - 条件付き表示ロジックの修正: `buyer?.broker_survey` → `buyer?.vendor_survey`
    - 行2011: `if (field.key === 'broker_survey')` → `if (field.key === 'vendor_survey')`
    - 行2013: `if (!buyer?.broker_survey || !String(buyer.broker_survey).trim())` → `if (!buyer?.vendor_survey || !String(buyer.vendor_survey).trim())`
    - 行2018: `const isUmi = buyer?.broker_survey === '未';` → `const isUmi = buyer?.vendor_survey === '未';`
  - _Bug_Condition: isBugCondition(code) where code.contains('broker_survey') AND code.fileType = 'BuyerDetailPage.tsx'_
  - _Expected_Behavior: フロントエンドが vendor_survey フィールド名を使用し、データベースから取得した値を正しく表示する_
  - _Preservation: 他のフィールド（問合時ヒアリング、初動担当など）の表示・編集機能が変更されない_
  - _Requirements: 2.1, 2.3, 3.1, 3.2_

- [x] 3.2 NewBuyerPage.tsxのフィールド名を修正
  - フィールド定義の修正: `broker_survey` → `vendor_survey`
    - 行91: `{ key: 'broker_survey', ...}` → `{ key: 'vendor_survey', ...}`
  - 条件付き表示ロジックの修正: `broker_survey` → `vendor_survey`
    - 行640: `if (field.key === 'broker_survey' && (!value || value.trim() === ''))` → `if (field.key === 'vendor_survey' && (!value || value.trim() === ''))`
  - データ送信時のフィールド名修正: `broker_survey` → `vendor_survey`
    - 行304: `broker_survey: vendorSurvey || null,` → `vendor_survey: vendorSurvey || null,`
  - _Bug_Condition: isBugCondition(code) where code.contains('broker_survey') AND code.fileType = 'NewBuyerPage.tsx'_
  - _Expected_Behavior: フロントエンドが vendor_survey フィールド名を使用し、データベースに正しく保存する_
  - _Preservation: 他のフィールドの保存機能が変更されない_
  - _Requirements: 2.2, 3.1, 3.2_

- [x] 3.3 型定義ファイルの修正（存在する場合）
  - `frontend/frontend/src/types/index.ts` の Buyer型を確認
  - `broker_survey` → `vendor_survey` に修正
  - _Bug_Condition: isBugCondition(code) where code.contains('broker_survey') AND code.fileType = 'types/index.ts'_
  - _Expected_Behavior: 型定義が vendor_survey を使用する_
  - _Preservation: 他の型定義が変更されない_
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3.4 バグ条件探索テストを再実行（修正後）
  - **Property 1: Expected Behavior** - フィールド名統一後の正常動作
  - **重要**: タスク1で作成したテストを再実行する（新しいテストを作成しない）
  - タスク1のテストが期待される動作を検証する
  - テストが成功することを確認（バグが修正されたことを確認）
  - **期待される結果**: テストが成功する（バグが修正されたことを確認）
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3.5 保存プロパティテストを再実行（修正後）
  - **Property 2: Preservation** - 他のフィールドの動作保持
  - **重要**: タスク2で作成したテストを再実行する（新しいテストを作成しない）
  - タスク2のテストを修正後のコードで実行する
  - **期待される結果**: テストが成功する（リグレッションがないことを確認）
  - 全てのテストが引き続き成功することを確認（リグレッションなし）

## 4. チェックポイント - 全テスト成功確認

- [x] 4. 全テスト成功確認
  - 全てのテストが成功することを確認
  - 買主番号7260の詳細ページで「業者向けアンケート」フィールドが正しく表示されることを確認
  - 新規買主ページで「業者向けアンケート」フィールドが正しく保存されることを確認
  - 他のフィールドが引き続き正しく動作することを確認
  - 質問があればユーザーに確認する

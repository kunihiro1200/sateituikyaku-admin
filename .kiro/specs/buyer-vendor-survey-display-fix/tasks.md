# 実装タスク

## 1. バグ条件探索テスト（修正前に実行）

- [x] 1.1 バグ条件1探索テストを作成・実行（業者向けアンケート表示問題）
  - **Property 1: Bug Condition 1** - フィールド名不一致によるバグ
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

- [x] 1.2 バグ条件2探索テストを作成・実行（持家ヒアリング結果の誤必須問題）
  - **Property 2: Bug Condition 2** - 空白文字のみの値を「値あり」と誤判定
  - **重要**: このテストは修正前のコードで実行し、失敗を確認する
  - **失敗が期待される**: 修正前のコードでバグが存在することを確認するため
  - **目的**: 根本原因分析を確認または反証する
  - **スコープ付きPBTアプローチ**: 買主番号7267の具体的な失敗ケースに焦点を当てる
  - テスト内容:
    - 買主番号7267の詳細ページで「問合時持家ヒアリング」が完全に空欄なのに「持家ヒアリング結果」が必須扱いになる
    - データベースの `owned_home_hearing_inquiry` に空白文字のみが保存されている
    - `isHomeHearingResultRequired()` 関数が空白文字のみの値を「値あり」と判定している
  - 修正前のコードで実行し、失敗を観察する
  - 失敗例を記録（例: 「買主7267で `owned_home_hearing_inquiry = '  '` の場合、`isHomeHearingResultRequired()` が `true` を返す」）
  - タスク完了条件: テストが作成され、実行され、失敗が記録されたら完了
  - _Requirements: 1.4, 1.5, 1.6_

## 2. 保存プロパティテスト（修正前に実行）

- [x] 2. 保存プロパティテストを作成・実行（修正前）
  - **Property 3: Preservation** - 他のフィールドの動作保持
  - **重要**: 観察優先の方法論に従う
  - 修正前のコードで他のフィールド（問合時ヒアリング、初動担当、Pinrichなど）の動作を観察する
  - **「問合時持家ヒアリング」に実際に値が入力されている買主では、「持家ヒアリング結果」が必須扱いになる**ことを確認（正常な条件付き必須動作）
  - 観察した動作パターンを捕捉するプロパティベーステストを作成する
  - プロパティベーステストは多くのテストケースを自動生成し、より強力な保証を提供する
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが成功する（ベースライン動作を確認）
  - タスク完了条件: テストが作成され、実行され、修正前のコードで成功したら完了
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

## 3. フィールド名の統一修正（問題1）

- [x] 3.1 BuyerDetailPage.tsxのフィールド名を修正
  - フィールド定義の修正: `broker_survey` → `vendor_survey`
    - 行150: `'broker_survey'` → `'vendor_survey'`
    - 行163: `{ key: 'broker_survey', ...}` → `{ key: 'vendor_survey', ...}`
  - 条件付き表示ロジックの修正: `buyer?.broker_survey` → `buyer?.vendor_survey`
    - 行2011: `if (field.key === 'broker_survey')` → `if (field.key === 'vendor_survey')`
    - 行2013: `if (!buyer?.broker_survey || !String(buyer.broker_survey).trim())` → `if (!buyer?.vendor_survey || !String(buyer.vendor_survey).trim())`
    - 行2018: `const isUmi = buyer?.broker_survey === '未';` → `const isUmi = buyer?.vendor_survey === '未';`
  - _Bug_Condition: isBugCondition1(code) where code.contains('broker_survey') AND code.fileType = 'BuyerDetailPage.tsx'_
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
  - _Bug_Condition: isBugCondition1(code) where code.contains('broker_survey') AND code.fileType = 'NewBuyerPage.tsx'_
  - _Expected_Behavior: フロントエンドが vendor_survey フィールド名を使用し、データベースに正しく保存する_
  - _Preservation: 他のフィールドの保存機能が変更されない_
  - _Requirements: 2.2, 3.1, 3.2_

- [x] 3.3 型定義ファイルの修正（存在する場合）
  - `frontend/frontend/src/types/index.ts` の Buyer型を確認
  - `broker_survey` → `vendor_survey` に修正
  - _Bug_Condition: isBugCondition1(code) where code.contains('broker_survey') AND code.fileType = 'types/index.ts'_
  - _Expected_Behavior: 型定義が vendor_survey を使用する_
  - _Preservation: 他の型定義が変更されない_
  - _Requirements: 2.1, 2.2, 2.3_

## 4. 持家ヒアリング結果の必須判定ロジック修正（問題2）

- [x] 4.1 BuyerDetailPage.tsxの`isHomeHearingResultRequired()`関数を修正
  - 現在の実装（行248-251）を修正:
    ```typescript
    // 修正前
    const isHomeHearingResultRequired = (data: any): boolean => {
      return !!(data.owned_home_hearing_inquiry && String(data.owned_home_hearing_inquiry).trim());
    };
    
    // 修正後
    const isHomeHearingResultRequired = (data: any): boolean => {
      if (!data.owned_home_hearing_inquiry) return false;
      const trimmed = String(data.owned_home_hearing_inquiry).trim();
      return trimmed.length > 0;
    };
    ```
  - _Bug_Condition: isBugCondition2(data) where data.owned_home_hearing_inquiry contains only whitespace_
  - _Expected_Behavior: 空白文字のみの値を「空欄」として正しく判定し、false を返す_
  - _Preservation: 実際に値が入力されている場合は引き続き必須扱いになる_
  - _Requirements: 2.4, 2.5, 3.4_

- [ ]* 4.2 BuyerService.tsにデータクリーンアップ処理を追加（オプション）
  - 買主データ取得後、空白文字のみのフィールドをnullに正規化
  - ```typescript
    if (buyer.owned_home_hearing_inquiry && String(buyer.owned_home_hearing_inquiry).trim() === '') {
      buyer.owned_home_hearing_inquiry = null;
    }
    ```
  - _Expected_Behavior: データベースから取得した空白文字のみの値を自動的にクリーンアップ_
  - _Preservation: 実際に値が入力されているフィールドは変更されない_
  - _Requirements: 2.6_
  - **注意**: このタスクはオプションです。フロントエンドのバリデーションロジック修正（タスク4.1）だけでも問題は解決します。

## 5. バグ条件探索テストを再実行（修正後）

- [x] 5.1 バグ条件1探索テストを再実行（修正後）
  - **Property 1: Expected Behavior** - フィールド名統一後の正常動作
  - **重要**: タスク1.1で作成したテストを再実行する（新しいテストを作成しない）
  - タスク1.1のテストが期待される動作を検証する
  - テストが成功することを確認（バグが修正されたことを確認）
  - **期待される結果**: テストが成功する（バグが修正されたことを確認）
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 5.2 バグ条件2探索テストを再実行（修正後）
  - **Property 2: Expected Behavior** - 空白文字のみの値を空欄として正しく判定
  - **重要**: タスク1.2で作成したテストを再実行する（新しいテストを作成しない）
  - タスク1.2のテストが期待される動作を検証する
  - テストが成功することを確認（バグが修正されたことを確認）
  - **期待される結果**: テストが成功する（バグが修正されたことを確認）
  - _Requirements: 2.4, 2.5, 2.6_

- [x] 5.3 保存プロパティテストを再実行（修正後）
  - **Property 3: Preservation** - 他のフィールドの動作保持
  - **重要**: タスク2で作成したテストを再実行する（新しいテストを作成しない）
  - タスク2のテストを修正後のコードで実行する
  - **期待される結果**: テストが成功する（リグレッションがないことを確認）
  - 全てのテストが引き続き成功することを確認（リグレッションなし）

## 6. チェックポイント - 全テスト成功確認

- [x] 6. 全テスト成功確認
  - 全てのテストが成功することを確認
  - 買主番号7260の詳細ページで「業者向けアンケート」フィールドが正しく表示されることを確認
  - 買主番号7267の詳細ページで「問合時持家ヒアリング」が空欄の場合、「持家ヒアリング結果」が必須扱いにならないことを確認
  - 新規買主ページで「業者向けアンケート」フィールドが正しく保存されることを確認
  - 他のフィールドが引き続き正しく動作することを確認
  - 質問があればユーザーに確認する

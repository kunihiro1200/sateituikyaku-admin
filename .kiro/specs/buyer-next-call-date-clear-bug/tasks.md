# 実装計画

- [x] 1. バグ条件探索テストを作成
  - **Property 1: Bug Condition** - 次電日削除時の保存処理
  - **重要**: このテストは未修正のコードで実行し、失敗することを確認する
  - **失敗は正常**: テストの失敗がバグの存在を証明する
  - **目的**: バグを実証する反例を収集し、根本原因を確認する
  - **スコープ付きPBTアプローチ**: 決定的なバグのため、具体的な失敗ケースにプロパティをスコープする
  - テスト実装の詳細（design.mdのBug Conditionより）:
    - 次電日フィールドで元の値が`null`または有効な日付で、新しい値が空文字の場合
    - `handleBlur`関数が保存処理をスキップせず、DBに`null`を保存することを検証
    - isBugCondition: `fieldName = "next_call_date" AND fieldType = "date" AND (originalValue = null OR originalValue != "") AND newValue = ""`
  - 未修正のコードで実行
  - **期待される結果**: テストが失敗する（これがバグの証明）
  - 反例を記録（例: 「次電日を削除してもcancelEdit()が呼ばれ、保存されない」）
  - タスク完了条件: テストを作成し、実行し、失敗を記録したら完了
  - _Requirements: 1.1, 1.2_

- [x] 2. 保存検証プロパティテストを作成（修正前）
  - **Property 2: Preservation** - 非日付フィールドの動作維持
  - **重要**: 観察優先の方法論に従う
  - 未修正のコードで非バグ入力（isBugConditionがfalseを返すケース）の動作を観察
  - 観察した動作パターンを捕捉するプロパティベーステストを作成（design.mdのPreservation Requirementsより）
  - プロパティベーステストにより多数のテストケースを自動生成し、より強力な保存保証を提供
  - 未修正のコードでテストを実行
  - **期待される結果**: テストが成功する（ベースライン動作を確認）
  - タスク完了条件: テストを作成し、未修正のコードで成功することを確認したら完了
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3. 次電日削除バグの修正

  - [x] 3.1 handleBlur関数の修正を実装
    - `frontend/frontend/src/components/InlineEditableField.tsx`の`handleBlur`関数（lines 138-149）を修正
    - 日付フィールドの特別処理を追加: 空文字と`null`を区別して比較
    - 元の値が`null`または有効な日付で、新しい値が空文字の場合は「削除」として保存処理を実行
    - 元の値が空文字で新しい値も空文字の場合は「変更なし」として保存処理をスキップ
    - 日付フィールド以外のフィールドでは既存の比較ロジックを維持
    - _Bug_Condition: `isBugCondition(input)` where `input.fieldName = "next_call_date" AND input.fieldType = "date" AND (input.originalValue = null OR input.originalValue != "") AND input.newValue = ""`_
    - _Expected_Behavior: `result.saved = true AND result.dbValue = null AND no_cancel_edit_called(result)` from design_
    - _Preservation: 日付フィールド以外のフィールド、または日付フィールドでも実際に変更がない場合の既存動作を維持（Preservation Requirements from design）_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 バグ条件探索テストが成功することを確認
    - **Property 1: Expected Behavior** - 次電日削除時の保存処理
    - **重要**: タスク1で作成した同じテストを再実行する - 新しいテストを作成しない
    - タスク1のテストは期待動作をエンコードしている
    - このテストが成功すれば、期待動作が満たされていることを確認
    - タスク1のバグ条件探索テストを実行
    - **期待される結果**: テストが成功する（バグが修正されたことを確認）
    - _Requirements: Expected Behavior Properties from design (2.1, 2.2)_

  - [x] 3.3 保存検証テストが引き続き成功することを確認
    - **Property 2: Preservation** - 非日付フィールドの動作維持
    - **重要**: タスク2で作成した同じテストを再実行する - 新しいテストを作成しない
    - タスク2の保存検証プロパティテストを実行
    - **期待される結果**: テストが成功する（リグレッションがないことを確認）
    - 修正後も全てのテストが成功することを確認（リグレッションなし）

- [x] 4. チェックポイント - 全てのテストが成功することを確認
  - 全てのテストが成功することを確認し、疑問が生じた場合はユーザーに質問する

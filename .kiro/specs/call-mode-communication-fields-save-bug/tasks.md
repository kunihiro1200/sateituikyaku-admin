# Implementation Plan

## 問題1: コミュニケーション情報フィールドの保存エラー

- [x] 1. バグ条件探索テスト（修正前のコードでバグを再現）
  - **Property 1: Bug Condition** - コミュニケーション情報フィールドの保存失敗
  - **CRITICAL**: このテストは修正前のコードで実行し、バグの存在を確認する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしており、修正後にパスすることで修正を検証する
  - **GOAL**: バグが存在することを示す具体例を発見する
  - **Scoped PBT Approach**: 決定的なバグのため、具体的な失敗ケースにプロパティをスコープして再現性を確保
  - テスト実装の詳細（Bug Conditionから）:
    - 通話モードページで「電話担当（任意）」フィールドを編集
    - 通話モードページで「連絡取りやすい日、時間帯」フィールドを編集
    - 通話モードページで「連絡方法」フィールドを編集
  - テストアサーションはExpected Behavior Propertiesと一致させる:
    - 1秒後にデータベースに自動保存される
    - スプレッドシートに即時同期される
  - 修正前のコードでテストを実行
  - **EXPECTED OUTCOME**: テストが失敗する（これは正しい - バグの存在を証明）
  - 反例を記録して根本原因を理解する:
    - APIリクエストに`phoneContactPerson`フィールドが含まれていない
    - バックエンドで`phone_contact_person`、`preferred_contact_time`、`contact_method`が処理されていない
    - データベースに値が保存されていない
  - テストが書かれ、実行され、失敗が記録されたらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. 保存テスト（修正前のコードで既存動作を観察）
  - **Property 2: Preservation** - 他のフィールドの保存処理
  - **IMPORTANT**: 観察優先の方法論に従う
  - 修正前のコードで非バグ入力の動作を観察:
    - ステータスフィールドを「追客中」から「専任媒介」に変更 → 既存の保存処理が実行される
    - コメント欄にテキストを入力 → 既存の保存処理が実行される
    - 「1番電話」フィールドを編集 → 既存の自動保存処理が実行される
  - Preservation Requirementsから観察された動作パターンを捉えるプロパティベーステストを作成
  - プロパティベーステストは多数のテストケースを生成し、より強力な保証を提供
  - 修正前のコードでテストを実行
  - **EXPECTED OUTCOME**: テストがパスする（ベースライン動作を確認）
  - テストが書かれ、実行され、修正前のコードでパスしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. コミュニケーション情報フィールド保存バグの修正

  - [x] 3.1 フロントエンド修正（CallModePage.tsx）
    - APIリクエストに`phoneContactPerson`フィールドを追加
    - 1088行目付近の自動保存処理（useEffect）を修正:
      ```typescript
      await api.put(`/api/sellers/${id}`, {
        phoneContactPerson: editedPhoneContactPerson || null, // ✅ 追加
        preferredContactTime: editedPreferredContactTime || null,
        contactMethod: editedContactMethod || null,
        firstCallPerson: editedFirstCallPerson || null,
      });
      ```
    - _Bug_Condition: isBugCondition(input) where input.page === '/sellers/:id/call' AND input.fieldName IN ['phoneContactPerson', 'preferredContactTime', 'contactMethod']_
    - _Expected_Behavior: 1秒後にデータベースに自動保存され、スプレッドシートに即時同期される_
    - _Preservation: 他のフィールド（ステータス、コメント、1番電話等）の保存処理は変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 バックエンド修正（SellerService.supabase.ts）
    - `updateSeller()`メソッド（453行目付近）に3つのフィールドの処理を追加
    - `firstCallPerson`の処理（715行目付近）の直後に追加:
      ```typescript
      // コミュニケーション情報フィールド
      if ((data as any).phoneContactPerson !== undefined) {
        updates.phone_contact_person = (data as any).phoneContactPerson;
      }
      if ((data as any).preferredContactTime !== undefined) {
        updates.preferred_contact_time = (data as any).preferredContactTime;
      }
      if ((data as any).contactMethod !== undefined) {
        updates.contact_method = (data as any).contactMethod;
      }
      ```
    - _Bug_Condition: バックエンドで`phone_contact_person`、`preferred_contact_time`、`contact_method`が処理されていない_
    - _Expected_Behavior: バックエンドが3つのフィールドを正しく処理してデータベースに保存する_
    - _Preservation: 他のフィールドの処理は変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 スプレッドシート同期の確認（ColumnMapper.ts）
    - `mapToSheet()`メソッドでコミュニケーション情報フィールドのマッピングを確認
    - マッピングが欠落している場合は追加:
      - `phone_contact_person` → スプレッドシートの「電話担当（任意）」カラム
      - `preferred_contact_time` → スプレッドシートの「連絡取りやすい日、時間帯」カラム
      - `contact_method` → スプレッドシートの「連絡方法」カラム
    - 既存のコミュニケーション関連フィールドの近くに追加
    - _Expected_Behavior: データベース保存後、スプレッドシートに即時同期される_
    - _Preservation: 他のフィールドのマッピングは変更しない_
    - _Requirements: 2.4_

  - [x] 3.4 バグ条件探索テストの再実行（修正後）
    - **Property 1: Expected Behavior** - コミュニケーション情報フィールドの自動保存
    - **IMPORTANT**: タスク1と同じテストを再実行する - 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがパスすれば、期待される動作が満たされていることを確認
    - タスク1のバグ条件探索テストを再実行
    - **EXPECTED OUTCOME**: テストがパスする（バグが修正されたことを確認）
    - _Requirements: Expected Behavior Properties from design (2.1, 2.2, 2.3, 2.4)_

  - [x] 3.5 保存テストの再実行（修正後）
    - **Property 2: Preservation** - 他のフィールドの保存処理
    - **IMPORTANT**: タスク2と同じテストを再実行する - 新しいテストを書かない
    - タスク2の保存テストを再実行
    - **EXPECTED OUTCOME**: テストがパスする（リグレッションがないことを確認）
    - 修正後も全てのテストがパスすることを確認（リグレッションなし）

- [x] 4. チェックポイント - 問題1の全てのテストがパスすることを確認
  - 全てのテストがパスすることを確認し、疑問があればユーザーに質問する

---

## 問題2: 訪問予約の保存エラー

- [ ] 5. データベース調査（営担「K」の状態確認）
  - **Goal**: 営担「K」の`is_normal`と`is_active`の値を確認する
  - `employees`テーブルを確認:
    ```sql
    SELECT initials, name, is_normal, is_active 
    FROM employees 
    WHERE initials = 'K';
    ```
  - 営担「K」が無効な場合、ユーザーに以下を確認:
    - 営担「K」を有効にする（`is_normal=true`かつ`is_active=true`に変更）
    - 営担「K」をUIから除外する（無効なまま）
  - _Requirements: 1.5, 1.6_

- [ ] 6. バグ条件探索テスト（修正前のコードでバグを再現）
  - **Property 3: Bug Condition** - 訪問予約の保存失敗
  - **CRITICAL**: このテストは修正前のコードで実行し、バグの存在を確認する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしており、修正後にパスすることで修正を検証する
  - **GOAL**: バグが存在することを示す具体例を発見する
  - テスト実装の詳細（Bug Conditionから）:
    - 通話モードページで営担「K」を選択して訪問予約を保存
    - 400エラー「無効な営担です」が返されることを確認
  - 修正前のコードでテストを実行
  - **EXPECTED OUTCOME**: テストが失敗する（これは正しい - バグの存在を証明）
  - 反例を記録して根本原因を理解する:
    - 営担「K」が`is_normal=false`または`is_active=false`
    - バックエンドのバリデーションで拒否される
    - フロントエンドのUIに無効な営担が表示されている
  - テストが書かれ、実行され、失敗が記録されたらタスク完了とする
  - _Requirements: 1.5, 1.6, 1.7_

- [ ] 7. 訪問予約保存エラーの修正

  - [ ] 7.1 フロントエンド修正（CallModePage.tsx）
    - 営担選択UIで無効な従業員が表示されないようにフィルタリング
    - `getActiveEmployees()`関数が`is_normal=true`かつ`is_active=true`の従業員のみを取得しているか確認
    - 営担選択UIで無効な従業員をフィルタリング:
      ```typescript
      // 有効な従業員のみを取得
      const activeEmployees = employees.filter(emp => 
        emp.is_normal === true && emp.is_active === true
      );
      ```
    - _Bug_Condition: 無効な営担（`is_normal=false`または`is_active=false`）が選択肢に表示されている_
    - _Expected_Behavior: 有効な営担（`is_normal=true`かつ`is_active=true`）のみが選択肢に表示される_
    - _Preservation: 有効な営担での訪問予約保存処理は変更しない_
    - _Requirements: 2.6, 2.7_

  - [ ] 7.2 バックエンド確認（EmployeeService.ts）
    - `getActiveEmployees()`メソッドが`is_normal=true`かつ`is_active=true`の従業員のみを返すように確認
    - 必要に応じて修正:
      ```typescript
      const { data: employees } = await supabase
        .from('employees')
        .select('*')
        .eq('is_normal', true)
        .eq('is_active', true);
      ```
    - _Expected_Behavior: バックエンドが有効な従業員のみを返す_
    - _Preservation: 他のEmployeeServiceのメソッドは変更しない_
    - _Requirements: 2.6_

  - [ ] 7.3 バグ条件探索テストの再実行（修正後）
    - **Property 3: Expected Behavior** - 訪問予約の保存成功
    - **IMPORTANT**: タスク6と同じテストを再実行する - 新しいテストを書かない
    - タスク6のテストは期待される動作をエンコードしている
    - このテストがパスすれば、期待される動作が満たされていることを確認
    - タスク6のバグ条件探索テストを再実行
    - **EXPECTED OUTCOME**: テストがパスする（バグが修正されたことを確認）
    - _Requirements: Expected Behavior Properties from design (2.5, 2.6, 2.7)_

  - [ ] 7.4 保存テストの再実行（修正後）
    - **Property 5: Preservation** - 有効な営担での訪問予約保存
    - 有効な営担で訪問予約を保存するテストを実行
    - **EXPECTED OUTCOME**: テストがパスする（リグレッションがないことを確認）
    - 修正後も全てのテストがパスすることを確認（リグレッションなし）
    - _Requirements: 3.5_

- [ ] 8. チェックポイント - 問題2の全てのテストがパスすることを確認
  - 全てのテストがパスすることを確認し、疑問があればユーザーに質問する

---

## 最終チェックポイント

- [ ] 9. 全体の統合テスト
  - 問題1と問題2の両方が修正されていることを確認
  - 通話モードページで以下をテスト:
    - コミュニケーション情報フィールドの保存
    - 訪問予約の保存
    - 他のフィールドの保存（リグレッションチェック）
  - 全てのテストがパスすることを確認

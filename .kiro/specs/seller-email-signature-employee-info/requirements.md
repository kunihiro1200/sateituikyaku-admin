# 要件定義書

## はじめに

売主リストの通話モードページ（`/sellers/:id/call`）において、「訪問査定後御礼メール」の署名部分に営業担当者の個人情報（名前・電話番号・メールアドレス）を正しく表示する機能を追加する。

現状、`visit_thank_you`テンプレートには`<<担当名（営業）名前>>`・`<<担当名（営業）電話番号>>`・`<<担当名（営業）メールアドレス>>`のプレースホルダーが存在し、CallModePageでの変数置換処理も実装済みである。しかし、`/api/employees/active`エンドポイントが`phone_number`を返していないため電話番号が空になっており、また担当者の特定ロジックに問題があるため誤った名前が表示されるケースがある。

## 用語集

- **Employee（従業員）**: `employees`テーブルに格納された社内スタッフ。`id`・`email`・`name`・`role`・`initials`・`phone_number`カラムを持つ
- **AssignedTo（担当者）**: 売主レコードの`assignedTo`フィールドに格納された担当営業のメールアドレス
- **CallModePage（通話モードページ）**: `/sellers/:id/call` のページ。売主管理システム（ポート3000）のバックエンドを使用
- **visit_thank_you（訪問査定後御礼メール）**: メールテンプレートID `visit_thank_you` のテンプレート
- **Signature（署名）**: メール本文末尾の会社情報・担当者情報ブロック
- **PhoneNumber（電話番号）**: `employees.phone_number`カラムに格納された担当者の携帯電話番号

## 要件

### 要件1: 担当者電話番号のAPIレスポンスへの追加

**ユーザーストーリー:** 営業担当者として、訪問査定後御礼メールの署名に自分の電話番号が表示されるようにしたい。そうすることで、売主が直接担当者に連絡できるようになる。

#### 受け入れ基準

1. THE Backend_API SHALL `phone_number`フィールドを`/api/employees/active`エンドポイントのレスポンスに含める
2. WHEN `/api/employees/active`が呼び出されたとき、THE Backend_API SHALL `employees`テーブルの`phone_number`カラムの値を各従業員オブジェクトに含めて返す
3. IF `employees.phone_number`がNULLの場合、THEN THE Backend_API SHALL 空文字列または`null`を返す（エラーにしない）

---

### 要件2: フロントエンドEmployee型へのphoneNumberフィールド追加

**ユーザーストーリー:** 開発者として、フロントエンドのEmployee型がphone_numberを扱えるようにしたい。そうすることで、メールテンプレートの変数置換で電話番号を利用できる。

#### 受け入れ基準

1. THE Frontend_EmployeeType SHALL `phoneNumber`フィールド（`string | null`型）を含む
2. WHEN `/api/employees/active`からデータを取得したとき、THE EmployeeService SHALL `phone_number`を`phoneNumber`としてマッピングする

---

### 要件3: 訪問査定後御礼メールの担当者情報変数置換の正確性確保

**ユーザーストーリー:** 営業担当者として、訪問査定後御礼メールの署名に正しい担当者名・電話番号・メールアドレスが表示されるようにしたい。そうすることで、売主に正確な連絡先を伝えられる。

#### 受け入れ基準

1. WHEN `visit_thank_you`テンプレートが選択されたとき、THE CallModePage SHALL `seller.assignedTo`（担当者メールアドレス）を使って`employees`リストから担当者を検索し、`<<担当名（営業）名前>>`を担当者の`name`で置換する
2. WHEN `seller.assignedTo`に一致する従業員が見つかったとき、THE CallModePage SHALL `<<担当名（営業）電話番号>>`を当該従業員の`phoneNumber`で置換する
3. WHEN `seller.assignedTo`に一致する従業員が見つかったとき、THE CallModePage SHALL `<<担当名（営業）メールアドレス>>`を当該従業員の`email`で置換する
4. IF `seller.assignedTo`に一致する従業員が見つからない場合、THEN THE CallModePage SHALL ログインユーザー（`employee`）の情報でフォールバックする
5. IF ログインユーザーの情報もない場合、THEN THE CallModePage SHALL 各プレースホルダーを空文字列で置換する（エラーにしない）

---

### 要件4: バックエンドgetActiveEmployeesWithEmailへのphone_number追加

**ユーザーストーリー:** 開発者として、バックエンドの従業員取得ユーティリティが電話番号を返すようにしたい。そうすることで、フロントエンドに電話番号を渡せる。

#### 受け入れ基準

1. THE EmployeeUtils SHALL `getActiveEmployeesWithEmail`メソッドのSELECTクエリに`phone_number`カラムを追加する
2. THE EmployeeUtils SHALL 戻り値の型定義に`phone_number: string | null`フィールドを追加する

# 通話モードページ 保存エラー修正設計

## Overview

通話モードページ（`/sellers/:id/call`）で以下の2つの保存エラーが発生しています：

### 問題1: コミュニケーション情報フィールドの保存エラー

3つのフィールド（電話担当（任意）、連絡取りやすい日、連絡方法）を編集しても、データベースに保存されず、スプレッドシートにも即時同期されない問題。

**根本原因**:
1. **フロントエンド**: 自動保存処理で`phoneContactPerson`（電話担当）フィールドがAPIリクエストに含まれていない
2. **バックエンド**: `SellerService.updateSeller()`メソッドで`phoneContactPerson`、`preferredContactTime`、`contactMethod`の3つのフィールドが処理されていない

### 問題2: 訪問予約の保存エラー

訪問予約を保存する際に400エラー「無効な営担です」が発生し、保存できない問題。

**根本原因**:
1. **バックエンド**: `backend/src/routes/sellers.ts`（890行目付近）で営担（visitAssignee）のバリデーションが`employees`テーブルから取得していたが、営担の管理は**スタッフ管理シートが正解**（Single Source of Truth）
2. **データソースの不一致**: `employees`テーブルには営担「K」が「国」として登録されており、スタッフ管理シートのイニシャル「K」と一致していなかった

**修正方針**: 営担のバリデーションを**スタッフ管理シートから直接取得**するように変更し、データソースを1つに統一します。

## Glossary

### 問題1: コミュニケーション情報フィールド

- **Bug_Condition (C)**: コミュニケーション情報フィールド（電話担当、連絡取りやすい日、連絡方法）を編集した場合
- **Property (P)**: 編集後1秒でデータベースに自動保存され、スプレッドシートに即時同期される
- **Preservation**: 他のフィールド（ステータス、コメント、1番電話等）の保存処理は変更しない
- **phoneContactPerson**: `sellers.phone_contact_person`カラム - 電話担当（任意）のイニシャル
- **preferredContactTime**: `sellers.preferred_contact_time`カラム - 連絡取りやすい日、時間帯
- **contactMethod**: `sellers.contact_method`カラム - 連絡方法（Email、SMS、電話）
- **デバウンス処理**: ユーザーの入力が完了してから1秒後に保存する仕組み（連続入力時の無駄な保存を防ぐ）

### 問題2: 訪問予約の保存エラー

- **Bug_Condition (C)**: 無効な営担（`is_normal=false`または`is_active=false`）を選択して訪問予約を保存した場合
- **Property (P)**: 有効な営担（`is_normal=true`かつ`is_active=true`）のみが選択肢に表示され、保存が成功する
- **Preservation**: 有効な営担での訪問予約保存処理は変更しない
- **visitAssignee**: `sellers.visit_assignee`カラム - 営業担当のイニシャル
- **is_normal**: `employees.is_normal`カラム - 通常の従業員フラグ（`true`=通常、`false`=特殊）
- **is_active**: `employees.is_active`カラム - 有効な従業員フラグ（`true`=有効、`false`=無効）

## Bug Details

### 問題1: コミュニケーション情報フィールドの保存エラー

#### Bug Condition

バグは、ユーザーが通話モードページのコミュニケーション情報セクションで以下のいずれかのフィールドを編集した場合に発生します：
- 電話担当（任意）
- 連絡取りやすい日、時間帯
- 連絡方法

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { fieldName: string, newValue: string, page: string }
  OUTPUT: boolean
  
  RETURN input.page === '/sellers/:id/call'
         AND input.fieldName IN ['phoneContactPerson', 'preferredContactTime', 'contactMethod']
         AND input.newValue !== originalValue
         AND NOT savedToDatabase(input.fieldName, input.newValue)
END FUNCTION
```

#### Examples

- **例1**: ユーザーが「電話担当（任意）」で「田中」を選択 → データベースに保存されない（バグ）
- **例2**: ユーザーが「連絡取りやすい日、時間帯」に「平日午前中」と入力 → データベースに保存されない（バグ）
- **例3**: ユーザーが「連絡方法」に「Email優先」と入力 → データベースに保存されない（バグ）
- **例4**: ユーザーが「1番電話」フィールドを編集 → 正常に保存される（バグなし）

---

### 問題2: 訪問予約の保存エラー

#### Bug Condition

バグは、ユーザーが通話モードページで無効な営担を選択して訪問予約を保存した場合に発生します。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { visitAssignee: string, visitDate: string }
  OUTPUT: boolean
  
  employee := getEmployee(input.visitAssignee)
  
  RETURN input.visitAssignee !== null
         AND input.visitDate !== null
         AND (employee.is_normal === false OR employee.is_active === false)
END FUNCTION
```

#### Examples

- **例1**: 営担「K」（`is_normal=false`）を選択して訪問予約を保存 → 400エラー「無効な営担です」（バグ）
- **例2**: 営担「Y」（`is_normal=true`かつ`is_active=true`）を選択して訪問予約を保存 → 正常に保存される（バグなし）
- **例3**: 営担選択UIに「K」が表示されている → ユーザーが無効な営担を選択できてしまう（バグ）

#### Root Cause Analysis

**バックエンドのバリデーション**（`backend/src/routes/sellers.ts`、890行目付近）:

営担のバリデーションが`employees`テーブルから取得していましたが、営担の管理は**スタッフ管理シートが正解**（Single Source of Truth）です。

**修正後のコード**:
```typescript
// Validate visitAssignee if provided (営担検証)
// スタッフ管理シートから直接取得（Single Source of Truth）
if (req.body.visitAssignee !== undefined && req.body.visitAssignee !== null && req.body.visitAssignee !== '') {
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
    sheetName: 'スタッフ',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });
  await sheetsClient.authenticate();
  
  // A列（イニシャル）とH列（有効）を取得
  const values = await sheetsClient.readRawRange('A:H');
  
  // 営担を検索して有効フラグを確認
  const staffRow = values.find((row, index) => 
    index > 0 && row[initialsIndex] === req.body.visitAssignee
  );
  
  if (!staffRow || !isActive) {
    return res.status(400).json({
      error: {
        code: 'INVALID_VISIT_ASSIGNEE',
        message: '無効な営担です',
        retryable: false,
      },
    });
  }
}
```

**データソースの統一**:
- スタッフの入退職はスタッフ管理シートで管理
- `employees`テーブルは認証のみに使用
- 同期の必要がなくなり、シンプルで間違いにくい

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他のフィールド（ステータス、コメント、1番電話等）の自動保存処理は変更しない
- 売主詳細ページでのコミュニケーション情報フィールドの保存処理は変更しない
- スプレッドシートからの同期処理は変更しない

**Scope:**
コミュニケーション情報フィールド以外の全てのフィールドは、既存の保存処理を継続して実行します。これには以下が含まれます：
- ステータス、確度、次電日などのステータスセクションフィールド
- コメント欄
- 1番電話フィールド
- 訪問予約フィールド
- 査定計算フィールド

## Hypothesized Root Cause

### 問題1: コミュニケーション情報フィールドの保存エラー

コードレビューの結果、以下の2つの問題が特定されました：

1. **フロントエンド（CallModePage.tsx）**: 
   - 自動保存処理（useEffect）で`phoneContactPerson`がAPIリクエストに含まれていない
   - 依存配列に`editedPhoneContactPerson`が含まれているが、APIリクエストのペイロードに`phoneContactPerson`フィールドがない
   - 現在のコード（1093行目付近）:
     ```typescript
     await api.put(`/api/sellers/${id}`, {
       preferredContactTime: editedPreferredContactTime || null,
       contactMethod: editedContactMethod || null,
       firstCallPerson: editedFirstCallPerson || null,
       // ❌ phoneContactPerson が欠落
     });
     ```

2. **バックエンド（SellerService.supabase.ts）**:
   - `updateSeller()`メソッドで`phoneContactPerson`、`preferredContactTime`、`contactMethod`の3つのフィールドが処理されていない
   - 他のフィールド（`firstCallPerson`、`mailingStatus`等）は正しく処理されているが、これら3つのフィールドのマッピングが欠落している

3. **スプレッドシート同期**:
   - `SpreadsheetSyncService.ts`でコミュニケーション情報フィールドのマッピングが存在しない可能性がある（要確認）

---

### 問題2: 訪問予約の保存エラー

コードレビューの結果、以下の2つの問題が特定されました：

1. **バックエンド（`backend/src/routes/sellers.ts`、890行目付近）**:
   - 営担（visitAssignee）のバリデーションが実行され、`is_normal=true`かつ`is_active=true`の従業員のみを許可している
   - 営担「K」が`is_normal=false`または`is_active=false`の場合、400エラーが返される

2. **フロントエンド（`CallModePage.tsx`）**:
   - 営担選択UIで、無効な従業員（`is_normal=false`または`is_active=false`）も選択肢に表示されている可能性がある
   - `getActiveEmployees()`関数が`is_normal=true`かつ`is_active=true`の従業員のみを取得しているか確認が必要

## Correctness Properties

### 問題1: コミュニケーション情報フィールド

Property 1: Bug Condition - コミュニケーション情報フィールドの自動保存

_For any_ ユーザー入力で、通話モードページのコミュニケーション情報フィールド（電話担当、連絡取りやすい日、連絡方法）を編集した場合、修正後のシステムは1秒後にデータベースに自動保存し、スプレッドシートに即時同期する。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 他のフィールドの保存処理

_For any_ ユーザー入力で、コミュニケーション情報フィールド以外のフィールド（ステータス、コメント、1番電話等）を編集した場合、修正後のシステムは既存の保存処理を継続して実行し、動作を変更しない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

### 問題2: 訪問予約の保存エラー

Property 3: Bug Condition - 訪問予約の保存

_For any_ ユーザー入力で、通話モードページで有効な営担（`is_normal=true`かつ`is_active=true`）を選択して訪問予約を保存した場合、修正後のシステムは正常に保存する。

**Validates: Requirements 2.5**

Property 4: UI Filtering - 営担選択UIのフィルタリング

_For any_ 営担選択UIの表示時、修正後のシステムは有効な従業員（`is_normal=true`かつ`is_active=true`）のみを選択肢に表示する。

**Validates: Requirements 2.6, 2.7**

Property 5: Preservation - 有効な営担での訪問予約保存

_For any_ ユーザー入力で、有効な営担で訪問予約を保存した場合、修正後のシステムは既存の保存処理を継続して実行し、動作を変更しない。

**Validates: Requirements 3.5**

## Fix Implementation

### 問題1: コミュニケーション情報フィールドの保存エラー

#### Changes Required

修正は以下の2つのファイルで行います：

**File 1**: `frontend/frontend/src/pages/CallModePage.tsx`

**Function**: コミュニケーション情報フィールドの自動保存処理（useEffect、1088行目付近）

**Specific Changes**:
1. **APIリクエストに`phoneContactPerson`を追加**:
   ```typescript
   await api.put(`/api/sellers/${id}`, {
     phoneContactPerson: editedPhoneContactPerson || null, // ✅ 追加
     preferredContactTime: editedPreferredContactTime || null,
     contactMethod: editedContactMethod || null,
     firstCallPerson: editedFirstCallPerson || null,
   });
   ```

**File 2**: `backend/src/services/SellerService.supabase.ts`

**Function**: `updateSeller()`メソッド（453行目付近）

**Specific Changes**:
1. **`phoneContactPerson`フィールドの処理を追加**（`firstCallPerson`の処理の近くに追加）:
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

2. **挿入位置**: `firstCallPerson`の処理（現在の715行目付近）の直後に追加することで、関連フィールドをグループ化

**File 3**: `backend/src/services/ColumnMapper.ts`（確認が必要）

**Function**: `mapToSheet()`メソッド

**Specific Changes**:
1. **コミュニケーション情報フィールドのマッピングを確認**:
   - `phone_contact_person` → スプレッドシートの「電話担当（任意）」カラム
   - `preferred_contact_time` → スプレッドシートの「連絡取りやすい日、時間帯」カラム
   - `contact_method` → スプレッドシートの「連絡方法」カラム

2. **マッピングが欠落している場合は追加**（既存のコミュニケーション関連フィールドの近くに追加）

**Note**: ステアリングドキュメント（`seller-spreadsheet-column-mapping.md`）によると、これらのフィールドは既にマッピングされている可能性があります。実装時に確認が必要です。

---

### 問題2: 訪問予約の保存エラー

#### Changes Required

修正は以下の2つのファイルで行います：

**File 1**: `frontend/frontend/src/pages/CallModePage.tsx`

**Function**: 営担選択UIの従業員リスト取得処理

**Specific Changes**:
1. **`getActiveEmployees()`関数が`is_normal=true`かつ`is_active=true`の従業員のみを取得しているか確認**
2. **営担選択UIで無効な従業員が表示されないようにフィルタリング**:
   ```typescript
   // 有効な従業員のみを取得
   const activeEmployees = employees.filter(emp => 
     emp.is_normal === true && emp.is_active === true
   );
   ```

**File 2**: `backend/src/services/EmployeeService.ts`（確認が必要）

**Function**: `getActiveEmployees()`メソッド

**Specific Changes**:
1. **`is_normal=true`かつ`is_active=true`の従業員のみを返すように確認**:
   ```typescript
   const { data: employees } = await supabase
     .from('employees')
     .select('*')
     .eq('is_normal', true)
     .eq('is_active', true);
   ```

**File 3**: データベース調査（`employees`テーブル）

**Investigation**:
1. **営担「K」の`is_normal`と`is_active`の値を確認**:
   ```sql
   SELECT initials, is_normal, is_active 
   FROM employees 
   WHERE initials = 'K';
   ```

2. **営担「K」が無効な場合、有効にするか、UIから除外するかをユーザーに確認**

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：
1. **探索的バグ条件チェック**: 修正前のコードでバグを再現し、根本原因を確認
2. **修正検証**: 修正後のコードで、バグが修正され、既存機能が保持されていることを確認

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: 
1. 通話モードページで各コミュニケーション情報フィールドを編集
2. ブラウザの開発者ツールでネットワークタブを確認し、APIリクエストのペイロードを検証
3. データベースを直接確認し、値が保存されていないことを確認
4. スプレッドシートを確認し、同期されていないことを確認

**Test Cases**:
1. **電話担当フィールドテスト**: 「電話担当（任意）」で「田中」を選択 → APIリクエストに`phoneContactPerson`が含まれない（修正前のコードで失敗）
2. **連絡取りやすい日フィールドテスト**: 「連絡取りやすい日、時間帯」に「平日午前中」と入力 → データベースに保存されない（修正前のコードで失敗）
3. **連絡方法フィールドテスト**: 「連絡方法」に「Email優先」と入力 → データベースに保存されない（修正前のコードで失敗）
4. **1番電話フィールドテスト**: 「1番電話」フィールドを編集 → 正常に保存される（修正前のコードで成功）

**Expected Counterexamples**:
- APIリクエストに`phoneContactPerson`フィールドが含まれていない
- バックエンドで`phone_contact_person`、`preferred_contact_time`、`contact_method`が処理されていない
- データベースに値が保存されていない

### Fix Checking

**Goal**: 修正後のコードで、コミュニケーション情報フィールドが正しく保存されることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := editCommunicationField_fixed(input)
  ASSERT result.savedToDatabase === true
  ASSERT result.syncedToSpreadsheet === true
  ASSERT result.savedWithin1Second === true
END FOR
```

**Test Plan**:
1. 通話モードページで各コミュニケーション情報フィールドを編集
2. 1秒後にデータベースを確認し、値が保存されていることを確認
3. スプレッドシートを確認し、即時同期されていることを確認
4. ブラウザの開発者ツールでネットワークタブを確認し、APIリクエストのペイロードに全てのフィールドが含まれていることを確認

**Test Cases**:
1. **電話担当フィールドテスト**: 「電話担当（任意）」で「田中」を選択 → 1秒後にデータベースに保存される
2. **連絡取りやすい日フィールドテスト**: 「連絡取りやすい日、時間帯」に「平日午前中」と入力 → 1秒後にデータベースに保存される
3. **連絡方法フィールドテスト**: 「連絡方法」に「Email優先」と入力 → 1秒後にデータベースに保存される
4. **複数フィールド同時編集テスト**: 3つのフィールドを連続して編集 → 最後の編集から1秒後に全て保存される（デバウンス動作確認）

### Preservation Checking

**Goal**: 修正後のコードで、コミュニケーション情報フィールド以外のフィールドの保存処理が変更されていないことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT saveField_original(input) = saveField_fixed(input)
END FOR
```

**Testing Approach**: 
既存の自動保存処理（ステータス、コメント、1番電話等）が正常に動作することを確認します。プロパティベーステストは、多数のテストケースを自動生成し、エッジケースを検出するのに有効です。

**Test Plan**: 
修正前のコードで正常に動作していた他のフィールドの保存処理が、修正後も同じように動作することを確認します。

**Test Cases**:
1. **ステータスフィールド保存テスト**: ステータスを「追客中」から「専任媒介」に変更 → 既存の保存処理が継続して実行される
2. **コメント保存テスト**: コメント欄にテキストを入力 → 既存の保存処理が継続して実行される
3. **1番電話保存テスト**: 「1番電話」フィールドを編集 → 既存の自動保存処理が継続して実行される
4. **訪問予約保存テスト**: 訪問予約フィールドを編集 → 既存の保存処理が継続して実行される

### Unit Tests

- フロントエンド: コミュニケーション情報フィールドの自動保存処理（useEffect）のテスト
- バックエンド: `SellerService.updateSeller()`メソッドで`phoneContactPerson`、`preferredContactTime`、`contactMethod`が正しく処理されることをテスト
- デバウンス処理: 1秒以内に複数回編集した場合、最後の編集のみが保存されることをテスト

### Property-Based Tests

- ランダムな売主データを生成し、コミュニケーション情報フィールドを編集した場合に正しく保存されることを確認
- ランダムな入力値（空文字、null、長い文字列等）でエッジケースをテスト
- 他のフィールドの保存処理が影響を受けないことを多数のシナリオで確認

### Integration Tests

- 通話モードページでコミュニケーション情報フィールドを編集し、データベースとスプレッドシートの両方に正しく保存されることを確認
- 売主詳細ページでコミュニケーション情報フィールドを編集し、既存の保存処理が継続して実行されることを確認
- スプレッドシートからコミュニケーション情報フィールドを編集し、既存の同期処理が継続して実行されることを確認

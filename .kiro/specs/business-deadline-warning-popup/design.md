# 設計ドキュメント：業務リスト詳細画面 締日超過警告ポップアップ

## 概要

`WorkTaskDetailModal`（`frontend/frontend/src/components/WorkTaskDetailModal.tsx`）に、サイト登録締日（`site_registration_deadline`）を超過した日付フィールドを検出し、警告ポップアップを表示する機能を追加する。

対象フィールドは以下の2つ：
- `site_registration_due_date`（サイト登録納期予定日、datetime-local型）
- `floor_plan_due_date`（間取図完了予定、datetime-local型）

フィールド変更時にリアルタイムで締日超過チェックを行い、超過が検出された場合は MUI `Dialog` を使った警告ポップアップを表示する。ユーザーが確認ボタンを押すとポップアップが閉じ、入力値はそのまま保持される。

---

## アーキテクチャ

本機能は既存の `WorkTaskDetailModal` コンポーネントに対して、最小限の変更で追加する。

```
WorkTaskDetailModal
├── state: warningDialog { open, fieldLabel }   ← 追加
├── isDeadlineExceeded(dueDate, deadline)        ← 追加（純粋関数）
├── handleFieldChange（既存）                    ← 変更：チェック呼び出しを追加
├── DeadlineWarningDialog                        ← 追加（新コンポーネント）
└── SiteRegistrationSection（既存）              ← 変更：onChange フック
```

### 設計方針

- **純粋関数による比較ロジック**: `isDeadlineExceeded(dueDate, deadline)` を `WorkTaskDetailModal` 関数スコープ外のモジュールレベルに定義し、テスト容易性を確保する
- **既存の `handleFieldChange` を拡張**: 対象フィールドの変更時にチェックを呼び出す。既存の状態管理フローを変更しない
- **入力値の保持**: 警告ポップアップは表示のみ行い、`editedData` の値を変更しない
- **MUI Dialog を使用**: 既存コードで `Dialog` はすでにインポート済みのため、追加インポート不要

---

## コンポーネントとインターフェース

### `isDeadlineExceeded`（モジュールレベル純粋関数）

```typescript
/**
 * 納期予定日がサイト登録締日を超過しているか判定する
 * @param dueDate - datetime-local 形式の文字列（例: "2025-08-10T12:00"）または null/undefined
 * @param deadline - date 形式の文字列（例: "2025-08-05"）または null/undefined
 * @returns 超過している場合 true、それ以外（無効値含む）は false
 */
export function isDeadlineExceeded(
  dueDate: string | null | undefined,
  deadline: string | null | undefined
): boolean
```

**比較ロジック**:
1. `dueDate` または `deadline` が空・null・undefined の場合は `false` を返す
2. `dueDate` の日付部分（`YYYY-MM-DD`）を抽出する（`T` 以前の部分）
3. 両者を `Date` オブジェクトに変換し、パース失敗（`isNaN`）の場合は `false` を返す
4. `dueDateOnly > deadlineDate` の場合に `true` を返す（同日は警告しない）

### `DeadlineWarningDialog`（新コンポーネント）

```typescript
interface DeadlineWarningDialogProps {
  open: boolean;
  fieldLabel: string;  // 超過したフィールドのラベル（例: "サイト登録納期予定日"）
  onClose: () => void;
}
```

MUI `Dialog` を使用した警告ポップアップ。表示内容：
- タイトル：「締日超過の警告」
- メッセージ：「サイト登録締日を過ぎています　担当に確認しましたか？」
- 確認ボタン：クリックで `onClose` を呼び出す

### `warningDialog` state（追加）

```typescript
const [warningDialog, setWarningDialog] = useState<{
  open: boolean;
  fieldLabel: string;
}>({ open: false, fieldLabel: '' });
```

### `handleFieldChange` の拡張

既存の `handleFieldChange` に以下のロジックを追加する：

```typescript
const handleFieldChange = (field: string, value: any) => {
  setEditedData(prev => ({ ...prev, [field]: value }));

  // 締日超過チェック対象フィールド
  const DEADLINE_CHECK_FIELDS: Record<string, string> = {
    site_registration_due_date: 'サイト登録納期予定日',
    floor_plan_due_date: '間取図完了予定',
  };

  if (field in DEADLINE_CHECK_FIELDS) {
    const deadline = editedData['site_registration_deadline'] ?? data?.['site_registration_deadline'];
    if (isDeadlineExceeded(value, deadline)) {
      setWarningDialog({ open: true, fieldLabel: DEADLINE_CHECK_FIELDS[field] });
    }
  }
};
```

**注意**: `deadline` の取得には `editedData` を優先し、未編集の場合は `data` から取得する（`getValue` 関数と同じパターン）。

---

## データモデル

本機能で新たなデータモデルの追加はない。既存の `WorkTaskData` インターフェースのフィールドを使用する。

| フィールド | 型 | 説明 |
|---|---|---|
| `site_registration_due_date` | `string` | サイト登録納期予定日（datetime-local形式） |
| `floor_plan_due_date` | `string` | 間取図完了予定（datetime-local形式） |
| `site_registration_deadline` | `string` | サイト登録締日（date形式 `YYYY-MM-DD`） |

### 日付比較の詳細

`site_registration_due_date` と `floor_plan_due_date` は `datetime-local` 型（`YYYY-MM-DDTHH:mm`）であり、`site_registration_deadline` は `date` 型（`YYYY-MM-DD`）である。

比較は**日付部分のみ**で行う。時刻は無視する。

```
例:
  dueDate   = "2025-08-10T12:00"  → 日付部分: "2025-08-10"
  deadline  = "2025-08-05"
  → "2025-08-10" > "2025-08-05" → true（警告表示）

  dueDate   = "2025-08-05T09:00"  → 日付部分: "2025-08-05"
  deadline  = "2025-08-05"
  → "2025-08-05" === "2025-08-05" → false（警告なし）
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械検証可能な正確性保証の橋渡しとなります。*

### プロパティ1: 締日超過判定の正確性

*任意の* 有効な `dueDate`（datetime-local形式）と `deadline`（date形式）のペアに対して、`isDeadlineExceeded(dueDate, deadline)` は `dueDate` の日付部分が `deadline` より後のときのみ `true` を返し、同日または以前のときは `false` を返す。

**Validates: Requirements 1.1, 1.2, 2.1, 2.2**

### プロパティ2: 無効入力に対する安全性

*任意の* 無効な入力（空文字・null・undefined・パース不能な文字列）が `dueDate` または `deadline` のいずれかに渡された場合、`isDeadlineExceeded()` は常に `false` を返す。

**Validates: Requirements 1.3, 1.4, 2.3, 2.4**

### プロパティ3: 警告後の入力値保持

*任意の* `dueDate` 値を入力して警告ポップアップが表示された後、確認ボタンでポップアップを閉じても、`editedData` 内の当該フィールドの値は変更前と同一である。

**Validates: Requirements 3.5**

---

## エラーハンドリング

| ケース | 対応 |
|---|---|
| `site_registration_deadline` が未設定（null/空） | チェックをスキップ、警告なし |
| `dueDate` が未設定（null/空） | チェックをスキップ、警告なし |
| 日付文字列のパース失敗 | `isNaN` チェックで検出し、警告なし |
| 警告ポップアップを閉じる | `warningDialog.open = false` に更新、`editedData` は変更しない |

`isDeadlineExceeded` は例外をスローしない。全ての異常入力に対して `false` を返す防御的実装とする。

---

## テスト戦略

### 単体テスト（`isDeadlineExceeded` 関数）

`isDeadlineExceeded` はモジュールレベルの純粋関数として定義するため、コンポーネントから独立してテスト可能。

**具体例テスト**:
- `dueDate = "2025-08-10T12:00"`, `deadline = "2025-08-05"` → `true`
- `dueDate = "2025-08-05T12:00"`, `deadline = "2025-08-05"` → `false`（同日）
- `dueDate = "2025-08-04T12:00"`, `deadline = "2025-08-05"` → `false`（以前）
- `dueDate = ""`, `deadline = "2025-08-05"` → `false`
- `dueDate = "2025-08-10T12:00"`, `deadline = ""` → `false`
- `dueDate = null`, `deadline = "2025-08-05"` → `false`
- `dueDate = "invalid"`, `deadline = "2025-08-05"` → `false`

**プロパティベーステスト**（推奨ライブラリ: [fast-check](https://github.com/dubzzz/fast-check)）:

プロパティ1・2・3 に対応するテストを実装する。各テストは最低100回のイテレーションで実行する。

```typescript
// プロパティ1: 締日超過判定の正確性
// Feature: business-deadline-warning-popup, Property 1: 締日超過判定の正確性
fc.assert(fc.property(
  fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  (dueDateObj, deadlineObj) => {
    const dueDate = `${dueDateObj.toISOString().split('T')[0]}T12:00`;
    const deadline = deadlineObj.toISOString().split('T')[0];
    const result = isDeadlineExceeded(dueDate, deadline);
    const dueDateOnly = dueDate.split('T')[0];
    const expected = dueDateOnly > deadline;
    return result === expected;
  }
), { numRuns: 100 });

// プロパティ2: 無効入力に対する安全性
// Feature: business-deadline-warning-popup, Property 2: 無効入力に対する安全性
fc.assert(fc.property(
  fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant(''), fc.string()),
  fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  (invalidDueDate, deadlineObj) => {
    const deadline = deadlineObj.toISOString().split('T')[0];
    return isDeadlineExceeded(invalidDueDate as any, deadline) === false;
  }
), { numRuns: 100 });
```

### コンポーネントテスト（`DeadlineWarningDialog`）

- 警告メッセージ「サイト登録締日を過ぎています　担当に確認しましたか？」が表示されること
- 確認ボタンクリックで `onClose` が呼ばれること
- `open=false` のとき Dialog が表示されないこと

### 統合テスト（`WorkTaskDetailModal`）

- `site_registration_due_date` フィールド変更時に締日超過チェックが実行されること
- `floor_plan_due_date` フィールド変更時に締日超過チェックが実行されること
- 警告ポップアップを閉じた後も `editedData` の値が保持されること
- `site_registration_deadline` が未設定の場合、警告が表示されないこと

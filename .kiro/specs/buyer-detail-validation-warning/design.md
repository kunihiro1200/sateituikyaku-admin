# 設計ドキュメント：買主詳細画面バリデーション警告機能

## Overview

買主詳細画面（`BuyerDetailPage.tsx`）において、必須項目が未入力の状態でページ遷移しようとした際に、遷移をブロックするのではなく警告ダイアログを表示する機能を実装する。

現在の実装では `validateRequiredFields()` が `false` を返すと遷移を完全にブロックしているが、本機能では未入力項目を一覧表示した上でユーザーが「このまま移動する」か「画面に留まる」かを選択できるようにする。

### 変更の背景

- 現行の遷移ブロック方式はユーザー体験を損なう（入力途中でも他ページを確認したい場合がある）
- 警告ダイアログ方式により、入力漏れを注意喚起しつつ柔軟な操作を可能にする
- 配信メール「要」の場合、希望条件ページの項目も必須チェック対象に追加する

---

## Architecture

```
BuyerDetailPage.tsx
  │
  ├── checkMissingFields()          # 未入力項目リストを返す新関数
  │     ├── 常時必須4項目チェック
  │     ├── メール問合せ条件付きチェック
  │     └── distribution_type「要」条件付きチェック
  │
  ├── handleNavigate(url)           # 遷移前バリデーション共通ハンドラー
  │     ├── checkMissingFields() 呼び出し
  │     ├── 未入力あり → ValidationWarningDialog 表示
  │     └── 未入力なし → navigate(url) 直接実行
  │
  └── ValidationWarningDialog       # 新規コンポーネント
        ├── 未入力項目リスト表示
        ├── 「このまま移動する」ボタン（warning色）
        └── 「画面に留まる」ボタン（デフォルトフォーカス）
```

### 遷移フロー

```
ユーザーが遷移操作
  ↓
handleNavigate(url) 呼び出し
  ↓
checkMissingFields() で未入力項目を取得
  ↓
未入力あり？
  ├── YES → ValidationWarningDialog 表示
  │           ├── 「このまま移動する」→ navigate(url)
  │           └── 「画面に留まる」→ ダイアログを閉じる
  └── NO  → navigate(url) 直接実行
```

---

## Components and Interfaces

### ValidationWarningDialog（新規）

**ファイル**: `frontend/frontend/src/components/ValidationWarningDialog.tsx`

```typescript
interface ValidationWarningDialogProps {
  open: boolean;
  missingFieldLabels: string[];   // 未入力項目の表示名リスト
  onProceed: () => void;          // 「このまま移動する」コールバック
  onStay: () => void;             // 「画面に留まる」コールバック
}
```

**UI仕様**:
- MUI `Dialog` コンポーネントを使用
- タイトル: 「必須項目が未入力です」
- 本文: 未入力項目を `<ul>` リスト形式で表示
- ボタン配置:
  - 「画面に留まる」: `variant="contained"` + `autoFocus` （推奨アクション）
  - 「このまま移動する」: `color="warning"` + `variant="outlined"`

### BuyerDetailPage の変更点

#### checkMissingFields()（新規）

```typescript
const checkMissingFields = (): string[] => {
  // 未入力の必須項目の表示名リストを返す
  // 空配列 = 全て入力済み
}
```

#### handleNavigate()（新規）

```typescript
const handleNavigate = (url: string) => {
  const missing = checkMissingFields();
  if (missing.length > 0) {
    setPendingNavigationUrl(url);
    setValidationDialogOpen(true);
  } else {
    navigate(url);
  }
};
```

#### 追加 state

```typescript
const [validationDialogOpen, setValidationDialogOpen] = useState(false);
const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string>('');
```

---

## Data Models

### 必須項目定義

| フィールドキー | 表示名 | 必須条件 |
|---|---|---|
| `initial_assignee` | 初動担当 | 常時 |
| `inquiry_source` | 問合せ元 | 常時 |
| `latest_status` | ★最新状況 | 常時 |
| `distribution_type` | 配信メール | 常時 |
| `inquiry_email_phone` | 【問合メール】電話対応 | `inquiry_source` に「メール」を含む場合 |
| `three_calls_confirmed` | 3回架電確認済み | `inquiry_source` に「メール」を含む かつ `inquiry_email_phone` に値がある場合 |
| `desired_area` | エリア（希望条件） | `distribution_type` が「要」の場合 |
| `budget` | 予算（希望条件） | `distribution_type` が「要」の場合 |
| `desired_property_type` | 希望種別（希望条件） | `distribution_type` が「要」の場合 |

### バリデーション対象の遷移操作

| 操作 | 現状 | 変更後 |
|---|---|---|
| 問合履歴ボタン | ブロック方式 | ダイアログ方式 |
| 希望条件ボタン | ブロック方式 | ダイアログ方式 |
| 内覧ボタン | ブロック方式 | ダイアログ方式 |
| 戻るボタン（ArrowBackIcon） | バリデーションなし | ダイアログ方式 |
| PageNavigation ボタン | バリデーションなし | ダイアログ方式 |
| 買主番号検索バー（Enter） | バリデーションなし | ダイアログ方式 |
| ブラウザの戻るボタン | 対象外 | 対象外（変更なし） |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 必須項目未入力時のダイアログ表示

*For any* 買主データにおいて、必須項目（initial_assignee・inquiry_source・latest_status・distribution_type）のいずれかが空文字または未定義の場合、`checkMissingFields()` の返り値は空でないリストとなり、遷移操作時にダイアログが表示される。全ての必須項目が入力済みの場合、`checkMissingFields()` は空リストを返し、ダイアログは表示されない。

**Validates: Requirements 1.1, 1.6, 2.1**

### Property 2: 未入力項目名の完全表示

*For any* 未入力項目リスト（長さ1以上）を `ValidationWarningDialog` に渡したとき、レンダリングされた内容には渡されたリストの全ての項目名が含まれる。

**Validates: Requirements 1.2, 5.2, 5.3**

### Property 3: メール問合せ条件付き必須チェック

*For any* 買主データにおいて、`inquiry_source` に「メール」を含む場合、`checkMissingFields()` は `inquiry_email_phone` が空であれば必須リストに含め、さらに `inquiry_email_phone` に値があり `three_calls_confirmed` が空であれば必須リストに含める。`inquiry_source` に「メール」を含まない場合、これら2項目は必須リストに含まれない。

**Validates: Requirements 2.2, 2.3**

### Property 4: 配信メール「要」条件付き必須チェック

*For any* 買主データにおいて、`distribution_type` が「要」の場合、`checkMissingFields()` は `desired_area`・`budget`・`desired_property_type` のうち空のものを必須リストに含める。`distribution_type` が「要」以外の場合、これら3項目は必須リストに含まれない。

**Validates: Requirements 3.1, 3.2, 3.4**

### Property 5: 「このまま移動する」選択時の遷移実行

*For any* 遷移先URL と未入力項目リストに対して、ダイアログで「このまま移動する」を選択したとき、`navigate` が当該URLで呼び出される。

**Validates: Requirements 1.4**

---

## Error Handling

### buyer データが null の場合

`checkMissingFields()` は `buyer` が `null` の場合、空リストを返す（バリデーションをスキップ）。これにより、データ読み込み中の誤ったダイアログ表示を防ぐ。

### desired_area / budget / desired_property_type が API レスポンスに含まれない場合

これらのフィールドは `buyer` オブジェクトの動的プロパティとして参照する（`buyer[key]`）。値が `undefined` の場合は空文字と同様に未入力として扱う。

### ダイアログ表示中の二重遷移防止

`pendingNavigationUrl` に遷移先を保持し、ダイアログが閉じられた後にのみ `navigate` を呼び出す。ダイアログが開いている間は新たな遷移操作を受け付けない（ダイアログが前面に表示されるため自然に防止される）。

---

## Testing Strategy

### ユニットテスト

`checkMissingFields()` 関数の動作を中心にテストする。

- 全必須項目入力済み → 空リストを返す
- 各必須項目が空の場合 → 対応する項目名がリストに含まれる
- `inquiry_source` に「メール」を含む場合の条件付きチェック
- `distribution_type` が「要」の場合の条件付きチェック
- `buyer` が `null` の場合 → 空リストを返す

`ValidationWarningDialog` コンポーネントのレンダリングテスト:

- 未入力項目リストが全て表示されること
- 2つのボタンが存在すること
- 「画面に留まる」ボタンに `autoFocus` が設定されていること

### プロパティベーステスト

プロパティベーステストには **fast-check**（TypeScript/JavaScript向けPBTライブラリ）を使用する。各テストは最低100回のランダム入力で実行する。

**テストタグ形式**: `Feature: buyer-detail-validation-warning, Property {番号}: {プロパティ名}`

#### Property 1 のテスト

```typescript
// Feature: buyer-detail-validation-warning, Property 1: 必須項目未入力時のダイアログ表示
fc.assert(fc.property(
  fc.record({
    initial_assignee: fc.option(fc.string()),
    inquiry_source: fc.option(fc.string()),
    latest_status: fc.option(fc.string()),
    distribution_type: fc.option(fc.string()),
  }),
  (buyer) => {
    const missing = checkMissingFields(buyer);
    const hasEmpty = !buyer.initial_assignee?.trim() || !buyer.inquiry_source?.trim()
      || !buyer.latest_status?.trim() || !buyer.distribution_type?.trim();
    return hasEmpty ? missing.length > 0 : missing.length === 0;
  }
), { numRuns: 100 });
```

#### Property 2 のテスト

```typescript
// Feature: buyer-detail-validation-warning, Property 2: 未入力項目名の完全表示
fc.assert(fc.property(
  fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
  (missingFieldLabels) => {
    const { getByText } = render(
      <ValidationWarningDialog open missingFieldLabels={missingFieldLabels} onProceed={() => {}} onStay={() => {}} />
    );
    return missingFieldLabels.every(label => !!getByText(label));
  }
), { numRuns: 100 });
```

#### Property 3 のテスト

```typescript
// Feature: buyer-detail-validation-warning, Property 3: メール問合せ条件付き必須チェック
fc.assert(fc.property(
  fc.record({
    inquiry_source: fc.string(),
    inquiry_email_phone: fc.option(fc.string()),
    three_calls_confirmed: fc.option(fc.string()),
  }),
  (buyer) => {
    const missing = checkMissingFields({ ...requiredFieldsFilled, ...buyer });
    const hasEmail = buyer.inquiry_source.includes('メール');
    if (!hasEmail) {
      return !missing.includes('【問合メール】電話対応') && !missing.includes('3回架電確認済み');
    }
    if (!buyer.inquiry_email_phone?.trim()) {
      return missing.includes('【問合メール】電話対応');
    }
    if (!buyer.three_calls_confirmed?.trim()) {
      return missing.includes('3回架電確認済み');
    }
    return true;
  }
), { numRuns: 100 });
```

#### Property 4 のテスト

```typescript
// Feature: buyer-detail-validation-warning, Property 4: 配信メール「要」条件付き必須チェック
fc.assert(fc.property(
  fc.record({
    distribution_type: fc.string(),
    desired_area: fc.option(fc.string()),
    budget: fc.option(fc.string()),
    desired_property_type: fc.option(fc.string()),
  }),
  (buyer) => {
    const missing = checkMissingFields({ ...requiredFieldsFilled, ...buyer });
    const isRequired = buyer.distribution_type === '要';
    if (!isRequired) {
      return !missing.includes('エリア（希望条件）')
        && !missing.includes('予算（希望条件）')
        && !missing.includes('希望種別（希望条件）');
    }
    return true;
  }
), { numRuns: 100 });
```

#### Property 5 のテスト

```typescript
// Feature: buyer-detail-validation-warning, Property 5: 「このまま移動する」選択時の遷移実行
fc.assert(fc.property(
  fc.webUrl(),
  (url) => {
    const mockNavigate = jest.fn();
    const { getByText } = render(
      <ValidationWarningDialog open missingFieldLabels={['テスト項目']} onProceed={() => mockNavigate(url)} onStay={() => {}} />
    );
    fireEvent.click(getByText('このまま移動する'));
    expect(mockNavigate).toHaveBeenCalledWith(url);
  }
), { numRuns: 100 });
```

# 設計書：媒介契約フォーマット警告機能

## 概要

`WorkTaskDetailModal` の「媒介契約」タブにおいて、保存時に古い形式のスプレッドシートが使用されている可能性を検知し、ユーザーに警告ダイアログ（`MediationFormatWarningDialog`）を表示する機能を追加する。

### 検知条件

以下の2条件が同時に満たされた状態で保存ボタンが押された場合に警告を表示する：

1. `property_address`（物件所在）の最終値が `"不要"` である
2. `mediation_creator`（媒介作成者）の最終値が空欄でない

### 動作フロー

```
保存ボタン押下
  ↓
[既存] RowAddWarningDialog チェック
  ↓ 通過
[新規] MediationFormatWarningDialog チェック
  ↓ 通過 or OKで確認
[既存] checkSiteRegistrationWarning チェック
  ↓ 通過
[既存] checkFloorPlanWarning チェック
  ↓ 通過
executeSave（API保存）
```

---

## アーキテクチャ

### 変更対象ファイル

- `frontend/frontend/src/components/WorkTaskDetailModal.tsx`（唯一の変更対象）

### 変更内容の概要

1. **純粋関数の追加**：`checkMediationFormatWarning(getValue)` をモジュールレベルに追加
2. **コンポーネントの追加**：`MediationFormatWarningDialog` をモジュールレベルに追加
3. **状態の追加**：`mediationFormatWarningDialog` ステートを `WorkTaskDetailModal` に追加
4. **`handleSave` の修正**：既存の `RowAddWarningDialog` チェック後に新規チェックを挿入
5. **`handleValidationWarningConfirm` の修正**：媒介契約フォーマット警告OKハンドラーを追加

---

## コンポーネントとインターフェース

### 新規コンポーネント：`MediationFormatWarningDialog`

```tsx
interface MediationFormatWarningDialogProps {
  open: boolean;
  onConfirm: () => void;
}
```

**表示内容**：
- タイトル：`WarningAmberIcon` + 「フォーマット警告」
- メッセージ：「「媒介作成」シートの1行目が古い形式になっているので [リンク] に従って変更してください」
- URLはクリック可能な `<Link>` コンポーネントで表示
- ボタン：「OK」（`primary` カラー）のみ

**実装例**：

```tsx
const MediationFormatWarningDialog = ({ open, onConfirm }: MediationFormatWarningDialogProps) => {
  const url = 'https://docs.google.com/spreadsheets/d/1PyMxyCHitJJyWH2dh3z6o7Wr6dTD_XPfd3Y9jJD9UEw/edit?usp=sharing';
  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon sx={{ color: 'warning.main' }} />
        <Typography component="span" sx={{ fontWeight: 700 }}>フォーマット警告</Typography>
      </DialogTitle>
      <DialogContent>
        <Typography>
          「媒介作成」シートの1行目が古い形式になっているので{' '}
          <Link href={url} target="_blank" rel="noopener">{url}</Link>
          {' '}に従って変更してください
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onConfirm} color="primary" variant="contained">OK</Button>
      </DialogActions>
    </Dialog>
  );
};
```

### 新規純粋関数：`checkMediationFormatWarning`

```tsx
function checkMediationFormatWarning(getValue: (field: string) => any): boolean {
  const propertyAddress = getValue('property_address');
  const mediationCreator = getValue('mediation_creator');
  return propertyAddress === '不要' && !isEmpty(mediationCreator);
}
```

- `isEmpty` は既存のモジュールレベル関数を再利用
- 戻り値：`true` = 警告表示が必要、`false` = スキップ

---

## データモデル

### 新規ステート

`WorkTaskDetailModal` に以下のステートを追加する：

```tsx
const [mediationFormatWarningDialog, setMediationFormatWarningDialog] = useState<{
  open: boolean;
}>({ open: false });
```

### 既存ステートとの関係

| ステート名 | 役割 | 変更 |
|-----------|------|------|
| `rowAddWarningDialog` | 物件一覧行追加未入力警告 | 変更なし |
| `mediationFormatWarningDialog` | 媒介契約フォーマット警告（新規） | 追加 |
| `validationWarningDialog` | サイト登録・間取図バリデーション警告 | 変更なし |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 媒介契約フォーマット警告の条件判定

*For any* `property_address` と `mediation_creator` の値の組み合わせに対して、`checkMediationFormatWarning` 関数は以下を満たす：
- `property_address === "不要"` かつ `mediation_creator` が空欄でない場合のみ `true` を返す
- それ以外の全ての組み合わせ（`property_address` が `"不要"` でない、または `mediation_creator` が空欄）では `false` を返す

**Validates: Requirements 1.2, 1.6, 1.7**

### Property 2: getValue の優先順位

*For any* `editedData` と `data` の組み合わせに対して、`getValue(field)` は `editedData[field]` が `undefined` でない場合は `editedData[field]` を返し、`undefined` の場合は `data[field]` を返す

**Validates: Requirements 1.1**

---

## エラーハンドリング

### 警告ダイアログ表示中の操作

- `MediationFormatWarningDialog` はOKボタンのみを持ち、キャンセル不可
- ダイアログ外クリックによる閉じ操作は実装しない（`onClose` プロパティを渡さない）
- OKボタン押下後は必ず保存処理チェーンを継続する

### 既存バリデーションとの競合

- 複数の警告が同時に発生する場合、1つずつ順番に表示する
- 順序：RowAddWarning → MediationFormatWarning → SiteRegistrationWarning → FloorPlanWarning

---

## テスト戦略

### PBT適用判断

この機能の中核は `checkMediationFormatWarning` という純粋関数であり、入力の組み合わせが多様（任意の文字列 × 任意の値）なため、プロパティベーステストが適切。

### 単体テスト（例ベース）

`checkMediationFormatWarning` の具体的なケース：

| `property_address` | `mediation_creator` | 期待結果 |
|-------------------|---------------------|---------|
| `"不要"` | `"K"` | `true` |
| `"不要"` | `""` | `false` |
| `"不要"` | `null` | `false` |
| `"不要"` | `undefined` | `false` |
| `"東京都渋谷区"` | `"K"` | `false` |
| `""` | `"K"` | `false` |
| `null` | `"K"` | `false` |

### プロパティベーステスト

**使用ライブラリ**：`fast-check`（TypeScript/JavaScript向けPBTライブラリ）

**設定**：各プロパティテストは最低100回実行

#### Property 1 のテスト実装方針

```typescript
// Feature: business-mediation-contract-format-warning, Property 1: 媒介契約フォーマット警告の条件判定
fc.assert(fc.property(
  fc.string(),  // property_address（任意の文字列）
  fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)),  // mediation_creator
  (propertyAddress, mediationCreator) => {
    const getValue = (field: string) =>
      field === 'property_address' ? propertyAddress : mediationCreator;
    const result = checkMediationFormatWarning(getValue);
    const expected = propertyAddress === '不要' && !isEmpty(mediationCreator);
    return result === expected;
  }
), { numRuns: 100 });
```

#### Property 2 のテスト実装方針

```typescript
// Feature: business-mediation-contract-format-warning, Property 2: getValue の優先順位
fc.assert(fc.property(
  fc.string(),  // field名
  fc.option(fc.anything()),  // editedData[field]
  fc.option(fc.anything()),  // data[field]
  (field, editedValue, dataValue) => {
    const editedData = editedValue !== undefined ? { [field]: editedValue } : {};
    const data = { [field]: dataValue };
    const getValue = (f: string) =>
      editedData[f] !== undefined ? editedData[f] : data[f];
    const result = getValue(field);
    const expected = editedValue !== undefined ? editedValue : dataValue;
    return result === expected;
  }
), { numRuns: 100 });
```

### UIコンポーネントテスト（例ベース）

`MediationFormatWarningDialog` のレンダリングテスト：

- `open=true` 時にダイアログが表示される
- タイトルに「フォーマット警告」が含まれる
- `WarningAmberIcon` が表示される
- 指定URLがクリック可能なリンクとして表示される
- 「OK」ボタンが `primary` カラーで表示される
- OKボタンクリック時に `onConfirm` が呼ばれる

### 統合テスト（例ベース）

`handleSave` のチェック順序テスト：

- RowAddWarning条件が満たされる場合、MediationFormatWarningより先に表示される
- RowAddWarning条件が満たされない場合、MediationFormatWarningのチェックが実行される
- MediationFormatWarningがOKされた後、SiteRegistration/FloorPlanチェックが実行される

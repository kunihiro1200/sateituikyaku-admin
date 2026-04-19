# デザインドキュメント

## 概要

業務リスト詳細画面の「サイト登録」タブにおいて、以下の2つの変更を行う。

1. **「物件一覧に行追加」フィールドの移動**：【確認後処理】セクションから【図面作成依頼】セクションの直下に移動し、薄いピンク（`#fce4ec`）背景で表示する
2. **条件付き必須バリデーション**：`cw_request_email_site`（CWの方へ依頼メール（サイト登録））に値が入った場合、`property_list_row_added`（物件一覧に行追加）のラベルを赤系（`error`カラー）で強調表示し、保存時に未入力であれば注意喚起POPUPを表示する

変更対象は `frontend/frontend/src/components/WorkTaskDetailModal.tsx` の `SiteRegistrationSection` コンポーネントおよび `handleSave` 関数のみ。バックエンドへの変更は不要。

## アーキテクチャ

### 変更範囲

```
frontend/frontend/src/components/WorkTaskDetailModal.tsx
  └── SiteRegistrationSection（内部コンポーネント）
        ├── 【図面作成依頼】セクション（#e8f5e9）
        │     └── [NEW] 「物件一覧に行追加」フィールド（#fce4ec背景）← ここに移動
        └── 【確認後処理】セクション（#fafafa）
              └── [REMOVE] 「物件一覧に行追加」フィールド ← ここから削除
  └── handleSave（関数）
        └── [NEW] 保存前バリデーション（条件付きPOPUP表示）
  └── [NEW] RowAddWarningDialog（注意喚起POPUPコンポーネント）
```

### 状態管理

既存の `editedData` / `getValue` パターンを踏襲する。新たに追加するstateは以下のみ：

```typescript
const [rowAddWarningDialog, setRowAddWarningDialog] = useState<{ open: boolean }>({ open: false });
```

## コンポーネントと インターフェース

### RowAddWarningDialog（新規）

注意喚起POPUPコンポーネント。既存の `DeadlineWarningDialog` と同様のパターンで実装する。

```typescript
interface RowAddWarningDialogProps {
  open: boolean;
  onConfirm: () => void;  // 「このまま保存」ボタン押下時
  onCancel: () => void;   // 「キャンセル」ボタン押下時
}
```

MUI の `Dialog` / `DialogTitle` / `DialogContent` / `DialogActions` / `Button` を使用する。

### SiteRegistrationSection の変更点

#### 【図面作成依頼】セクション末尾に追加

```tsx
{/* 物件一覧に行追加（#fce4ec背景） */}
<Box sx={{ bgcolor: '#fce4ec', borderRadius: 1, p: 1, mb: 1 }}>
  <EditableButtonSelect
    label="物件一覧に行追加*"
    field="property_list_row_added"
    options={['追加済', '未']}
    labelColor={getValue('cw_request_email_site') ? 'error' : 'text.secondary'}
  />
</Box>
```

`EditableButtonSelect` コンポーネントに `labelColor` プロパティを追加し、ラベル色を動的に切り替える。

#### 【確認後処理】セクションから削除

```tsx
{/* 削除: <EditableButtonSelect label="物件一覧に行追加*" field="property_list_row_added" options={['追加済', '未']} /> */}
```

### EditableButtonSelect の変更点

`labelColor` オプションプロパティを追加する：

```typescript
const EditableButtonSelect = ({
  label,
  field,
  options,
  labelColor,
}: {
  label: string;
  field: string;
  options: string[];
  labelColor?: 'error' | 'text.secondary';
}) => (
  <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
    <Grid item xs={4}>
      <Typography
        variant="body2"
        color={labelColor || 'text.secondary'}
        sx={{ fontWeight: labelColor === 'error' ? 700 : 500 }}
      >
        {label}
      </Typography>
    </Grid>
    ...
  </Grid>
);
```

### handleSave の変更点

保存前に条件チェックを追加する：

```typescript
const handleSave = async () => {
  if (!propertyNumber || Object.keys(editedData).length === 0) return;

  // 条件付きバリデーション: cw_request_email_site に値があり、property_list_row_added が空の場合
  const cwEmailSite = getValue('cw_request_email_site');
  const rowAdded = getValue('property_list_row_added');
  if (cwEmailSite && !rowAdded) {
    setRowAddWarningDialog({ open: true });
    return;
  }

  await executeSave();
};

const executeSave = async () => {
  setSaving(true);
  try {
    await api.put(`/api/work-tasks/${propertyNumber}`, editedData);
    setSnackbar({ open: true, message: '保存しました', severity: 'success' });
    await fetchData(false);
    setEditedData({});
    onUpdate?.();
  } catch (error) {
    console.error('Failed to save:', error);
    setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
  } finally {
    setSaving(false);
  }
};
```

## データモデル

バックエンドのDBスキーマ・APIへの変更は不要。

| フィールド | DBカラム | 型 | 変更 |
|---|---|---|---|
| 物件一覧に行追加 | `property_list_row_added` | TEXT | なし（選択肢・カラム名維持） |
| CWの方へ依頼メール（サイト登録） | `cw_request_email_site` | TEXT | なし（監視のみ） |

`property_list_row_added` の選択肢は `['追加済', '未']` のまま変更しない。

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことであり、人間が読める仕様と機械で検証可能な正確性保証の橋渡しをする形式的な記述です。*

### Property 1: ラベル色の切り替え

*For any* `cw_request_email_site` の値について、値が非空（truthy）であれば「物件一覧に行追加」ラベルのカラーは `error` であり、値が空（falsy）であれば `text.secondary` である

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 2: 保存時のPOPUP表示条件

*For any* `cw_request_email_site` と `property_list_row_added` の値の組み合わせについて、保存ボタン押下時にPOPUPが表示されるのは「`cw_request_email_site` が非空 かつ `property_list_row_added` が空」の場合のみである

**Validates: Requirements 3.1, 3.6, 3.7**

## エラーハンドリング

| シナリオ | 対応 |
|---|---|
| 注意喚起POPUP表示中に「キャンセル」 | `rowAddWarningDialog` を閉じ、保存処理を中断する |
| 注意喚起POPUP表示中に「このまま保存」 | `rowAddWarningDialog` を閉じ、`executeSave()` を実行する |
| API保存失敗 | 既存の `snackbar` エラー表示を維持する（変更なし） |
| `cw_request_email_site` が `'Y'` / `'N'` / 任意文字列 | いずれも「値あり」として扱い、POPUPトリガー条件を満たす |

## テスト戦略

### ユニットテスト（example-based）

以下の具体的なシナリオをテストする：

1. **フィールド配置確認**：「物件一覧に行追加」が【図面作成依頼】セクション直下に存在し、【確認後処理】セクションに存在しないこと
2. **背景色確認**：「物件一覧に行追加」フィールドのラッパーに `bgcolor: '#fce4ec'` が適用されていること
3. **選択肢確認**：「追加済」「未」ボタンが存在し、`property_list_row_added` フィールドに紐付いていること
4. **POPUPメッセージ確認**：POPUPに「物件一覧に行追加が未入力です。このまま保存しますか？」が表示されること
5. **POPUPボタン確認**：「このまま保存」「キャンセル」ボタンが存在すること
6. **「このまま保存」動作確認**：クリック後にAPIが呼ばれること
7. **「キャンセル」動作確認**：クリック後にAPIが呼ばれず、POPUPが閉じること
8. **既存フィールド維持確認**：【確認後処理】セクションに配信日・物件ファイル・公開予定日・メール配信・サイト登録締め日vが存在すること
9. **`isSiteDueDateRequired` 維持確認**：`cw_request_email_site` に値がある場合、「サイト登録納期予定日」ラベルに「*（必須）」が含まれること

### プロパティベーステスト（property-based）

プロパティベーステストには **fast-check**（TypeScript向けPBTライブラリ）を使用する。各テストは最低100回実行する。

#### Property 1: ラベル色の切り替え

```typescript
// Feature: business-site-registration-row-add-field, Property 1: ラベル色の切り替え
it.prop([fc.oneof(fc.constant('Y'), fc.constant('N'), fc.string({ minLength: 1 }))])(
  'cw_request_email_siteが非空の場合、物件一覧に行追加ラベルはerrorカラーになる',
  (cwEmailSiteValue) => {
    // cw_request_email_site に任意の非空値を設定してレンダリング
    // 「物件一覧に行追加」ラベルのcolorがerrorであることを確認
  }
);

it.prop([fc.oneof(fc.constant(null), fc.constant(''), fc.constant(undefined))])(
  'cw_request_email_siteが空の場合、物件一覧に行追加ラベルはtext.secondaryカラーになる',
  (cwEmailSiteValue) => {
    // cw_request_email_site に空値を設定してレンダリング
    // 「物件一覧に行追加」ラベルのcolorがtext.secondaryであることを確認
  }
);
```

#### Property 2: 保存時のPOPUP表示条件

```typescript
// Feature: business-site-registration-row-add-field, Property 2: 保存時のPOPUP表示条件
it.prop([
  fc.oneof(fc.constant('Y'), fc.constant('N'), fc.string({ minLength: 1 })),
  fc.oneof(fc.constant(null), fc.constant(''), fc.constant(undefined)),
])(
  'cw_request_email_siteが非空かつproperty_list_row_addedが空の場合、保存時にPOPUPが表示される',
  (cwEmailSiteValue, rowAddedValue) => {
    // 条件を設定して保存ボタンをクリック
    // POPUPが表示されることを確認
  }
);

it.prop([
  fc.oneof(fc.constant(null), fc.constant(''), fc.constant(undefined)),
  fc.option(fc.string({ minLength: 1 })),
])(
  'cw_request_email_siteが空の場合、保存時にPOPUPが表示されない',
  (cwEmailSiteValue, rowAddedValue) => {
    // cw_request_email_site が空の状態で保存ボタンをクリック
    // POPUPが表示されないことを確認
  }
);

it.prop([
  fc.oneof(fc.constant('Y'), fc.constant('N'), fc.string({ minLength: 1 })),
  fc.oneof(fc.constant('追加済'), fc.constant('未')),
])(
  'property_list_row_addedに値がある場合、保存時にPOPUPが表示されない',
  (cwEmailSiteValue, rowAddedValue) => {
    // property_list_row_added に値がある状態で保存ボタンをクリック
    // POPUPが表示されないことを確認
  }
);
```

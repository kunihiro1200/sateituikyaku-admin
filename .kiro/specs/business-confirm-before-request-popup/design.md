# デザイン設計書

## 概要

業務詳細画面（WorkTaskDetailModal）の「契約決済」タブにある「依頼前に確認」フィールドを、`EditableMultilineField` から「確認する」ボタン + MUI Dialog ポップアップに置き換える。

ロングテキストを4行のテキストエリアに押し込む現在の実装を改善し、ボタンクリックで全文をスクロール可能なポップアップに表示する。バックエンド変更なし、フロントエンドのみの変更。

---

## アーキテクチャ

変更対象は `WorkTaskDetailModal.tsx` 内の `ContractSettlementSection` コンポーネントのみ。

```
WorkTaskDetailModal
  └── ContractSettlementSection
        ├── [変更前] EditableMultilineField (label="依頼前に確認", field="pre_request_check")
        └── [変更後] PreRequestCheckButton  ← 新規インラインコンポーネント
                        └── PreRequestCheckPopup (Dialog) ← 新規インラインコンポーネント
```

新規コンポーネントは小規模なため、`WorkTaskDetailModal.tsx` 内にインラインで定義する。

---

## コンポーネントとインターフェース

### PreRequestCheckButton

`ContractSettlementSection` 内で `EditableMultilineField` を置き換えるコンポーネント。

```tsx
// プロパティなし（親スコープの getValue を直接参照）
const PreRequestCheckButton = () => { ... }
```

**レンダリング構造:**

```tsx
<Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
  <Grid item xs={4}>
    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
      依頼前に確認
    </Typography>
  </Grid>
  <Grid item xs={8}>
    <Button
      variant="outlined"
      size="small"
      disabled={!getValue('pre_request_check')}
      onClick={() => setPopupOpen(true)}
    >
      確認する
    </Button>
    <PreRequestCheckPopup
      open={popupOpen}
      text={getValue('pre_request_check') || ''}
      onClose={() => setPopupOpen(false)}
    />
  </Grid>
</Grid>
```

**ボタンの有効/無効ロジック:**
- `pre_request_check` が `null`、`undefined`、空文字列 → `disabled={true}`
- それ以外（1文字以上のテキスト） → `disabled={false}`

### PreRequestCheckPopup

ロングテキストを全文表示する MUI Dialog コンポーネント。

```tsx
interface PreRequestCheckPopupProps {
  open: boolean;
  text: string;
  onClose: () => void;
}

const PreRequestCheckPopup = ({ open, text, onClose }: PreRequestCheckPopupProps) => { ... }
```

**レンダリング構造:**

```tsx
<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
  <DialogTitle>依頼前に確認</DialogTitle>
  <DialogContent dividers sx={{ overflowY: 'auto', maxHeight: '60vh' }}>
    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {text}
    </Typography>
  </DialogContent>
  <DialogActions>
    <Button onClick={onClose}>閉じる</Button>
  </DialogActions>
</Dialog>
```

---

## データモデル

バックエンド変更なし。既存の `pre_request_check` フィールド（ロングテキスト型）をそのまま使用。

```typescript
// WorkTaskData インターフェース（既存、変更なし）
interface WorkTaskData {
  // ...
  pre_request_check: string;  // ロングテキスト、null許容
  // ...
}
```

**状態管理:**

`PreRequestCheckButton` 内にポップアップの開閉状態を `useState` で管理する。

```typescript
const [popupOpen, setPopupOpen] = useState(false);
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property 1: 空値でボタンが無効化される

*For any* `pre_request_check` の値が「空」（null、undefined、空文字列）である場合、「確認する」ボタンは常に `disabled` 状態でレンダリングされる。

**Validates: Requirements 1.2**

### Property 2: 非空値でボタンが有効化される

*For any* 1文字以上のテキストが `pre_request_check` に設定されている場合、「確認する」ボタンは常に `enabled` 状態でレンダリングされる。

**Validates: Requirements 1.3**

### Property 3: テキスト内容がポップアップに表示される

*For any* 任意の文字列が `pre_request_check` に設定されている場合、ポップアップを開いたときにその文字列全体がポップアップ内に表示される。

**Validates: Requirements 2.2**

### Property 4: 改行が正しく表示される

*For any* 改行文字（`\n`）を含む文字列が `pre_request_check` に設定されている場合、ポップアップ内の表示要素に `whiteSpace: pre-wrap` が適用されており、改行が画面上の改行として表示される。

**Validates: Requirements 2.4**

---

## エラーハンドリング

| ケース | 対応 |
|--------|------|
| `pre_request_check` が null/undefined | ボタンを disabled 表示。ポップアップは開かない |
| `pre_request_check` が空文字列 | 同上 |
| 非常に長いテキスト | DialogContent に `maxHeight: '60vh'` + `overflowY: 'auto'` でスクロール対応 |
| 改行を含むテキスト | `whiteSpace: 'pre-wrap'` で正しく表示 |

---

## テスト戦略

### PBT適用性の評価

このフィーチャーは主にUIコンポーネントのレンダリングとインタラクションを扱う。純粋関数ではなく、Reactコンポーネントのレンダリング結果を検証するため、プロパティベーステストは限定的に適用できる。

ただし、ボタンの有効/無効ロジックとテキスト表示ロジックは入力値によって変化するため、プロパティテストが有効。

### ユニットテスト（例ベース）

- `pre_request_check` が null のとき、ボタンが disabled であること
- `pre_request_check` が空文字列のとき、ボタンが disabled であること
- `pre_request_check` に値があるとき、ボタンが enabled であること
- ボタンクリックでダイアログが開くこと
- ダイアログのタイトルが「依頼前に確認」であること
- 「閉じる」ボタンクリックでダイアログが閉じること
- バックドロップクリックでダイアログが閉じること
- ポップアップ内に編集可能な input/textarea が存在しないこと
- 他のフィールド（「重説・契約書入力納期*」等）が引き続きレンダリングされること

### プロパティテスト（fast-check 使用）

**ライブラリ**: [fast-check](https://github.com/dubzzz/fast-check)（TypeScript/JavaScript向けPBTライブラリ）

**最小実行回数**: 各プロパティテスト 100 回以上

```typescript
// Property 1 & 2: ボタンの有効/無効ロジック
// Feature: business-confirm-before-request-popup, Property 1 & 2: button disabled/enabled state
fc.assert(fc.property(
  fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant('')),
  (emptyValue) => {
    // emptyValue でレンダリングしたとき、ボタンが disabled であること
  }
), { numRuns: 100 });

fc.assert(fc.property(
  fc.string({ minLength: 1 }),
  (nonEmptyText) => {
    // nonEmptyText でレンダリングしたとき、ボタンが enabled であること
  }
), { numRuns: 100 });

// Property 3: テキスト内容がポップアップに表示される
// Feature: business-confirm-before-request-popup, Property 3: text content displayed in popup
fc.assert(fc.property(
  fc.string({ minLength: 1 }),
  (text) => {
    // text でレンダリングしてポップアップを開いたとき、text が表示されること
  }
), { numRuns: 100 });

// Property 4: 改行が正しく表示される
// Feature: business-confirm-before-request-popup, Property 4: newlines rendered correctly
fc.assert(fc.property(
  fc.string({ minLength: 1 }).map(s => s + '\n' + s),
  (textWithNewline) => {
    // 改行を含むテキストで、whiteSpace: pre-wrap が適用されていること
  }
), { numRuns: 100 });
```

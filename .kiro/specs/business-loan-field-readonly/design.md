# 設計書

## 概要

業務詳細画面（`WorkTaskDetailModal`）の「売主、買主詳細」タブにある「ローン」フィールドを、ボタン選択（`EditableButtonSelect`）から読み取り専用テキスト表示（`ReadOnlyDisplayField`）に変更する。

「ローン」フィールドの値はスプレッドシートからGAS経由でDBに同期されるため、フロントエンドからの編集は不要であり、誤操作防止のために読み取り専用化する。

---

## アーキテクチャ

### 変更スコープ

本変更はフロントエンドのみに限定される。

```
フロントエンド（変更あり）
  └── WorkTaskDetailModal.tsx
        └── SellerBuyerDetailSection
              └── loan フィールド: EditableButtonSelect → ReadOnlyDisplayField

バックエンド（変更なし）
  └── PUT /api/work-tasks/:propertyNumber
        └── loan フィールドはもともとフロントから送信されていない想定

GAS（変更なし）
  └── GyomuWorkTaskSync.gs
        └── COLUMN_MAPPING: 'ローン': 'loan' は既に実装済み
```

### データフロー

```
スプレッドシート「ローン」列
    ↓ GAS（10分ごと自動同期）
work_tasks.loan カラム
    ↓ GET /api/work-tasks/:propertyNumber
WorkTaskDetailModal（表示のみ）
```

---

## コンポーネントとインターフェース

### 変更対象: `SellerBuyerDetailSection`

**ファイル**: `frontend/frontend/src/components/WorkTaskDetailModal.tsx`

#### 変更前

```tsx
<EditableButtonSelect label="ローン" field="loan" options={['あり', 'なし']} />
```

#### 変更後

```tsx
<ReadOnlyDisplayField label="ローン" value={getValue('loan') || '-'} />
```

### 既存コンポーネントの仕様

#### `ReadOnlyDisplayField`

既にファイル内に定義済みのコンポーネント。

```tsx
const ReadOnlyDisplayField = ({ label, value, labelColor }: {
  label: string;
  value: string | null;
  labelColor?: 'error' | 'text.secondary';
}) => (
  <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 1.5 }}>
    <Grid item xs={4}>
      <Typography variant="body2" color={labelColor || 'text.secondary'} sx={{ fontWeight: 500, pt: 0.5 }}>
        {label}
      </Typography>
    </Grid>
    <Grid item xs={8}>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {value || ''}
      </Typography>
    </Grid>
  </Grid>
);
```

`value` が `null` または空文字の場合は空文字を表示する。要件では `-` 表示も許容されているため、呼び出し側で `getValue('loan') || '-'` とすることで null 時にハイフンを表示する。

---

## データモデル

### `work_tasks` テーブル（変更なし）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `loan` | `text` | ローンの有無。値は「あり」または「なし」。GAS同期のみで更新される |

### フロントエンドの状態管理（変更なし）

`WorkTaskDetailModal` は `editedTask` ステートで編集中の値を管理している。`loan` フィールドは `ReadOnlyDisplayField` に変更することで `handleFieldChange` が呼ばれなくなり、保存時のペイロードに含まれなくなる。

---

## エラーハンドリング

### null / 空値の扱い

`loan` カラムが `null` または空文字の場合、`getValue('loan') || '-'` によりハイフン（`-`）を表示する。これにより「値なし」の状態が明示的に表現される。

### 既存エラーハンドリングへの影響なし

`loan` フィールドを `ReadOnlyDisplayField` に変更しても、他フィールドの保存処理・エラーハンドリングには一切影響しない。

---

## テスト戦略

本機能はシンプルなUIコンポーネント変更であり、純粋関数や入力空間が広いロジックを含まないため、プロパティベーステスト（PBT）は適用しない。例ベースのユニットテストで十分な品質を確保できる。

### ユニットテスト（例ベース）

#### テスト1: ローンフィールドが ReadOnlyDisplayField として表示される

- `loan = 'あり'` でレンダリングし、`EditableButtonSelect` が存在しないことを確認
- `loan = 'あり'` でレンダリングし、テキスト「あり」が表示されることを確認

#### テスト2: ローンフィールドが「なし」を正しく表示する

- `loan = 'なし'` でレンダリングし、テキスト「なし」が表示されることを確認

#### テスト3: loan が null のときハイフンを表示する（エッジケース）

- `loan = null` でレンダリングし、`-` が表示されることを確認

#### テスト4: ローンフィールドにインタラクティブ要素が存在しない

- レンダリング後、ローンラベル周辺に `<button>` や `<input>` が存在しないことを確認

#### テスト5: 他フィールドへの影響なし

- `financial_institution` フィールドが `<input>` として存在することを確認
- `seller_contact_name` フィールドが `<input>` として存在することを確認

#### テスト6: loan フィールドが保存ペイロードに含まれない

- `financial_institution` を変更して保存し、API呼び出しのペイロードに `loan` が含まれないことを確認

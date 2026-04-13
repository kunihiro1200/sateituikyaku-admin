# 設計書：物件一覧テーブルの列表示変更

## 概要

物件リストページ（`PropertyListingsPage`）のデスクトップ用テーブルにおいて、以下の列変更を行う。

- 「公開URL」列を削除（`PublicUrlCell` コンポーネントを含む）
- 「格納先URL」列を削除（`storage_location` フィールドを使用する `Link` コンポーネントを含む）
- 「所在地」列の直後に「住居表示」列を追加（`display_address` フィールドを表示）
- `colSpan` を 12 → 11 に更新

変更対象はフロントエンドのみ。バックエンドおよびデータベースへの変更は不要。

---

## アーキテクチャ

### 変更対象

| 項目 | 詳細 |
|------|------|
| 対象ファイル | `frontend/frontend/src/pages/PropertyListingsPage.tsx` |
| 変更種別 | フロントエンドのみ（UI変更） |
| バックエンド変更 | 不要 |
| DB変更 | 不要（`display_address` カラムは既存） |

### 変更前後の列構成

**変更前（12列）**:
```
チェックボックス / 物件番号 / 担当 / 種別 / 所在地 / 売主 / ATBB状況 / 買主 / 契約日 / 決済日 / 売買価格 / 公開URL / 格納先URL
```

**変更後（11列）**:
```
チェックボックス / 物件番号 / 担当 / 種別 / 所在地 / 住居表示 / 売主 / ATBB状況 / 買主 / 契約日 / 決済日 / 売買価格
```

---

## コンポーネントとインターフェース

### 変更箇所の詳細

#### 1. テーブルヘッダー（`<TableHead>`）

**削除**:
```tsx
<TableCell>公開URL</TableCell>
<TableCell>格納先URL</TableCell>
```

**追加**（「所在地」の `<TableCell>` の直後）:
```tsx
<TableCell>住居表示</TableCell>
```

#### 2. テーブルデータ行（`<TableBody>` 内の各 `<TableRow>`）

**削除**:
```tsx
<TableCell onClick={(e) => e.stopPropagation()}>
  <PublicUrlCell propertyNumber={listing.property_number} />
</TableCell>
<TableCell onClick={(e) => e.stopPropagation()}>
  {listing.storage_location ? (
    <Link ...>Google Drive</Link>
  ) : (
    <Typography variant="body2" color="text.secondary">-</Typography>
  )}
</TableCell>
```

**追加**（「所在地」セルの直後）:
```tsx
<TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
  {listing.display_address || '-'}
</TableCell>
```

#### 3. `colSpan` の更新

ローディング中および空データ表示時の `TableCell colSpan` を `12` → `11` に変更する。

**変更前**:
```tsx
<TableCell colSpan={12} align="center">読み込み中...</TableCell>
<TableCell colSpan={12} align="center">...</TableCell>
```

**変更後**:
```tsx
<TableCell colSpan={11} align="center">読み込み中...</TableCell>
<TableCell colSpan={11} align="center">...</TableCell>
```

#### 4. `PublicUrlCell` インポートの削除

`PublicUrlCell` コンポーネントが不要になるため、インポート文を削除する。

**削除**:
```tsx
import PublicUrlCell from '../components/PublicUrlCell';
```

---

## データモデル

### `PropertyListing` インターフェース

`display_address` フィールドはすでに `PropertyListing` インターフェースに定義済みのため、変更不要。

```typescript
interface PropertyListing {
  // ...既存フィールド...
  address?: string;
  display_address?: string;  // ← 既存（変更不要）
  storage_location?: string; // ← 削除しない（型定義は残す）
  // ...
}
```

> `storage_location` はインターフェース定義から削除しない。他の箇所で参照されている可能性があるため。

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いのことである。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをする。*

事前分析の結果、本機能はUIレンダリングの変更が中心であり、純粋関数的なロジックは少ない。ただし、`display_address` の表示ロジック（値がある場合は表示、ない場合は「-」）はプロパティベーステストの対象となる。

### プロパティ1: display_address の値がセルに表示される

*任意の* 非空の `display_address` 値を持つ物件データに対して、「住居表示」列のセルにその値がそのまま表示される。

**Validates: 要件 3.2**

### プロパティ2: 空の display_address はフォールバック表示される

*任意の* `display_address` が `null`、`undefined`、または空文字列の物件データに対して、「住居表示」列のセルには「-」が表示される。

**Validates: 要件 3.3**

---

## エラーハンドリング

本変更はUIの列表示変更のみであり、新たなエラーハンドリングは不要。

ただし、以下の点に注意する：

| ケース | 対応 |
|--------|------|
| `display_address` が `null` | `listing.display_address \|\| '-'` で「-」を表示 |
| `display_address` が `undefined` | 同上 |
| `display_address` が空文字 | 同上（`''` は falsy のため「-」が表示される） |

---

## テスト戦略

### PBT適用判断

本機能はUIレンダリングの変更が主体であるため、プロパティベーステスト（PBT）の適用範囲は限定的。`display_address` の表示ロジックのみPBTが有効。

### 単体テスト（例ベース）

以下の項目を例ベーステストで確認する：

1. テーブルヘッダーに「公開URL」が存在しないこと（要件 1.1）
2. テーブルヘッダーに「格納先URL」が存在しないこと（要件 2.1）
3. テーブルヘッダーに「住居表示」が「所在地」の直後に存在すること（要件 3.1）
4. データ行に `PublicUrlCell` コンポーネントが存在しないこと（要件 1.2）
5. データ行に `storage_location` を使った `Link` が存在しないこと（要件 2.2）
6. 「住居表示」セルに正しいスタイル（`maxWidth: 200` 等）が適用されていること（要件 3.4）
7. ローディング状態で `colSpan={11}` の `TableCell` が存在すること（要件 4.1）
8. 空データ状態で `colSpan={11}` の `TableCell` が存在すること（要件 4.2）

### プロパティベーステスト

プロパティテストライブラリ: `fast-check`（TypeScript/React プロジェクトに適合）

各テストは最低100回のイテレーションで実行する。

**プロパティ1のテスト実装方針**:
```
// Feature: property-list-column-display-update, Property 1: display_address の値がセルに表示される
// fast-check で任意の非空文字列を生成し、display_address に設定してレンダリング
// 「住居表示」セルにその値が表示されることを確認
```

**プロパティ2のテスト実装方針**:
```
// Feature: property-list-column-display-update, Property 2: 空の display_address はフォールバック表示される
// fast-check で null / undefined / 空文字 / 空白のみの文字列を生成
// 「住居表示」セルに「-」が表示されることを確認
```

### 実装時の注意事項（UTF-8保護）

`PropertyListingsPage.tsx` は日本語を含むファイルのため、編集時は必ずPythonスクリプトを使用してUTF-8エンコーディングを保護すること。`strReplace` ツールの直接使用は禁止。

```python
# 変更適用スクリプトの例
with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')
# 変更を適用...
with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
```

# 設計ドキュメント

## 概要

売主通話モードページ（CallModePage）の「近隣買主」テーブル（`NearbyBuyersList` コンポーネント）に、以下の2機能を追加する。

1. **名前非表示ボタン**: テーブル内の買主名を黒塗り表示に切り替えるトグルボタン
2. **PDFボタン**: チェック済み行のみを印刷対象にし、会社情報を右上に表示する印刷機能

どちらの機能も `NearbyBuyersList.tsx` コンポーネントのみを変更する純粋なフロントエンド実装であり、バックエンドへの変更は不要。

---

## アーキテクチャ

### 変更対象

| ファイル | 変更種別 | 説明 |
|---------|---------|------|
| `frontend/frontend/src/components/NearbyBuyersList.tsx` | 変更 | 名前非表示ボタン・PDFボタンの追加 |

バックエンド変更なし。APIの追加・変更なし。

### 状態管理

既存の React `useState` フックを拡張する。新規追加する状態は以下の2つのみ。

```
isNameHidden: boolean   // 名前非表示トグルの状態
```

PDF印刷は `window.print()` を利用するブラウザネイティブ機能のため、追加の状態管理は不要。

---

## コンポーネントとインターフェース

### NearbyBuyersList コンポーネント

既存の `NearbyBuyersListProps` インターフェースへの変更なし。

#### 追加する状態

```typescript
const [isNameHidden, setIsNameHidden] = useState<boolean>(false);
```

#### 追加するハンドラ

```typescript
// 名前非表示トグル
const handleToggleNameHidden = () => {
  setIsNameHidden(prev => !prev);
};

// PDF印刷
const handlePrint = () => {
  if (selectedBuyers.size === 0) {
    setSnackbar({
      open: true,
      message: '印刷する行を選択してください',
      severity: 'warning',
    });
    return;
  }
  window.print();
};
```

---

## データモデル

既存の `NearbyBuyer` インターフェースへの変更なし。新規データモデルの追加なし。

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性または振る舞いのことであり、人間が読める仕様と機械で検証可能な正確性保証の橋渡しをする形式的な記述である。*

### プロパティ1: 名前非表示状態の不変条件

*任意の* 買主リストに対して、名前非表示ボタンを押した後は、全行の名前セルが黒塗りスタイル（backgroundColor: 'black', color: 'black'）になり、かつ受付日（reception_date）は変わらず表示され続ける。

**Validates: Requirements 1.2, 1.3**

### プロパティ2: 名前非表示トグルのラウンドトリップ

*任意の* 買主リストに対して、名前非表示ボタンを押して非表示にした後、再度ボタンを押すと全行の名前が元の表示状態に戻る。

**Validates: Requirements 1.4**

### プロパティ3: 印刷対象の選択フィルタリング

*任意の* 買主リストと任意の選択状態（1件以上）に対して、PDFボタンを押した際に生成される印刷用コンテンツには、チェックが入っている行のみが含まれ、チェックが入っていない行は含まれない。

**Validates: Requirements 2.3, 2.4**

### プロパティ4: 印刷レイアウトの会社情報

*任意の* 選択状態（1件以上）でPDFボタンを押した際、印刷用コンテンツには必ず「株式会社いふう」「大分市舞鶴町1-3-30 STビル１F」「097-533-2022」の会社情報が含まれる。

**Validates: Requirements 2.5**

### プロパティ5: 名前非表示状態での印刷

*任意の* 買主リストで名前非表示状態（isNameHidden = true）のときにPDFボタンを押した場合、印刷用コンテンツでも名前セルが黒塗りスタイルになっている。

**Validates: Requirements 2.8**

---

## エラーハンドリング

| 条件 | 対応 |
|------|------|
| PDFボタン押下時に選択行が0件 | 既存の `Snackbar` を使って「印刷する行を選択してください」を `severity: 'warning'` で表示。`window.print()` は呼ばない。 |

---

## テスト戦略

### ユニットテスト（具体例ベース）

以下の具体的なシナリオをカバーする：

- 「名前非表示」ボタンが初期状態でレンダリングされること（要件 1.1）
- 「PDF」ボタンが初期状態でレンダリングされること（要件 2.1）
- 名前非表示ボタン押下後、ボタンラベルが「名前表示」に変わること（要件 1.5）
- PDFボタン押下時に `window.print` が呼ばれること（要件 2.2）
- 0件選択状態でPDFボタンを押すと警告が表示され `window.print` が呼ばれないこと（要件 2.7）
- 印刷レイアウトでチェックボックス列が非表示になること（要件 2.6）
- 印刷後（`afterprint` イベント）に通常表示に戻ること（要件 2.9）

### プロパティベーステスト（PBT）

PBTライブラリ: **fast-check**（TypeScript/React プロジェクトに適合）

各プロパティテストは最低100回のイテレーションで実行する。

#### プロパティ1のテスト実装方針

```
Feature: seller-callmode-nearby-buyers-table-enhancements, Property 1: 名前非表示状態の不変条件
```

- `fc.array(fc.record({ buyer_number: fc.string(), name: fc.string(), reception_date: fc.option(fc.string()), ... }))` で任意の買主リストを生成
- 名前非表示ボタンをクリック後、全行の名前セルのスタイルを検証
- 同時に受付日が変わらず表示されていることを検証

#### プロパティ2のテスト実装方針

```
Feature: seller-callmode-nearby-buyers-table-enhancements, Property 2: 名前非表示トグルのラウンドトリップ
```

- 任意の買主リストを生成
- ボタン押下 → 非表示確認 → 再押下 → 元の表示に戻ることを確認

#### プロパティ3のテスト実装方針

```
Feature: seller-callmode-nearby-buyers-table-enhancements, Property 3: 印刷対象の選択フィルタリング
```

- 任意の買主リストと任意の選択セット（1件以上）を生成
- 印刷用コンテンツ生成ロジックを純粋関数として抽出してテスト
- 選択行のみが含まれ、非選択行が含まれないことを検証

#### プロパティ4のテスト実装方針

```
Feature: seller-callmode-nearby-buyers-table-enhancements, Property 4: 印刷レイアウトの会社情報
```

- 任意の選択状態を生成
- 印刷用コンテンツに会社情報3項目が全て含まれることを検証

#### プロパティ5のテスト実装方針

```
Feature: seller-callmode-nearby-buyers-table-enhancements, Property 5: 名前非表示状態での印刷
```

- 任意の買主リストを生成
- 名前非表示状態でPDF印刷した際の印刷用コンテンツで、名前セルが黒塗りスタイルになっていることを検証


---

## 実装詳細

### 名前非表示ボタン

#### UIの変更

既存のアクションボタン行（`<Box sx={{ mb: 2, display: 'flex', gap: 1 }}>` 内）に追加する。

```tsx
<Button
  variant={isNameHidden ? 'contained' : 'outlined'}
  color="warning"
  onClick={handleToggleNameHidden}
>
  {isNameHidden ? '名前表示' : '名前非表示'}
</Button>
```

#### 名前セルの変更

既存の名前セル（`<Typography variant="body2">{buyer.name || '-'}</Typography>`）に条件付きスタイルを適用する。

```tsx
<Typography
  variant="body2"
  sx={isNameHidden ? {
    backgroundColor: 'black',
    color: 'black',
    borderRadius: '2px',
    userSelect: 'none',
  } : {}}
>
  {buyer.name || '-'}
</Typography>
```

受付日の `<Typography variant="caption">` は変更しない（要件 1.3）。

---

### PDFボタン

#### UIの変更

既存のアクションボタン行に追加する。

```tsx
<Button
  variant="outlined"
  onClick={handlePrint}
>
  PDF
</Button>
```

#### 印刷用CSSの実装方針

`window.print()` を使ったブラウザネイティブ印刷を採用する。印刷時の表示制御は CSS `@media print` で行う。

**実装アプローチ**: `<style>` タグを動的に挿入し、印刷後に削除する。

```typescript
const handlePrint = () => {
  if (selectedBuyers.size === 0) {
    setSnackbar({ open: true, message: '印刷する行を選択してください', severity: 'warning' });
    return;
  }

  // 印刷用スタイルを動的に挿入
  const style = document.createElement('style');
  style.id = 'nearby-buyers-print-style';
  style.textContent = `
    @media print {
      /* 印刷時は近隣買主テーブル以外を非表示 */
      body > * { display: none !important; }
      #nearby-buyers-print-root { display: block !important; }
    }
  `;
  document.head.appendChild(style);

  // 印刷用コンテンツをbodyに追加
  const printRoot = document.createElement('div');
  printRoot.id = 'nearby-buyers-print-root';
  printRoot.innerHTML = buildPrintContent();
  document.body.appendChild(printRoot);

  // 印刷後にクリーンアップ
  const cleanup = () => {
    document.head.removeChild(style);
    document.body.removeChild(printRoot);
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  window.print();
};
```

#### 印刷コンテンツ生成（`buildPrintContent` 関数）

選択行のみを含む印刷用HTMLを生成する純粋関数として実装する。テスト容易性のためコンポーネント外に切り出すことを推奨。

```typescript
// 印刷用HTMLを生成する純粋関数（テスト可能）
export const buildPrintContent = (
  buyers: NearbyBuyer[],
  selectedBuyerNumbers: Set<string>,
  isNameHidden: boolean
): string => {
  const selectedBuyers = buyers.filter(b => selectedBuyerNumbers.has(b.buyer_number));

  const rows = selectedBuyers.map(buyer => `
    <tr>
      <td>${buyer.buyer_number}</td>
      <td style="${isNameHidden ? 'background-color:black;color:black;' : ''}">
        ${buyer.name || '-'}
      </td>
      <td>${buyer.reception_date ? new Date(buyer.reception_date).toLocaleDateString('ja-JP') : '-'}</td>
      <td>${(buyer.distribution_areas || []).join(', ') || '-'}</td>
      <td>${buyer.inquiry_property_type || '-'}</td>
      <td>${buyer.inquiry_price ? `${(buyer.inquiry_price / 10000).toLocaleString()}万円` : '-'}</td>
      <td>${buyer.latest_status || '-'}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: sans-serif; padding: 20px;">
      <div style="text-align: right; margin-bottom: 16px;">
        <div>株式会社いふう</div>
        <div>大分市舞鶴町1-3-30 STビル１F</div>
        <div>097-533-2022</div>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr>
            <th style="border:1px solid #ccc; padding:4px;">買主番号</th>
            <th style="border:1px solid #ccc; padding:4px;">名前</th>
            <th style="border:1px solid #ccc; padding:4px;">受付日</th>
            <th style="border:1px solid #ccc; padding:4px;">配布エリア</th>
            <th style="border:1px solid #ccc; padding:4px;">物件種別</th>
            <th style="border:1px solid #ccc; padding:4px;">価格</th>
            <th style="border:1px solid #ccc; padding:4px;">最新状況</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
};
```

#### 設計上の決定事項

| 決定 | 理由 |
|------|------|
| `window.print()` を使用（PDF生成ライブラリ不使用） | 追加依存なし、ブラウザ標準機能で十分 |
| 印刷用HTMLを動的に `body` に追加する方式 | 既存のMUIコンポーネントのCSSと干渉しない |
| `buildPrintContent` を純粋関数として切り出す | プロパティベーステストが容易になる |
| `afterprint` イベントでクリーンアップ | 印刷ダイアログを閉じた後に確実に通常表示に戻る（要件 2.9） |

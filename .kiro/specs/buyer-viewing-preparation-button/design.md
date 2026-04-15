# 設計書：内覧準備ボタン（buyer-viewing-preparation-button）

## 概要

買主詳細画面（`/buyers/:buyer_number`）のヘッダーに「内覧準備」ボタンを追加する。
ボタンクリック時にMUI `Dialog` を使ったポップアップが開き、内覧前に必要な情報を一覧表示する。
具体的には、買主番号・物件番号のワンクリックコピー機能と、スプシの資料・ATBBへの固定リンク2件を提供する。

本機能はフロントエンドのみの変更で完結する。バックエンドへの変更は不要。

## アーキテクチャ

```
BuyerDetailPage.tsx
  └── ViewingPreparationButton（新規コンポーネント）
        └── ViewingPreparationPopup（新規コンポーネント）
              ├── 買主番号コピーエリア（buyer.buyer_number）
              ├── 物件番号コピーエリア（linked property の property_number）
              ├── スプシの資料リンク（固定URL）
              └── ATBBリンク（固定URL）
```

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/frontend/src/pages/BuyerDetailPage.tsx` | 「近隣物件」ボタンの左側に `ViewingPreparationButton` を追加 |
| `frontend/frontend/src/components/ViewingPreparationButton.tsx` | 新規作成（ボタン本体） |
| `frontend/frontend/src/components/ViewingPreparationPopup.tsx` | 新規作成（ポップアップ） |

### 売主版との対比

売主版（`VisitPreparationButton` / `VisitPreparationPopup`）と比較した主な差異：

| 項目 | 売主版（訪問準備） | 買主版（内覧準備） |
|------|-----------------|-----------------|
| コピー対象 | 売主番号・物件住所 | 買主番号・物件番号 |
| リンク数 | 6件（固定4 + 動的2） | 2件（固定のみ） |
| 動的リンク | 査定書URL・近隣買主 | なし |
| 配置場所 | CallModePage ヘッダー | BuyerDetailPage ヘッダー |

## コンポーネントとインターフェース

### ViewingPreparationButton

ボタン本体のコンポーネント。クリック時にポップアップの開閉状態を管理する。

```typescript
interface ViewingPreparationButtonProps {
  buyerNumber: string | null | undefined;
  propertyNumber: string | null | undefined;
}
```

- MUI `Button` を使用、`variant="outlined"`、`size="small"`
- 内部で `open` 状態を管理し、`ViewingPreparationPopup` に渡す

### ViewingPreparationPopup

ポップアップダイアログのコンポーネント。

```typescript
interface ViewingPreparationPopupProps {
  open: boolean;
  onClose: () => void;
  buyerNumber: string | null | undefined;
  propertyNumber: string | null | undefined;
}
```

- MUI `Dialog` を使用（`maxWidth="sm"` / `fullWidth`）
- `onClose` は閉じるボタンクリック時・ダイアログ外クリック時に呼ばれる

### CopyButton（内部コンポーネント）

買主番号・物件番号のワンクリックコピー用コンポーネント。売主版の `CopyButton` と同等の実装。

```typescript
interface CopyButtonProps {
  text: string;
  label: string;
}
```

- クリックで `navigator.clipboard.writeText()` を呼び出す
- コピー成功時に `ContentCopyIcon` → `CheckIcon` へアイコン変化（1500ms後に元に戻る）
- フォールバック：`navigator.clipboard` が使えない場合は `document.execCommand('copy')` を使用

### BuyerDetailPage への組み込み

「近隣物件」ボタンの左側に `ViewingPreparationButton` を配置する。

```tsx
{/* 内覧準備ボタン（新規追加） */}
<ViewingPreparationButton
  buyerNumber={buyer?.buyer_number}
  propertyNumber={linkedProperties[0]?.property_number}
/>
{/* 近隣物件ボタン（既存） */}
<Button variant="outlined" size="small" onClick={...}>
  近隣物件
</Button>
```

## データモデル

### 固定リンク定義

```typescript
// コンポーネント内定数として定義
const FIXED_LINKS = [
  {
    label: 'スプシの資料',
    url: 'https://docs.google.com/spreadsheets/d/1M9uVzHWD2ipzoY5Om3h3a2-_uQa9D_UGhpB5U4_nyRc/edit?gid=195766785#gid=195766785',
  },
  {
    label: 'ATBB',
    description: '①詳細ページと②地図③インフォシートを印刷',
    url: 'https://atbb.athome.jp/',
  },
] as const;
```

### ポップアップ表示構造

```
DialogTitle: 「内覧準備資料」
DialogContent:
  ├── 注意書き: 「※準備前にカレンダーに●をつけてください」（赤色・太字）
  ├── コピーエリア（リスト形式）
  │   ├── 買主番号: {buyerNumber} または「（未設定）」
  │   └── 物件番号: {propertyNumber} または「（未設定）」
  └── リンク一覧（番号付きリスト）
      ├── 1. スプシの資料: [リンク]
      └── 2. ATBB: ①詳細ページと②地図③インフォシートを印刷 [リンク]
DialogActions:
  └── 閉じるボタン
```

### 値が存在しない場合の表示

| 状況 | 表示 |
|------|------|
| `buyerNumber` が `null` / `undefined` / 空文字 | 「（未設定）」（コピー不可） |
| `propertyNumber` が `null` / `undefined` / 空文字 | 「（未設定）」（コピー不可） |

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ1：コピー可能な値の表示

*任意の* 買主番号・物件番号の文字列に対して、`ViewingPreparationPopup` はそれぞれ「買主番号」「物件番号」ラベルとともに値を表示すること。

**Validates: Requirements 3.1, 4.1**

### プロパティ2：クリップボードへのコピー

*任意の* 非空文字列の買主番号または物件番号に対して、対応するコピーエリアをクリックすると `navigator.clipboard.writeText` がその値で呼び出されること。

**Validates: Requirements 3.2, 4.2**

### プロパティ3：外部リンクのセキュリティ属性

*全ての* 外部リンク（`target="_blank"` を持つアンカー要素）に対して、`rel="noopener noreferrer"` 属性が設定されていること。

**Validates: Requirements 5.3, 6.3**

## エラーハンドリング

| 状況 | 対応 |
|------|------|
| `buyerNumber` が `null` / `undefined` | 「（未設定）」を表示し、コピーボタンを非表示またはdisabled |
| `propertyNumber` が `null` / `undefined` | 「（未設定）」を表示し、コピーボタンを非表示またはdisabled |
| `navigator.clipboard` が使用不可 | `document.execCommand('copy')` にフォールバック |
| ポップアップ外クリック | `onClose` を呼び出してダイアログを閉じる |

## テスト戦略

### PBT適用性の評価

本機能はUIコンポーネントの追加が主体。ほとんどの受け入れ基準はUIの特定状態を確認するEXAMPLEテストが適切。
ただし以下の3点はプロパティとして表現できる：

- **プロパティ1**（コピー可能な値の表示）：任意の文字列に対して普遍的に成立すべき性質
- **プロパティ2**（クリップボードへのコピー）：任意の非空文字列に対して成立すべき性質
- **プロパティ3**（外部リンクのセキュリティ属性）：全リンクに対して普遍的に成立すべきセキュリティ要件

### ユニットテスト（例示ベース）

`ViewingPreparationPopup` コンポーネントに対して以下を確認：

- ボタンクリック → ダイアログが開く
- 閉じるボタンクリック → `onClose` が呼ばれる
- `buyerNumber` あり → 値が表示される
- `buyerNumber` なし（null/undefined）→ 「（未設定）」が表示される
- `propertyNumber` あり → 値が表示される
- `propertyNumber` なし（null/undefined）→ 「（未設定）」が表示される
- タイトルに「内覧準備資料」が表示される
- 注意書きが表示される
- スプシの資料リンクが表示される
- ATBBリンクが表示される
- コピー成功後にアイコンが変化する

### プロパティベーステスト

プロパティベーステストライブラリとして **fast-check**（TypeScript向け）を使用する。
各プロパティテストは最低100回のイテレーションで実行する。

#### プロパティ1のテスト実装方針

```typescript
// Feature: buyer-viewing-preparation-button, Property 1: コピー可能な値の表示
fc.assert(
  fc.property(
    fc.string({ minLength: 1 }),  // buyerNumber（非空文字）
    fc.string({ minLength: 1 }),  // propertyNumber（非空文字）
    (buyerNumber, propertyNumber) => {
      // ViewingPreparationPopupをレンダリング
      // 「買主番号」ラベルとbuyerNumberの値が表示されることを確認
      // 「物件番号」ラベルとpropertyNumberの値が表示されることを確認
    }
  ),
  { numRuns: 100 }
);
```

#### プロパティ2のテスト実装方針

```typescript
// Feature: buyer-viewing-preparation-button, Property 2: クリップボードへのコピー
fc.assert(
  fc.property(
    fc.string({ minLength: 1 }),  // buyerNumber（非空文字）
    fc.string({ minLength: 1 }),  // propertyNumber（非空文字）
    (buyerNumber, propertyNumber) => {
      // navigator.clipboard.writeText をモック
      // 買主番号エリアをクリック → writeTextがbuyerNumberで呼ばれることを確認
      // 物件番号エリアをクリック → writeTextがpropertyNumberで呼ばれることを確認
    }
  ),
  { numRuns: 100 }
);
```

#### プロパティ3のテスト実装方針

```typescript
// Feature: buyer-viewing-preparation-button, Property 3: 外部リンクのセキュリティ属性
fc.assert(
  fc.property(
    fc.option(fc.string({ minLength: 1 }), { nil: null }),  // buyerNumber
    fc.option(fc.string({ minLength: 1 }), { nil: null }),  // propertyNumber
    (buyerNumber, propertyNumber) => {
      // ViewingPreparationPopupをレンダリング
      // target="_blank"を持つ全アンカー要素を取得
      // 全てにrel="noopener noreferrer"が設定されていることを確認
    }
  ),
  { numRuns: 100 }
);
```

### インテグレーションテスト

- `BuyerDetailPage` に `ViewingPreparationButton` が正しく組み込まれていること
- `linkedProperties[0]?.property_number` が正しく `ViewingPreparationButton` に渡されること

# 設計書：訪問準備ボタン（seller-visit-preparation-button）

## 概要

通話モードページ（`/sellers/:id/call`）のヘッダーに「訪問準備」ボタンを追加する。
ボタンクリック時にMUI `Dialog` を使ったポップアップが開き、訪問前に必要な6種類のリソースへのリンクを一覧表示する。
固定URLが4件、売主ごとの動的URL（`inquiryUrl`）が1件、売主IDに基づく内部リンクが1件。

## アーキテクチャ

本機能はフロントエンドのみの変更で完結する。バックエンドへの変更は不要。

```
CallModePage.tsx
  └── VisitPreparationButton（新規コンポーネント）
        └── VisitPreparationPopup（新規コンポーネント）
              ├── 固定リンク × 4（添付資料・ぜんりん・謄本・成約事例）
              ├── 動的リンク × 1（査定書：inquiryUrl）
              └── 動的リンク × 1（近隣買主：/sellers/:id/nearby-buyers）
```

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/frontend/src/pages/CallModePage.tsx` | ヘッダーに `VisitPreparationButton` を追加 |
| `frontend/frontend/src/components/VisitPreparationButton.tsx` | 新規作成（ボタン本体） |
| `frontend/frontend/src/components/VisitPreparationPopup.tsx` | 新規作成（ポップアップ） |

## コンポーネントとインターフェース

### VisitPreparationButton

ボタン本体のコンポーネント。クリック時にポップアップの開閉状態を管理する。

```typescript
interface VisitPreparationButtonProps {
  sellerId: string | undefined;
  inquiryUrl: string | null | undefined;
}
```

- MUI `Button` を使用、`variant="outlined"`、`size="small"`
- 内部で `open` 状態を管理し、`VisitPreparationPopup` に渡す

### VisitPreparationPopup

ポップアップダイアログのコンポーネント。

```typescript
interface VisitPreparationPopupProps {
  open: boolean;
  onClose: () => void;
  sellerId: string | undefined;
  inquiryUrl: string | null | undefined;
}
```

- MUI `Dialog` を使用
- `onClose` は閉じるボタンクリック時・ダイアログ外クリック時に呼ばれる

### CallModePage への組み込み

`seller?.phoneNumber` が存在する条件ブロック内、「画像」ボタンの左側に配置する。

```tsx
{seller?.phoneNumber && (
  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
    {/* 訪問準備ボタン（新規追加） */}
    <VisitPreparationButton
      sellerId={seller?.id}
      inquiryUrl={inquiryUrl}
    />
    {/* 画像ボタン（既存） */}
    <Button variant="outlined" ...>画像</Button>
    ...
  </Box>
)}
```

## データモデル

### リンク定義

ポップアップに表示する6項目のリンク定義。

```typescript
// 固定リンク（コンポーネント内定数として定義）
const FIXED_LINKS = [
  {
    label: '添付資料',
    url: 'https://docs.google.com/spreadsheets/d/1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I/edit?gid=422937915#gid=422937915',
  },
  {
    label: 'ぜんりん',
    url: 'https://app.zip-site.com/reos/app/index.htm',
  },
  {
    label: '謄本',
    url: 'https://www.jtn-map.com/member/kiyaku.asp',
  },
  {
    label: '成約事例',
    url: 'https://atbb.athome.jp/',
  },
] as const;

// 動的リンク（propsから生成）
// 査定書: inquiryUrl（存在しない場合は「（リンクなし）」）
// 近隣買主: `/sellers/${sellerId}/nearby-buyers`（sellerId未定義の場合は「（リンクなし）」）
```

### 表示順序

1. 添付資料（固定）
2. ぜんりん（固定）
3. 謄本（固定）
4. 査定書（動的：inquiryUrl）
5. 成約事例（固定）
6. 近隣買主（動的：/sellers/:id/nearby-buyers）

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ1：外部リンクのセキュリティ属性

*全ての* 外部リンク（`target="_blank"` を持つアンカー要素）に対して、`rel="noopener noreferrer"` 属性が設定されていること。

**Validates: Requirements 3.5, 4.3**

### プロパティ2：近隣買主URLの動的生成

*任意の* seller.id に対して、近隣買主リンクのURLが `/sellers/${sellerId}/nearby-buyers` の形式で正しく生成されること。

**Validates: Requirements 5.1**

## エラーハンドリング

| 状況 | 対応 |
|------|------|
| `inquiryUrl` が `null` または空文字 | 「査定書」項目に「（リンクなし）」テキストを表示（リンクなし） |
| `seller?.id` が `undefined` | 「近隣買主」項目に「（リンクなし）」テキストを表示（リンクなし） |
| ポップアップ外クリック | `onClose` を呼び出してダイアログを閉じる |

## テスト戦略

### PBT適用性の評価

本機能はUIコンポーネントの追加が主体であり、純粋関数やデータ変換ロジックは最小限。
ほとんどの受け入れ基準はUIの特定状態を確認するEXAMPLEテストが適切。
ただし以下の2点はプロパティとして表現できる：

- **プロパティ1**（外部リンクのセキュリティ属性）：全リンクに対して普遍的に成立すべき性質
- **プロパティ2**（近隣買主URLの動的生成）：任意のseller.idに対して成立すべき性質

### ユニットテスト（例示ベース）

`VisitPreparationPopup` コンポーネントに対して以下を確認：

- `inquiryUrl` あり → 「査定書」リンクが表示される
- `inquiryUrl` なし（null/空文字）→ 「（リンクなし）」が表示される
- `sellerId` あり → 「近隣買主」リンクが表示される
- `sellerId` なし → 「（リンクなし）」が表示される
- ボタンクリック → ダイアログが開く
- 閉じるボタンクリック → ダイアログが閉じる
- 6項目全てが表示される
- 注意メッセージが表示される

### プロパティベーステスト

プロパティベーステストライブラリとして **fast-check**（TypeScript向け）を使用する。
各プロパティテストは最低100回のイテレーションで実行する。

#### プロパティ1のテスト実装方針

```typescript
// Feature: seller-visit-preparation-button, Property 1: 外部リンクのセキュリティ属性
// fast-checkで任意のsellerId/inquiryUrlを生成し、
// レンダリングされた全アンカー要素のrel属性を検証する
fc.assert(
  fc.property(
    fc.option(fc.string(), { nil: null }),  // inquiryUrl
    fc.option(fc.string(), { nil: undefined }),  // sellerId
    (inquiryUrl, sellerId) => {
      // VisitPreparationPopupをレンダリング
      // target="_blank"を持つ全アンカーにrel="noopener noreferrer"が設定されていることを確認
    }
  ),
  { numRuns: 100 }
);
```

#### プロパティ2のテスト実装方針

```typescript
// Feature: seller-visit-preparation-button, Property 2: 近隣買主URLの動的生成
// fast-checkで任意のsellerIdを生成し、URLが正しい形式であることを検証する
fc.assert(
  fc.property(
    fc.string({ minLength: 1 }),  // sellerId（非空文字）
    (sellerId) => {
      // VisitPreparationPopupをレンダリング
      // 近隣買主リンクのhrefが `/sellers/${sellerId}/nearby-buyers` であることを確認
    }
  ),
  { numRuns: 100 }
);
```

### インテグレーションテスト

- `CallModePage` に `VisitPreparationButton` が正しく組み込まれていること
- `seller?.phoneNumber` がない場合にボタンが表示されないこと

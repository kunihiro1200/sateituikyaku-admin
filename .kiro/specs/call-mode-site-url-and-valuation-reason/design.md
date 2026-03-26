# 設計ドキュメント：通話モードページへのサイトURL表示・査定理由フィールド追加

## 概要

通話モードページ（`CallModePage.tsx`）に2つの機能を追加する。

1. **サイトURLリンク表示**：`inquiry_site` が「ウ」（イエウール）の場合のみ、コメントフィールドの右側にサイトURLをリンク付きで表示する。
2. **査定理由フィールドの常時表示**：コメントフィールドと保存ボタンの間に「査定理由（査定サイトから転記）」フィールドを読み取り専用で常時表示する。

### 調査結果サマリー

調査の結果、以下が確認された：

- `Seller` 型（`frontend/frontend/src/types/index.ts`）に `siteUrl` と `valuationReason` フィールドは**既に定義済み**
- `SellerService.supabase.ts` の `decryptSeller` メソッドに `siteUrl: seller.site_url` と `valuationReason: seller.valuation_reason` は**既に含まれている**
- `column-mapping.json` に `サイトURL → site_url` と `査定理由 → valuation_reason` のマッピングは**既に定義済み**
- `EnhancedAutoSyncService.ts` で `site_url` と `valuation_reason` は**既に同期処理済み**

つまり、バックエンド・型定義・同期処理は全て既存実装で対応済みであり、**フロントエンドの表示ロジックのみ追加**すればよい。

---

## アーキテクチャ

```
スプレッドシート（AO列: 査定理由、AP列: サイトURL）
    ↓ GAS syncSellerList（10分ごと、スプレッドシート→DB片方向）
Supabase DB（sellers.valuation_reason, sellers.site_url）
    ↓ GET /api/sellers/:id
SellerService.decryptSeller()
    ↓ APIレスポンス（valuationReason, siteUrl）
CallModePage.tsx
    ├── コメントフィールド右側: サイトURLリンク（inquiry_site === 'ウ' かつ siteUrl が存在する場合のみ）
    └── コメントと保存ボタンの間: 査定理由フィールド（読み取り専用、常時表示）
```

### 同期方向の制約

`valuation_reason` はスプレッドシート→DB方向のみ同期する（GASの `syncSellerList` による定期同期）。DBからスプレッドシートへの逆方向同期は行わない。フロントエンドからの編集UIは提供しない。

---

## コンポーネントとインターフェース

### 変更対象ファイル

**`frontend/frontend/src/pages/CallModePage.tsx`** のみ変更する。

バックエンド・型定義・同期サービスは変更不要。

### 変更箇所

#### 1. コメントフィールドのレイアウト変更（サイトURLリンク追加）

現在のコメントフィールドのコンテナ（`<Box sx={{ mb: 2 }}>`）を横並びレイアウトに変更し、右側にサイトURLリンクを条件付きで表示する。

**表示条件**：
- `seller.inquirySite === 'ウ'`（または `seller.site === 'ウ'`）
- かつ `seller.siteUrl` が空でない

**リンク仕様**：
- `target="_blank" rel="noopener noreferrer"` で新しいタブで開く
- MUI の `Link` コンポーネントまたは `<a>` タグを使用
- ラベル：「サイトURL」またはURLそのもの（短縮表示）

#### 2. 査定理由フィールドの追加（コメントと保存ボタンの間）

コメントフィールドの `</Box>` と保存ボタンの `{(() => { ... })()}` の間に、査定理由フィールドを挿入する。

**表示仕様**：
- ラベル：「査定理由（査定サイトから転記）」
- 値：`seller.valuationReason`
- 空の場合：「未入力」と表示
- 読み取り専用（編集不可）
- MUI の `TextField` に `disabled` または `InputProps={{ readOnly: true }}` を使用

---

## データモデル

既存の `Seller` 型を使用する。追加・変更なし。

```typescript
// frontend/frontend/src/types/index.ts（既存・変更なし）
export interface Seller {
  // ...
  inquirySite?: string;   // サイト（ウ、L等）
  siteUrl?: string;       // サイトURL（AP列）
  valuationReason?: string; // 査定理由（AO列）
  // ...
}
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことであり、人間が読める仕様と機械で検証可能な正確性保証の橋渡しをする正式な記述である。*

### Property 1: サイトURLリンクの条件付き表示

*For any* 売主データにおいて、`inquiry_site` が「ウ」かつ `site_url` が空でない場合、CallModePageはサイトURLリンクを表示し、それ以外の場合は表示しない。

**Validates: Requirements 1.1, 1.2, 1.4**

### Property 2: サイトURLリンクの新規タブ開放

*For any* 表示されているサイトURLリンクに対して、クリック時に `target="_blank"` 属性が設定されており、新しいタブでURLが開かれる。

**Validates: Requirements 1.3**

### Property 3: 査定理由フィールドの常時表示

*For any* 売主データにおいて、`inquiry_site` の値に関わらず、CallModePageはコメントフィールドと保存ボタンの間に査定理由フィールドを表示する。

**Validates: Requirements 2.1, 2.4**

### Property 4: 査定理由フィールドの読み取り専用

*For any* 査定理由フィールドに対して、ユーザーが編集操作を行っても値が変更されない（`readOnly` または `disabled` 属性が設定されている）。

**Validates: Requirements 2.3, 3.2, 3.3**

---

## エラーハンドリング

### siteUrl が null/undefined の場合

- `seller.siteUrl` が `null`、`undefined`、または空文字列の場合、`inquiry_site` が「ウ」であってもリンクを表示しない（要件 1.4）。
- 条件式：`seller.inquirySite === 'ウ' && seller.siteUrl && seller.siteUrl.trim() !== ''`

### valuationReason が null/undefined の場合

- `seller.valuationReason` が `null`、`undefined`、または空文字列の場合、「未入力」と表示する（要件 2.2）。
- 条件式：`seller.valuationReason || '未入力'`

### seller データがロード中の場合

- `seller` が `null` の場合（ローディング中）、両フィールドとも表示しない。既存の `loading` 状態で制御されているため、追加処理不要。

---

## テスト戦略

### ユニットテスト（具体例・エッジケース）

以下の具体例をユニットテストで検証する：

- `inquiry_site === 'ウ'` かつ `siteUrl` が有効なURLの場合 → リンクが表示される
- `inquiry_site === 'ウ'` かつ `siteUrl` が空文字列の場合 → リンクが表示されない
- `inquiry_site === 'L'` かつ `siteUrl` が有効なURLの場合 → リンクが表示されない
- `inquiry_site` が `undefined` の場合 → リンクが表示されない
- `valuationReason` が有効な文字列の場合 → その値が表示される
- `valuationReason` が `null` の場合 → 「未入力」が表示される
- 査定理由フィールドが `readOnly` であることの確認

### プロパティベーステスト

プロパティベーステストには **fast-check**（TypeScript/JavaScript向け）を使用する。各テストは最低100回のイテレーションで実行する。

#### Property 1 のテスト実装方針

```typescript
// Feature: call-mode-site-url-and-valuation-reason, Property 1: サイトURLリンクの条件付き表示
fc.assert(
  fc.property(
    fc.record({
      inquirySite: fc.string(),
      siteUrl: fc.option(fc.webUrl(), { nil: undefined }),
    }),
    ({ inquirySite, siteUrl }) => {
      const shouldShow = inquirySite === 'ウ' && !!siteUrl && siteUrl.trim() !== '';
      // レンダリング結果でリンクの有無を確認
    }
  ),
  { numRuns: 100 }
);
```

#### Property 3 のテスト実装方針

```typescript
// Feature: call-mode-site-url-and-valuation-reason, Property 3: 査定理由フィールドの常時表示
fc.assert(
  fc.property(
    fc.record({
      inquirySite: fc.option(fc.string(), { nil: undefined }),
      valuationReason: fc.option(fc.string(), { nil: undefined }),
    }),
    ({ inquirySite, valuationReason }) => {
      // inquiry_site の値に関わらず、査定理由フィールドが常に存在することを確認
    }
  ),
  { numRuns: 100 }
);
```

#### Property 4 のテスト実装方針

```typescript
// Feature: call-mode-site-url-and-valuation-reason, Property 4: 査定理由フィールドの読み取り専用
fc.assert(
  fc.property(
    fc.string(),
    (valuationReason) => {
      // 査定理由フィールドに readOnly または disabled 属性が設定されていることを確認
    }
  ),
  { numRuns: 100 }
);
```

### テストの補足

- ユニットテストは具体例・エッジケース・エラー条件に集中する
- プロパティテストは全入力に対して成立すべき普遍的な性質を検証する
- 両者は補完的であり、どちらも必要

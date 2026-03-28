# 設計書：管理画面モバイルレスポンシブ対応

## 概要

不動産売主管理システムの管理画面（React + TypeScript + Material UI）をスマートフォン（幅600px未満）でも快適に操作できるよう、レスポンシブデザインを実装する。

MUIのブレークポイントシステム（`useMediaQuery`、`theme.breakpoints`）を活用し、既存のデスクトップレイアウトを維持しながらモバイル向けレイアウトを追加する。バックエンドへの変更は不要で、フロントエンドのみの変更となる。

---

## アーキテクチャ

### 変更対象ファイル

```
frontend/frontend/src/
├── pages/
│   ├── SellersPage.tsx          # 売主リスト（テーブル→カード、サイドバー→アコーディオン）
│   ├── SellerDetailPage.tsx     # 売主詳細（1カラム、固定フッター）
│   ├── CallModePage.tsx         # 通話モード（固定ヘッダー・フッター）
│   ├── BuyersPage.tsx           # 買主リスト（テーブル→カード、サイドバー→アコーディオン）
│   ├── BuyerDetailPage.tsx      # 買主詳細（1カラム）
│   └── PropertyListingsPage.tsx # 物件リスト（テーブル→カード）
└── components/
    └── PageNavigation.tsx       # ナビゲーション（ハンバーガーメニュー）
```

### 設計方針

- **既存コードへの影響を最小化**: `useMediaQuery(theme.breakpoints.down('sm'))` で分岐し、デスクトップ表示は一切変更しない
- **新規コンポーネントは最小限**: 各ページ内にモバイル用JSXを条件分岐で追加する
- **MUI標準コンポーネントを活用**: `Accordion`、`Drawer`、`Card` など既存のMUIコンポーネントを使用

### ブレークポイント定義

| 名称 | 幅 | 対象 |
|------|-----|------|
| MobileBreakpoint | < 600px（`xs`〜`sm`未満） | スマートフォン |
| DesktopBreakpoint | ≥ 600px（`sm`以上） | タブレット・PC |

```typescript
// 各ページで使用するパターン
const theme = useTheme();
const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
```

---

## コンポーネントとインターフェース

### PageNavigation（モバイル対応）

**現状**: 横並びボタン群（`minWidth: 130px`）

**モバイル対応**: ハンバーガーメニュー（`IconButton` + `Drawer`）

```
[デスクトップ]
[売主リスト] [買主リスト] [物件リスト] [業務依頼] [共有] [公開物件サイト]

[モバイル]
[≡ メニュー]  ← タップでDrawerが開く
```

**変更内容**:
- `isMobile` が `true` の場合、ハンバーガーアイコン + `Drawer` を表示
- `Drawer` 内のナビゲーション項目は縦並び、各項目の高さ ≥ 44px

### SellerStatusSidebar / BuyerStatusSidebar（モバイル対応）

**現状**: 固定幅サイドバー（デスクトップ左側）

**モバイル対応**: `Accordion` コンポーネントでページ上部に折りたたみ表示

```
[モバイル]
▼ ステータスフィルター（タップで展開）
  ③当日TEL分 (12)
  ④当日TEL（内容）(3)
  ...
```

**変更内容**: 各リストページで `isMobile` 判定し、サイドバーを `Accordion` でラップ

### 売主・買主・物件リスト（モバイル対応）

**現状**: `TableContainer` + `Table` コンポーネント

**モバイル対応**: `Card` コンポーネントのリスト

```
[モバイル - 売主カード]
┌─────────────────────────────┐
│ AA13501  田中 太郎           │
│ 大分市中央町1-1-1            │
│ [追客中]  次電: 2026/04/01   │
└─────────────────────────────┘
```

**売主カード表示項目**: 売主番号・名前・物件住所・ステータス・次電日
**買主カード表示項目**: 買主番号・名前・希望エリア・ステータス・次電日
**物件カード表示項目**: 物件番号・物件住所・種別・価格・ステータス

### SellerDetailPage / BuyerDetailPage（モバイル対応）

**現状**: 2カラムGrid レイアウト

**モバイル対応**:
- 全セクションを `xs={12}` の1カラムに変更
- 各セクションを `Accordion` で折りたたみ可能に
- 「戻る」「保存」ボタンを画面下部の固定フッターに移動（SellerDetailPage）
- 入力フィールドの `minHeight: 44px`

```
[モバイル - 売主詳細]
┌─────────────────────────────┐  ← 固定ヘッダー（ページタイトル）
│ ▼ 基本情報                  │
│   名前: 田中 太郎            │
│   電話: 090-xxxx-xxxx       │
├─────────────────────────────┤
│ ▶ 物件情報                  │  ← 折りたたみ
├─────────────────────────────┤
│ ▶ 追客情報                  │  ← 折りたたみ
└─────────────────────────────┘
┌─────────────────────────────┐  ← 固定フッター
│ [← 戻る]        [💾 保存]   │
└─────────────────────────────┘
```

### CallModePage（モバイル対応）

**現状**: サイドバー付きレイアウト

**モバイル対応**:
- 売主基本情報（名前・電話番号・物件住所）を固定ヘッダーに表示
- 電話・SMSボタンを固定フッターに配置（`minHeight: 56px`）
- サイドバーを非表示
- 各情報セクションを `Accordion` で折りたたみ可能に

```
[モバイル - 通話モード]
┌─────────────────────────────┐  ← 固定ヘッダー
│ 田中 太郎  090-xxxx-xxxx    │
│ 大分市中央町1-1-1            │
└─────────────────────────────┘
│ ▼ コメント入力               │
│ [テキストエリア 幅100%]      │
│ ▶ 追客情報                  │
│ ▶ 査定情報                  │
┌─────────────────────────────┐  ← 固定フッター
│ [📞 電話]    [💬 SMS]       │
└─────────────────────────────┘
```

---

## データモデル

本機能はフロントエンドのレイアウト変更のみであり、データモデルの変更はない。

既存のAPIレスポンス・データ型（`Seller`、`Buyer`、`PropertyListing`）をそのまま使用する。

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property 1: リストページのテーブル/カード表示切り替え

*任意の* データリスト（売主・買主・物件）に対して、`isMobile=true` の場合はテーブルが非表示でカードリストが表示され、`isMobile=false` の場合はカードリストが非表示でテーブルが表示される

**Validates: Requirements 1.2, 1.5, 4.2, 4.5, 6.1, 6.4**

### Property 2: 売主カードに必須項目が含まれる

*任意の* 売主データに対して、モバイルカードのレンダリング結果には売主番号・名前・物件住所・ステータス・次電日が全て含まれる

**Validates: Requirements 1.3**

### Property 3: 買主カードに必須項目が含まれる

*任意の* 買主データに対して、モバイルカードのレンダリング結果には買主番号・名前・希望エリア・ステータス・次電日が全て含まれる

**Validates: Requirements 4.3**

### Property 4: タップターゲットサイズの保証

*任意の* モバイル表示において、全てのインタラクティブ要素（ボタン・リンク・入力フィールド）の `minHeight` は44px以上である

**Validates: Requirements 2.2, 5.2, 7.2, 8.1**

### Property 5: 通話モードのサイドバー非表示

*任意の* `isMobile=true` の通話モードページにおいて、サイドバーコンポーネントは DOM に存在しない（または `display: none`）

**Validates: Requirements 3.4**

### Property 6: テキスト最小フォントサイズ

*任意の* モバイル表示において、全てのテキスト要素のフォントサイズは14px以上である

**Validates: Requirements 8.3**

### Property 7: 横スクロールが発生しない

*任意の* データリストをモバイルレイアウトでレンダリングした場合、ルートコンテナの `overflow-x` は `scroll` または `auto` にならない

**Validates: Requirements 8.4**

---

## エラーハンドリング

### レイアウト崩れの防止

- `overflow-x: hidden` をモバイルレイアウトのルートコンテナに適用
- テキストの最小フォントサイズを `14px` に設定（ブラウザの自動ズーム防止）
- 長いテキスト（住所・名前）は `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` で省略

### ソフトウェアキーボード対応

- フォームフィールドにフォーカスが当たった際、`scrollIntoView({ behavior: 'smooth', block: 'center' })` でスクロール調整
- 固定フッターがキーボードに隠れないよう、`position: fixed; bottom: 0` + `paddingBottom` でコンテンツエリアに余白を追加

### 既存機能への影響防止

- `isMobile` フラグによる条件分岐で、デスクトップ表示は完全に既存コードを維持
- モバイル用コードは既存のイベントハンドラ・状態管理を共有（重複実装なし）

---

## テスト戦略

### デュアルテストアプローチ

- **ユニットテスト**: 特定の例・エッジケース・エラー条件を検証
- **プロパティベーステスト**: 全入力に対して普遍的なプロパティを検証

両者は補完的であり、どちらも必要。ユニットテストは具体的なバグを捕捉し、プロパティテストは一般的な正確性を検証する。

### ユニットテスト

- `isMobile=true` / `false` の切り替えで正しいコンポーネントが表示されることを確認
- 固定フッター・固定ヘッダーの存在確認（SellerDetailPage、CallModePage）
- ハンバーガーメニューのDrawer開閉動作確認
- カードタップ時のナビゲーション確認

### プロパティベーステスト

**使用ライブラリ**: `fast-check`（TypeScript向けプロパティベーステストライブラリ）

**設定**: 各プロパティテストは最低100回のイテレーションを実行

**タグ形式**: `// Feature: mobile-responsive-admin, Property {N}: {property_text}`

各正確性プロパティは1つのプロパティベーステストで実装する。

#### Property 1: リストページのテーブル/カード表示切り替え

```typescript
// Feature: mobile-responsive-admin, Property 1: リストページのテーブル/カード表示切り替え
fc.assert(fc.property(
  fc.array(fc.record({ sellerNumber: fc.string(), name: fc.string() })),
  (sellers) => {
    const { queryByRole: mobileQuery } = renderWithMobile(<SellerList sellers={sellers} isMobile={true} />);
    expect(mobileQuery('table')).toBeNull();
    const { queryByRole: desktopQuery } = renderWithDesktop(<SellerList sellers={sellers} isMobile={false} />);
    expect(desktopQuery('table')).not.toBeNull();
  }
), { numRuns: 100 });
```

#### Property 2 & 3: カード必須項目

```typescript
// Feature: mobile-responsive-admin, Property 2: 売主カード必須項目
fc.assert(fc.property(
  fc.record({
    sellerNumber: fc.string({ minLength: 1 }),
    name: fc.string({ minLength: 1 }),
    propertyAddress: fc.string(),
    status: fc.string(),
    nextCallDate: fc.option(fc.string()),
  }),
  (seller) => {
    const { getByText } = render(<SellerMobileCard seller={seller} />);
    expect(getByText(seller.sellerNumber)).toBeInTheDocument();
    expect(getByText(seller.name)).toBeInTheDocument();
  }
), { numRuns: 100 });
```

#### Property 4: タップターゲットサイズ

```typescript
// Feature: mobile-responsive-admin, Property 4: タップターゲットサイズ
fc.assert(fc.property(
  fc.array(fc.record({ sellerNumber: fc.string(), name: fc.string() })),
  (sellers) => {
    const { getAllByRole } = render(<MobileSellerList sellers={sellers} />);
    getAllByRole('button').forEach(btn => {
      const style = window.getComputedStyle(btn);
      const minHeight = parseInt(style.minHeight || style.height || '0');
      expect(minHeight).toBeGreaterThanOrEqual(44);
    });
  }
), { numRuns: 100 });
```

#### Property 5: 通話モードのサイドバー非表示

```typescript
// Feature: mobile-responsive-admin, Property 5: 通話モードのサイドバー非表示
fc.assert(fc.property(
  fc.record({ sellerNumber: fc.string(), name: fc.string() }),
  (seller) => {
    const { queryByTestId } = render(<CallModePageMobile seller={seller} />);
    expect(queryByTestId('seller-status-sidebar')).toBeNull();
  }
), { numRuns: 100 });
```

#### Property 6 & 7: フォントサイズ・横スクロール

```typescript
// Feature: mobile-responsive-admin, Property 6 & 7: フォントサイズ・横スクロール
fc.assert(fc.property(
  fc.array(fc.record({ sellerNumber: fc.string(), name: fc.string() }), { maxLength: 50 }),
  (sellers) => {
    const { container } = render(<MobileSellerList sellers={sellers} />);
    const root = container.firstChild as Element;
    const style = window.getComputedStyle(root);
    expect(style.overflowX).not.toBe('scroll');
    expect(style.overflowX).not.toBe('auto');
  }
), { numRuns: 100 });
```

### 手動テスト

- Chrome DevToolsのデバイスエミュレーター（iPhone SE: 375px、iPhone 14: 390px）で各ページを確認
- 実機（iOS Safari、Android Chrome）でのタッチ操作確認
- ソフトウェアキーボード表示時のレイアウト確認

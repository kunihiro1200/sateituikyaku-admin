# 設計ドキュメント

## 概要

買主リストの新規登録画面（NewBuyerPage）において、Pinrichドロップダウンフィールドの隣にPinrichサービスへの外部リンクを追加する。

詳細画面（BuyerDetailPage）では既に `pinrich_link` フィールドとして同リンクが実装されており、同一のUI実装パターンを新規登録画面に適用する。変更範囲はフロントエンドのみで、バックエンドへの変更は不要。

## アーキテクチャ

### 変更対象

- **ファイル**: `frontend/frontend/src/pages/NewBuyerPage.tsx`
- **変更種別**: UIコンポーネントの追加（既存フィールドの隣にリンクを配置）
- **バックエンド変更**: なし

### 参照実装

BuyerDetailPage（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）の `pinrich_link` フィールド処理が参照実装となる。

```tsx
// BuyerDetailPage の既存実装（参照）
if (field.key === 'pinrich_link') {
  return (
    <Grid item xs={12} key={`${section.title}-${field.key}`}>
      <Link
        href="https://pinrich.com/management/hankyo"
        target="_blank"
        rel="noopener noreferrer"
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.875rem' }}
      >
        Pinrichリンク
        <LaunchIcon fontSize="small" />
      </Link>
    </Grid>
  );
}
```

## コンポーネントとインターフェース

### 変更箇所: NewBuyerPage の Pinrich セクション

現在の実装では、Pinrichドロップダウンが `xs={12} sm={6}` の Grid アイテムとして単独で配置されている。

```tsx
{/* 現在の実装 */}
<Grid item xs={12} sm={6}>
  <FormControl fullWidth size="small">
    <InputLabel>Pinrich</InputLabel>
    <Select value={pinrich} label="Pinrich" onChange={(e) => setPinrich(e.target.value)}>
      ...
    </Select>
  </FormControl>
</Grid>
```

変更後は、同じ Grid アイテム内にリンクを追加する。ドロップダウンとリンクを縦に並べる形で配置し、既存のレイアウトを崩さない。

```tsx
{/* 変更後の実装 */}
<Grid item xs={12} sm={6}>
  <FormControl fullWidth size="small">
    <InputLabel>Pinrich</InputLabel>
    <Select value={pinrich} label="Pinrich" onChange={(e) => setPinrich(e.target.value)}>
      ...
    </Select>
  </FormControl>
  <Link
    href="https://pinrich.com/management/hankyo"
    target="_blank"
    rel="noopener noreferrer"
    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.875rem', mt: 0.5 }}
  >
    Pinrichリンク
    <LaunchIcon fontSize="small" />
  </Link>
</Grid>
```

### 使用するMUIコンポーネント

| コンポーネント | インポート元 | 用途 |
|---|---|---|
| `Link` | `@mui/material` | リンク表示 |
| `LaunchIcon` | `@mui/icons-material` | 外部リンクアイコン |

`Link` と `LaunchIcon` は既に NewBuyerPage にインポートされているか確認が必要。BuyerDetailPage では両方インポート済みであることを確認済み。

## データモデル

このフィーチャーはUIの表示のみの変更であり、データモデルへの変更はない。

- `pinrich` フィールドの state 管理は既存のまま変更なし
- バックエンドAPIへの変更なし
- データベーススキーマへの変更なし

## 正確性プロパティ

このフィーチャーはUIコンポーネントの追加（静的な外部リンクの表示）であり、純粋関数やデータ変換ロジックを含まない。全ての受け入れ基準が静的なUI属性の確認であり、入力値によって動作が変わるユニバーサルプロパティが存在しないため、プロパティベーステストは適用しない。

代わりに例ベーステストとスナップショットテストを使用する（テスト戦略セクション参照）。

## エラーハンドリング

このフィーチャーはリンクの表示のみであり、エラーハンドリングは不要。

- リンクのクリックはブラウザのネイティブ動作（新しいタブで開く）に委ねる
- ネットワークエラーや外部サービスの障害はブラウザが処理する

## テスト戦略

### PBT非適用の理由

全ての受け入れ基準がUIの静的属性確認（href、target、rel、アイコンの存在）であり、入力値によって動作が変わるユニバーサルプロパティが存在しない。IaC・UIレンダリング・静的設定に該当するため、PBTは適用しない。

### 例ベーステスト

以下の確認を例ベーステストで実施する：

1. **リンクの存在確認**: NewBuyerPageをレンダリングしたとき、「Pinrichリンク」テキストを持つリンク要素が存在すること
2. **URL確認**: リンクの `href` 属性が `https://pinrich.com/management/hankyo` であること
3. **新しいタブで開く確認**: リンクの `target` 属性が `_blank` であること
4. **セキュリティ属性確認**: リンクの `rel` 属性が `noopener noreferrer` を含むこと
5. **アイコン確認**: LaunchIcon が表示されること

### 手動確認

- Pinrichドロップダウンの隣（同一Grid行内）にリンクが表示されること
- リンクをクリックすると新しいタブで `https://pinrich.com/management/hankyo` が開くこと
- 既存のフォームレイアウトが崩れていないこと

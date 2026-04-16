# 要件ドキュメント

## はじめに

買主リストの新規登録画面（NewBuyerPage）において、Pinrichフィールドの近くにPinrichサービスへの外部リンクを追加する機能。

詳細画面（BuyerDetailPage）では既に `pinrich_link` フィールドとして `https://pinrich.com/management/hankyo` へのリンクが実装されており、同じリンクを新規登録画面のPinrichドロップダウンフィールドの隣にも表示する。

## 用語集

- **NewBuyerPage**: 買主リストの新規登録画面（`frontend/frontend/src/pages/NewBuyerPage.tsx`）
- **BuyerDetailPage**: 買主詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **Pinrichフィールド**: 買主の配信設定を管理するドロップダウンフィールド（`pinrich`カラム）
- **Pinrichリンク**: `https://pinrich.com/management/hankyo` への外部リンク
- **LaunchIcon**: 外部リンクを示すアイコン（MUI `@mui/icons-material`）
- **Link**: MUIのリンクコンポーネント（`@mui/material`）

## 要件

### 要件1: 新規登録画面へのPinrichリンク追加

**ユーザーストーリー:** 担当者として、買主新規登録画面でPinrichの管理画面に素早くアクセスしたい。そうすることで、登録作業中にPinrichの設定を確認・操作できる。

#### 受け入れ基準

1. THE NewBuyerPage SHALL Pinrichドロップダウンフィールドの隣（同一Grid行内）にPinrichリンクを表示する
2. WHEN ユーザーがPinrichリンクをクリックしたとき、THE NewBuyerPage SHALL `https://pinrich.com/management/hankyo` を新しいタブで開く
3. THE NewBuyerPage SHALL Pinrichリンクに外部リンクを示すアイコン（LaunchIcon）を表示する
4. THE NewBuyerPage SHALL BuyerDetailPageのpinrich_linkフィールドと同一のリンクURL（`https://pinrich.com/management/hankyo`）を使用する
5. THE NewBuyerPage SHALL Pinrichリンクを `rel="noopener noreferrer"` 属性付きで表示する（セキュリティ対策）

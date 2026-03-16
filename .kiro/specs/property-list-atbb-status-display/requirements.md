# 要件ドキュメント

## はじめに

物件リストページ（`PropertyListingsPage.tsx`）のテーブルにおいて、売主氏名列の右隣に `atbb_status` の表示列を追加する機能です。

現在 `atbb_status` は「バッジ」列（`StatusBadge` コンポーネント）と「ATBB状況」列（最終列）の2箇所で表示されていますが、ユーザーの視認性向上のため、売主氏名の直後にも `atbb_status` のテキスト表示を配置します。

## 用語集

- **PropertyListingsPage**: 社内管理システムの物件リストページ（`frontend/frontend/src/pages/PropertyListingsPage.tsx`）
- **atbb_status**: 物件データのATBB状況カラム（例: 「公開前情報」「非公開物件」「成約済み」）
- **getDisplayStatus**: `atbbStatusDisplayMapper.ts` に定義された、`atbb_status` の値を表示用テキストに変換する関数
- **売主列**: テーブル内の `seller_name` を表示する列

---

## 要件

### 要件1: 売主列の右隣にATBB状況列を追加

**ユーザーストーリー:** 担当者として、物件リストを見たとき、売主氏名の隣でATBB状況をすぐに確認したい。そうすることで、売主情報とATBB状況を一目で把握できる。

#### 受け入れ基準

1. THE PropertyListingsPage SHALL テーブルの「売主」列の右隣に「ATBB状況」列を表示する
2. WHEN `atbb_status` に値がある場合、THE PropertyListingsPage SHALL `getDisplayStatus()` で変換したテキストを表示する
3. WHEN `atbb_status` が空または null の場合、THE PropertyListingsPage SHALL 「-」を表示する
4. THE PropertyListingsPage SHALL テーブルヘッダーに「ATBB状況」というラベルを表示する
5. THE PropertyListingsPage SHALL 既存の最終列「ATBB状況」を削除し、売主列の右隣の列に統合する（重複排除）

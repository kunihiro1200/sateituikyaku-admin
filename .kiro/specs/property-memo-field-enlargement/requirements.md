# 要件定義書

## はじめに

物件リスト詳細画面（PropertyListingDetailPage）の「特記・備忘録」セクションにある「備忘録」テキストフィールドの表示サイズを拡大する機能です。

現在、備忘録フィールドは2行（`rows={2}`）で表示されており、長文の備忘録を入力・確認する際に視認性が低く、スクロールが必要になるという課題があります。フィールドを大きく表示することで、担当者が備忘録の内容を一覧しやすくなり、業務効率が向上します。

## 用語集

- **PropertyListingDetailPage**: 物件リスト詳細画面（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）
- **備忘録フィールド**: 「特記・備忘録」セクション内の `memo` フィールドに対応する `TextField` コンポーネント
- **特記フィールド**: 「特記・備忘録」セクション内の `special_notes` フィールドに対応する `TextField` コンポーネント
- **特記・備忘録セクション**: 物件詳細画面の「よく聞かれる項目 + 特記・備忘録」エリア内の右側パネル

## 要件

### 要件1: 備忘録フィールドの表示行数拡大

**ユーザーストーリー:** 担当者として、備忘録フィールドを大きく表示してほしい。そうすることで、長文の備忘録を入力・確認する際にスクロールせずに内容を把握できる。

#### 受け入れ基準

1. THE PropertyListingDetailPage SHALL 備忘録フィールドを最低6行（`rows={6}` 以上）で表示する
2. WHEN 備忘録フィールドが表示される時、THE PropertyListingDetailPage SHALL 特記フィールドよりも備忘録フィールドの行数を多く表示する
3. THE PropertyListingDetailPage SHALL 備忘録フィールドの既存の機能（入力・保存・プレースホルダー・フォントサイズ）を変更せずに維持する
4. THE PropertyListingDetailPage SHALL 備忘録フィールドの `fullWidth` および `multiline` 属性を維持する
5. WHEN 備忘録フィールドのサイズが変更された後も、THE PropertyListingDetailPage SHALL 「保存」ボタンの動作（変更検知・パルスアニメーション・API呼び出し）を正常に維持する

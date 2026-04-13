# 要件定義書

## はじめに

物件一覧ページ（PropertyListingsPage）の検索バーで住所検索を行う際、現在は「所在地」（`address`フィールド）のみが検索対象となっている。しかし、物件によっては「住居表示」（`display_address`フィールド）に実際の住所が格納されているケースがあり、住居表示で検索しても結果が表示されない問題がある。

本機能では、検索バーによる住所検索の対象に「住居表示」（`display_address`）フィールドを追加し、どちらのフィールドに住所が入力されていても検索できるようにする。

## 用語集

- **PropertyListingsPage**: 売主管理システムの物件一覧ページ（`frontend/frontend/src/pages/PropertyListingsPage.tsx`）
- **所在地（address）**: `property_listings`テーブルの`address`カラム。物件の所在地を格納するフィールド
- **住居表示（display_address）**: `property_listings`テーブルの`display_address`カラム。ATBB登録住所など、所在地とは別の住所表記を格納するフィールド
- **検索バー**: PropertyListingsPageの上部に配置されたテキスト入力フィールド。物件番号・住所・売主名などで絞り込みを行う
- **フロントエンド検索**: バックエンドAPIを呼び出さず、取得済みの全件データをフロントエンド側でフィルタリングする方式（現在の実装方式）
- **normalizeText**: 全角・半角の正規化（NFKC）と小文字化を行うユーティリティ関数

## 要件

### 要件1: 住居表示フィールドを検索対象に追加

**ユーザーストーリー:** 担当者として、物件一覧ページの検索バーで住居表示（display_address）を入力した場合でも物件を検索できるようにしたい。そうすることで、所在地と住居表示のどちらの住所表記で検索しても目的の物件を見つけられるようにしたい。

#### 受け入れ基準

1. WHEN 検索バーに文字列が入力された場合、THE PropertyListingsPage SHALL `display_address`フィールドも検索対象に含めてフィルタリングを行う
2. WHEN 検索バーに文字列が入力された場合、THE PropertyListingsPage SHALL `address`フィールドと`display_address`フィールドのいずれかに検索文字列が含まれる物件を検索結果に表示する
3. THE PropertyListingsPage SHALL 検索文字列の照合において、`display_address`フィールドに対しても`normalizeText`関数（全角・半角正規化 + 小文字化）を適用する
4. WHEN `display_address`フィールドがnullまたは未定義の場合、THE PropertyListingsPage SHALL エラーを発生させずに空文字として扱い、検索処理を継続する

### 要件2: バックエンドAPIの検索クエリへの住居表示追加

**ユーザーストーリー:** システムとして、バックエンドAPIの`search`パラメータを使用した検索においても、住居表示フィールドが検索対象に含まれるようにしたい。そうすることで、将来的にバックエンド検索に切り替えた場合でも一貫した検索結果が得られるようにしたい。

#### 受け入れ基準

1. WHEN `search`パラメータを指定してAPIが呼び出された場合、THE PropertyListingService SHALL `display_address`フィールドも検索対象に含めたORクエリを実行する
2. WHEN `search`パラメータを指定してAPIが呼び出された場合、THE PropertyListingService SHALL `property_number`、`address`、`display_address`、`seller_name`、`seller_email`のいずれかに検索文字列が部分一致する物件を返す
3. THE PropertyListingService SHALL `getAll()`メソッドのSELECT句に`display_address`カラムを追加し、レスポンスデータに含める

### 要件3: 検索結果の一貫性

**ユーザーストーリー:** 担当者として、フロントエンドの検索結果とバックエンドの検索結果が一致することを期待したい。そうすることで、どの検索方式でも同じ物件が見つかるようにしたい。

#### 受け入れ基準

1. THE PropertyListingsPage SHALL フロントエンド検索において、`address`と`display_address`の両フィールドを検索対象とする
2. THE PropertyListingService SHALL バックエンド検索において、`address`と`display_address`の両フィールドを検索対象とする
3. WHEN 同一の検索文字列でフロントエンド検索とバックエンド検索を実行した場合、THE システム SHALL 同じ物件セットが検索対象となる

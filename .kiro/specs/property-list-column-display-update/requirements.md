# 要件定義書

## はじめに

物件リストページ（PropertyListingsPage）の物件一覧テーブルにおいて、表示列の変更を行う。
具体的には、「公開URL」列と「格納先URL」列を削除し、「所在地」列の隣に「住居表示」列を新たに追加する。

現在のテーブル列構成（変更前）：
物件番号 / 担当 / 種別 / 所在地 / 売主 / ATBB状況 / 買主 / 契約日 / 決済日 / 売買価格 / **公開URL** / **格納先URL**

変更後のテーブル列構成：
物件番号 / 担当 / 種別 / 所在地 / **住居表示** / 売主 / ATBB状況 / 買主 / 契約日 / 決済日 / 売買価格

## 用語集

- **PropertyListingsPage**: 物件リストページ（`frontend/frontend/src/pages/PropertyListingsPage.tsx`）
- **物件一覧テーブル**: PropertyListingsPageのデスクトップ表示で使用されるMUI Tableコンポーネント
- **公開URL列**: `PublicUrlCell`コンポーネントを使用して公開URLを表示する列
- **格納先URL列**: `storage_location`フィールドを使用してGoogle DriveのURLを表示する列
- **所在地（address）**: `property_listings`テーブルの`address`カラム。物件の所在地を格納するフィールド
- **住居表示（display_address）**: `property_listings`テーブルの`display_address`カラム。ATBB登録住所など、所在地とは別の住所表記を格納するフィールド
- **colSpan**: テーブルのローディング・空データ表示時に使用する列数の合計値

## 要件

### 要件1: 「公開URL」列の削除

**ユーザーストーリー:** 担当者として、物件一覧テーブルから「公開URL」列を削除したい。そうすることで、テーブルをよりコンパクトに表示し、必要な情報に集中できるようにしたい。

#### 受け入れ基準

1. THE PropertyListingsPage SHALL 物件一覧テーブルのヘッダー行から「公開URL」列を削除する
2. THE PropertyListingsPage SHALL 物件一覧テーブルの各データ行から「公開URL」列のセル（`PublicUrlCell`コンポーネントを含む）を削除する
3. WHEN 「公開URL」列を削除した場合、THE PropertyListingsPage SHALL テーブルの`colSpan`値を削除後の列数に合わせて更新する

### 要件2: 「格納先URL」列の削除

**ユーザーストーリー:** 担当者として、物件一覧テーブルから「格納先URL」列を削除したい。そうすることで、テーブルをよりコンパクトに表示し、必要な情報に集中できるようにしたい。

#### 受け入れ基準

1. THE PropertyListingsPage SHALL 物件一覧テーブルのヘッダー行から「格納先URL」列を削除する
2. THE PropertyListingsPage SHALL 物件一覧テーブルの各データ行から「格納先URL」列のセル（`storage_location`フィールドを使用するLinkコンポーネントを含む）を削除する
3. WHEN 「格納先URL」列を削除した場合、THE PropertyListingsPage SHALL テーブルの`colSpan`値を削除後の列数に合わせて更新する

### 要件3: 「住居表示」列の追加

**ユーザーストーリー:** 担当者として、物件一覧テーブルの「所在地」列の隣に「住居表示」列を追加したい。そうすることで、所在地と住居表示の両方の住所情報を一覧で確認できるようにしたい。

#### 受け入れ基準

1. THE PropertyListingsPage SHALL 物件一覧テーブルのヘッダー行の「所在地」列の直後に「住居表示」列を追加する
2. THE PropertyListingsPage SHALL 物件一覧テーブルの各データ行の「所在地」セルの直後に、`display_address`フィールドの値を表示するセルを追加する
3. IF `display_address`フィールドがnull、undefined、または空文字の場合、THEN THE PropertyListingsPage SHALL 「住居表示」列のセルに「-」を表示する
4. THE PropertyListingsPage SHALL 「住居表示」列のセルに対して、「所在地」列と同様のスタイル（`maxWidth: 200`、`overflow: hidden`、`textOverflow: ellipsis`、`whiteSpace: nowrap`）を適用する

### 要件4: テーブル列数の整合性維持

**ユーザーストーリー:** システムとして、列の追加・削除後もテーブルの表示が正しく機能することを保証したい。そうすることで、ローディング中や空データ時の表示が崩れないようにしたい。

#### 受け入れ基準

1. WHEN 列の変更（2列削除・1列追加）を行った場合、THE PropertyListingsPage SHALL ローディング中の`TableCell colSpan`値を変更後の正しい列数（現在の12から11へ）に更新する
2. WHEN 列の変更（2列削除・1列追加）を行った場合、THE PropertyListingsPage SHALL 空データ表示時の`TableCell colSpan`値を変更後の正しい列数（現在の12から11へ）に更新する

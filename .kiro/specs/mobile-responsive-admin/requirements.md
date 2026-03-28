# 要件定義書

## はじめに

本機能は、不動産売主管理システムの管理画面（フロントエンド）をスマートフォンでも快適に操作できるよう、レスポンシブデザインに対応させるものです。

現在のシステムはデスクトップ向けのレイアウトのみ対応しており、スマートフォンからアクセスした場合に以下の問題が発生しています：
- テーブルが横にはみ出して操作しにくい
- サイドバーがコンテンツを圧迫する
- ボタンやフォームが小さすぎてタップしにくい
- 通話モードページが縦スクロールで使いにくい

Material UI（MUI）のブレークポイントシステム（`xs`, `sm`, `md`）を活用し、スマートフォン（幅600px未満）向けのレイアウトを追加します。

---

## 用語集

- **Admin_UI**: 不動産売主管理システムのフロントエンドアプリケーション（React + TypeScript + Material UI）
- **SellerListPage**: 売主リストページ（`SellersPage.tsx`）
- **SellerDetailPage**: 売主詳細ページ（`SellerDetailPage.tsx`）
- **CallModePage**: 通話モードページ（`CallModePage.tsx`）
- **BuyerListPage**: 買主リストページ（`BuyersPage.tsx`）
- **BuyerDetailPage**: 買主詳細ページ（`BuyerDetailPage.tsx`）
- **PropertyListPage**: 物件リストページ（`PropertyListingsPage.tsx`）
- **StatusSidebar**: ステータスカテゴリを表示するサイドバーコンポーネント（`SellerStatusSidebar.tsx`, `BuyerStatusSidebar.tsx`）
- **MobileBreakpoint**: スマートフォン向けレイアウトが適用される画面幅（600px未満、MUIの`xs`〜`sm`）
- **DesktopBreakpoint**: デスクトップ向けレイアウトが適用される画面幅（600px以上、MUIの`sm`以上）

---

## 要件

### 要件1：売主リストページのモバイル対応

**ユーザーストーリー：** 営業担当者として、スマートフォンから売主リストを確認したい。そうすることで、外出先でも売主情報にアクセスできる。

#### 受け入れ基準

1. WHEN MobileBreakpoint でページを表示する, THE SellerListPage SHALL StatusSidebar をページ上部に折りたたみ可能なドロワーまたはアコーディオンとして表示する
2. WHEN MobileBreakpoint でページを表示する, THE SellerListPage SHALL テーブルの代わりにカード形式のリストを表示する
3. WHEN MobileBreakpoint でページを表示する, THE SellerListPage SHALL 各カードに売主番号・名前・物件住所・ステータス・次電日を表示する
4. WHEN MobileBreakpoint でページを表示する, THE SellerListPage SHALL 検索バーを画面幅いっぱいに表示する
5. WHEN DesktopBreakpoint でページを表示する, THE SellerListPage SHALL 既存のテーブルレイアウトとサイドバーレイアウトを維持する
6. WHEN MobileBreakpoint でカードをタップする, THE SellerListPage SHALL 売主詳細ページへ遷移する

---

### 要件2：売主詳細ページのモバイル対応

**ユーザーストーリー：** 営業担当者として、スマートフォンから売主の詳細情報を確認・編集したい。そうすることで、外出先でも売主情報を更新できる。

#### 受け入れ基準

1. WHEN MobileBreakpoint でページを表示する, THE SellerDetailPage SHALL 全てのセクションを縦1カラムレイアウトで表示する
2. WHEN MobileBreakpoint でページを表示する, THE SellerDetailPage SHALL 編集フィールドのタップターゲットを最小44px以上の高さで表示する
3. WHEN MobileBreakpoint でページを表示する, THE SellerDetailPage SHALL 「戻る」ボタンと「保存」ボタンを画面下部の固定フッターに表示する
4. WHEN MobileBreakpoint でページを表示する, THE SellerDetailPage SHALL 各セクションをアコーディオン形式で折りたたみ可能にする
5. WHEN DesktopBreakpoint でページを表示する, THE SellerDetailPage SHALL 既存の2カラムレイアウトを維持する

---

### 要件3：通話モードページのモバイル対応

**ユーザーストーリー：** 営業担当者として、スマートフォンで通話しながら売主情報を確認・入力したい。そうすることで、電話中に片手でも操作できる。

#### 受け入れ基準

1. WHEN MobileBreakpoint でページを表示する, THE CallModePage SHALL 売主の基本情報（名前・電話番号・物件住所）を画面上部に固定表示する
2. WHEN MobileBreakpoint でページを表示する, THE CallModePage SHALL 電話ボタンとSMSボタンを画面下部の固定フッターに大きく表示する（最小高さ56px）
3. WHEN MobileBreakpoint でページを表示する, THE CallModePage SHALL コメント入力エリアを画面幅いっぱいに表示する
4. WHEN MobileBreakpoint でページを表示する, THE CallModePage SHALL サイドバーを非表示にする
5. WHEN MobileBreakpoint でページを表示する, THE CallModePage SHALL 各情報セクションをアコーディオン形式で折りたたみ可能にする
6. WHEN DesktopBreakpoint でページを表示する, THE CallModePage SHALL 既存のレイアウトを維持する

---

### 要件4：買主リストページのモバイル対応

**ユーザーストーリー：** 営業担当者として、スマートフォンから買主リストを確認したい。そうすることで、外出先でも買主情報にアクセスできる。

#### 受け入れ基準

1. WHEN MobileBreakpoint でページを表示する, THE BuyerListPage SHALL StatusSidebar をページ上部に折りたたみ可能なアコーディオンとして表示する
2. WHEN MobileBreakpoint でページを表示する, THE BuyerListPage SHALL テーブルの代わりにカード形式のリストを表示する
3. WHEN MobileBreakpoint でページを表示する, THE BuyerListPage SHALL 各カードに買主番号・名前・希望エリア・ステータス・次電日を表示する
4. WHEN MobileBreakpoint でカードをタップする, THE BuyerListPage SHALL 買主詳細ページへ遷移する
5. WHEN DesktopBreakpoint でページを表示する, THE BuyerListPage SHALL 既存のテーブルレイアウトとサイドバーレイアウトを維持する

---

### 要件5：買主詳細ページのモバイル対応

**ユーザーストーリー：** 営業担当者として、スマートフォンから買主の詳細情報を確認・編集したい。そうすることで、外出先でも買主情報を更新できる。

#### 受け入れ基準

1. WHEN MobileBreakpoint でページを表示する, THE BuyerDetailPage SHALL 全てのセクションを縦1カラムレイアウトで表示する
2. WHEN MobileBreakpoint でページを表示する, THE BuyerDetailPage SHALL 編集フィールドのタップターゲットを最小44px以上の高さで表示する
3. WHEN MobileBreakpoint でページを表示する, THE BuyerDetailPage SHALL 「戻る」ボタンを画面上部に常時表示する
4. WHEN DesktopBreakpoint でページを表示する, THE BuyerDetailPage SHALL 既存のレイアウトを維持する

---

### 要件6：物件リストページのモバイル対応

**ユーザーストーリー：** 営業担当者として、スマートフォンから物件リストを確認したい。そうすることで、外出先でも物件情報にアクセスできる。

#### 受け入れ基準

1. WHEN MobileBreakpoint でページを表示する, THE PropertyListPage SHALL テーブルの代わりにカード形式のリストを表示する
2. WHEN MobileBreakpoint でページを表示する, THE PropertyListPage SHALL 各カードに物件番号・物件住所・種別・価格・ステータスを表示する
3. WHEN MobileBreakpoint でカードをタップする, THE PropertyListPage SHALL 物件詳細ページへ遷移する
4. WHEN DesktopBreakpoint でページを表示する, THE PropertyListPage SHALL 既存のテーブルレイアウトを維持する

---

### 要件7：共通ナビゲーションのモバイル対応

**ユーザーストーリー：** 営業担当者として、スマートフォンでページ間を簡単に移動したい。そうすることで、外出先でも素早く目的のページにアクセスできる。

#### 受け入れ基準

1. WHEN MobileBreakpoint でページを表示する, THE Admin_UI SHALL ページナビゲーション（`PageNavigation`コンポーネント）をハンバーガーメニューまたはボトムナビゲーションとして表示する
2. WHEN MobileBreakpoint でページを表示する, THE Admin_UI SHALL ナビゲーションのタップターゲットを最小44px以上の高さで表示する
3. WHEN DesktopBreakpoint でページを表示する, THE Admin_UI SHALL 既存のナビゲーションレイアウトを維持する

---

### 要件8：タッチ操作の最適化

**ユーザーストーリー：** 営業担当者として、スマートフォンのタッチ操作でシステムを快適に使いたい。そうすることで、誤操作なく情報を入力・確認できる。

#### 受け入れ基準

1. THE Admin_UI SHALL MobileBreakpoint において全てのインタラクティブ要素（ボタン・リンク・入力フィールド）のタップターゲットを最小44×44pxで表示する
2. WHEN MobileBreakpoint でフォームフィールドをタップする, THE Admin_UI SHALL ソフトウェアキーボードが表示されても入力フィールドが画面内に収まるようスクロール調整する
3. THE Admin_UI SHALL MobileBreakpoint においてテキストの最小フォントサイズを14pxとする（ブラウザの自動ズームを防ぐため）
4. IF MobileBreakpoint でページの横スクロールが発生する, THEN THE Admin_UI SHALL レイアウトを修正して横スクロールを発生させない

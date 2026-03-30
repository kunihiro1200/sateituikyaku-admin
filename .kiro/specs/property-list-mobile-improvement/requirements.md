# 要件ドキュメント

## はじめに

物件リストページ（PropertyListingsPage.tsx）および報告ページ（PropertyReportPage.tsx）のスマホ対応を改善する。
買主リスト（BuyersPage.tsx）・売主リストで既に実装されているスマホ向けUIパターンを物件リスト系ページにも適用し、スマホユーザーの操作性を統一する。

対象は以下の3点：
1. 物件リストのスマホ版ステータスフィルターをアコーディオン形式に変更
2. スマホ版で「未報告」系ステータス選択中に物件カードをタップした際の報告ページ遷移の動作確認・保証
3. 報告ページ（PropertyReportPage.tsx）へのスマホ用レイアウト追加

## 用語集

- **PropertyListingsPage**: 物件リストページ（`frontend/frontend/src/pages/PropertyListingsPage.tsx`）
- **PropertyReportPage**: 物件報告ページ（`frontend/frontend/src/pages/PropertyReportPage.tsx`）
- **BuyersPage**: 買主リストページ（参考実装、`frontend/frontend/src/pages/BuyersPage.tsx`）
- **PropertySidebarStatus**: 物件リストのサイドバーステータスコンポーネント（`frontend/frontend/src/components/PropertySidebarStatus.tsx`）
- **Accordion**: MUI（Material-UI）のアコーディオンコンポーネント
- **isMobile**: `useMediaQuery(theme.breakpoints.down('sm'))` で取得するスマホ判定フラグ
- **sidebarStatus**: 物件リストで選択中のサイドバーステータス文字列
- **未報告系ステータス**: `sidebarStatus` が `'未報告'` で始まる文字列（例：「未報告」「未報告（Y）」等）
- **handleRowClick**: 物件行・カードクリック時のナビゲーション処理関数
- **ReportHistory**: 報告送信履歴の型（`id`, `sent_at`, `template_name`, `report_assignee` 等を持つ）

## 要件

### 要件1：物件リストのスマホ版ステータスフィルターをアコーディオン形式に変更

**ユーザーストーリー：** スマホユーザーとして、物件リストのステータスフィルターを買主リストと同じアコーディオン形式で操作したい。そうすることで、フィルター選択後に自動的に閉じて物件カードが見やすくなる。

#### 受け入れ基準

1. WHEN スマホ表示（`isMobile === true`）のとき、THE PropertyListingsPage SHALL MUI の `Accordion`・`AccordionSummary`・`AccordionDetails` コンポーネントを使ってステータスフィルターを表示する
2. THE Accordion SHALL サマリー部分に「ステータスフィルター」というラベルと `ExpandMoreIcon` を表示する
3. WHEN ステータスフィルターのアコーディオンが展開されているとき、THE PropertyListingsPage SHALL `AccordionDetails` 内に `PropertySidebarStatus` コンポーネントを表示する
4. WHEN ユーザーがステータスを選択したとき、THE PropertyListingsPage SHALL アコーディオンを閉じる（`expanded` を `false` にする）
5. WHEN デスクトップ表示（`isMobile === false`）のとき、THE PropertyListingsPage SHALL 既存のサイドバー形式（`Paper` 内に `PropertySidebarStatus`）を表示する
6. THE PropertyListingsPage SHALL 現在の「ステータス ▼」ボタンと `mobileStatusOpen` による開閉ロジックを削除し、Accordion に置き換える
7. WHEN ステータスフィルターが選択されているとき（`sidebarStatus` が非 null かつ `'all'` 以外）、THE Accordion SHALL 選択中であることを視覚的に示す（例：AccordionSummary のスタイルや選択中ステータス名の表示）

### 要件2：スマホ版「未報告」系ステータス選択時の報告ページ遷移保証

**ユーザーストーリー：** スマホユーザーとして、「未報告」系のステータスを選択した状態で物件カードをタップしたとき、報告ページ（`/property-listings/:propertyNumber/report`）に直接遷移したい。そうすることで、デスクトップ版と同じ操作感で報告作業ができる。

#### 受け入れ基準

1. WHEN スマホ表示で `sidebarStatus` が `'未報告'` で始まる文字列のとき、THE PropertyListingsPage SHALL 物件カードのタップで `handleRowClick` を呼び出す
2. WHEN `handleRowClick` が呼ばれ `sidebarStatus` が `'未報告'` で始まる文字列のとき、THE PropertyListingsPage SHALL `/property-listings/${propertyNumber}/report` に遷移する
3. THE PropertyListingsPage SHALL デスクトップ版とスマホ版で同一の `handleRowClick` 関数を使用する（分岐なし）
4. WHEN `sidebarStatus` が `'未報告'` で始まらない文字列のとき、THE PropertyListingsPage SHALL 通常の物件詳細ページ（`/property-listings/${propertyNumber}`）に遷移する

### 要件3：報告ページへのスマホ用レイアウト追加

**ユーザーストーリー：** スマホユーザーとして、報告ページを縦1カラムのレイアウトで操作したい。そうすることで、固定2カラムレイアウトによる横スクロールや文字の見切れを解消できる。

#### 受け入れ基準

1. THE PropertyReportPage SHALL `useMediaQuery(theme.breakpoints.down('sm'))` で `isMobile` を取得する
2. WHEN スマホ表示のとき、THE PropertyReportPage SHALL ヘッダー部分を縦並び（`flexDirection: 'column'`）で表示する
3. WHEN スマホ表示のとき、THE PropertyReportPage SHALL 左右2カラムレイアウト（`flex: '0 0 380px'` + `flex: 1`）を縦1カラム（`flexDirection: 'column'`）に変更する
4. WHEN スマホ表示のとき、THE PropertyReportPage SHALL 左カラム（報告情報フォーム）を全幅（`width: '100%'`）で表示する
5. WHEN スマホ表示のとき、THE PropertyReportPage SHALL 右カラム（送信履歴・前回メール内容・買主一覧）を全幅で縦に並べて表示する
6. WHEN スマホ表示のとき、THE PropertyReportPage SHALL 送信履歴テーブルをカード形式またはスクロール可能なテーブルで表示し、横スクロールなしで主要情報（送信日時・テンプレート名・担当）が確認できるようにする
7. WHEN デスクトップ表示のとき、THE PropertyReportPage SHALL 既存の2カラムレイアウトを維持する
8. WHEN スマホ表示のとき、THE PropertyReportPage SHALL ヘッダーの保存ボタンを適切なサイズ・位置で表示する（ヘッダーが縦並びになっても保存ボタンが見切れない）
9. THE PropertyReportPage SHALL `useTheme` と `useMediaQuery` を MUI からインポートして使用する

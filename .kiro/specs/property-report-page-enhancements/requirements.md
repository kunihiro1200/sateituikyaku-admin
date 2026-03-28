# 要件ドキュメント

## はじめに

物件リストの「報告」ページ（`PropertyReportPage.tsx`）に2つの改善を加える機能です。

1. **送信履歴の表示方法変更**: 現在は件数に応じて可変行数で表示されている送信履歴テーブルを、常に5行固定で表示するように変更します。
2. **買主テーブルの追加**: 物件詳細画面（`PropertyListingDetailPage.tsx`）に表示されている `CompactBuyerListForProperty` コンポーネントと同じ買主一覧テーブルを、報告ページにも追加します。

## 用語集

- **Report_Page**: 物件リストの報告ページ（`PropertyReportPage.tsx`）
- **Report_History_Table**: 報告ページ内の送信履歴テーブル
- **Buyer_Table**: 物件に問い合わせてきた買主一覧テーブル（`CompactBuyerListForProperty` コンポーネント）
- **Property_Number**: 物件番号（URLパラメータ）
- **Buyers_API**: 物件番号に紐づく買主一覧を返すAPIエンドポイント（`/api/property-listings/{propertyNumber}/buyers`）

## 要件

### 要件1: 送信履歴の5行固定テーブル表示

**ユーザーストーリー:** 担当者として、送信履歴を常に5行固定のテーブルで確認したい。そうすることで、履歴の有無にかかわらず一定のレイアウトで情報を把握できる。

#### 受け入れ基準

1. THE Report_History_Table SHALL 常に5行を表示する（送信履歴の件数に関わらず）
2. WHEN 送信履歴が5件未満の場合、THE Report_History_Table SHALL 不足分の行を空行（ダッシュ「-」）で埋めて表示する
3. WHEN 送信履歴が5件を超える場合、THE Report_History_Table SHALL 最新5件のみを表示する
4. THE Report_History_Table SHALL 各行に「送信日時」「テンプレート」「担当」「完了」の4列を表示する
5. WHEN 空行をクリックした場合、THE Report_History_Table SHALL 何も起こらない（クリックイベントを無視する）
6. WHEN 送信履歴が0件の場合、THE Report_History_Table SHALL 5行全てを空行として表示する（「送信履歴はありません」のメッセージは表示しない）

### 要件2: 買主テーブルの追加

**ユーザーストーリー:** 担当者として、報告ページで物件に問い合わせてきた買主一覧を確認したい。そうすることで、物件詳細画面に移動せずに買主情報を把握できる。

#### 受け入れ基準

1. THE Report_Page SHALL 送信履歴テーブルの下に買主一覧テーブルを表示する
2. THE Buyer_Table SHALL `PropertyListingDetailPage` に表示されている `CompactBuyerListForProperty` コンポーネントと同じものを使用する
3. WHEN Report_Page が表示される場合、THE Report_Page SHALL `Buyers_API` を呼び出して買主データを取得する
4. WHEN 買主データの取得中の場合、THE Buyer_Table SHALL ローディングインジケーターを表示する
5. WHEN 買主データの取得に失敗した場合、THE Report_Page SHALL エラーを無視して空の買主リストを表示する
6. THE Buyer_Table SHALL 買主の「氏名」「受付日」「内覧日」「時間」「最新状況」の5列を表示する
7. WHEN 買主行をクリックした場合、THE Buyer_Table SHALL 買主詳細ページを新しいタブで開く

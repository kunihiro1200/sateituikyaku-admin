# 要件ドキュメント

## はじめに

物件リスト報告ページ（`PropertyReportPage`）のヘッダーに2つの機能を追加する。

1. **物件番号のワンクリックコピー**: ヘッダーに表示されている物件番号をクリックするとクリップボードにコピーされ、視覚的フィードバックが表示される。
2. **売買価格の表示**: 物件住所の右隣に売買価格（`price` フィールド）を万円単位で表示する。価格が0またはnullの場合は表示しない。

対象ファイル: `frontend/frontend/src/pages/PropertyReportPage.tsx`

---

## 用語集

- **PropertyReportPage**: 物件リストの報告ページ（`/property-listings/:propertyNumber/report`）
- **Header**: ページ上部の物件番号・オーナー名・住所を表示するエリア
- **Clipboard**: ブラウザのクリップボード（`navigator.clipboard.writeText`）
- **Snackbar**: MUI の通知コンポーネント。操作結果を一時的に画面下部に表示する
- **ReportData**: 物件報告情報を保持するインターフェース（`PropertyReportPage` 内で定義）
- **price**: スプレッドシートのBS列「価格」に対応するフィールド。売買価格（円単位）を表す数値

---

## 要件

### 要件1: 物件番号のワンクリックコピー

**ユーザーストーリー:** 担当者として、物件番号をワンクリックでコピーしたい。そうすることで、他のシステムへの転記作業を素早く行える。

#### 受け入れ基準

1. THE `Header` SHALL display the `propertyNumber` as a clickable element.
2. WHEN the user clicks the `propertyNumber` element, THE `Header` SHALL copy the `propertyNumber` string to the `Clipboard`.
3. WHEN the copy operation succeeds, THE `Header` SHALL display a `Snackbar` notification with the message `「物件番号をコピーしました」`.
4. IF the copy operation fails, THEN THE `Header` SHALL display a `Snackbar` notification with the message `「コピーに失敗しました」`.
5. THE `Header` SHALL display a visual indicator (cursor pointer style) on the `propertyNumber` element to indicate it is clickable.

---

### 要件2: 売買価格の表示

**ユーザーストーリー:** 担当者として、報告ページのヘッダーで物件住所と売買価格を同時に確認したい。そうすることで、報告作業中に別ページへ移動せずに価格情報を把握できる。

#### 受け入れ基準

1. THE `ReportData` interface SHALL include a `price` field of type `number | null`.
2. WHEN the `fetchData` function retrieves property data, THE `PropertyReportPage` SHALL set `reportData.price` from the API response field `d.price`.
3. WHEN `reportData.address` is present AND `reportData.price` is a positive number, THE `Header` SHALL display the price in the format `「X,XXX万円」` to the right of the address text.
4. WHEN `reportData.price` is `null`, `undefined`, or `0`, THE `Header` SHALL NOT display any price text.
5. THE `Header` SHALL display the price using `Typography` with `color="text.secondary"` and `variant="body2"` to match the address style.
6. WHEN the price value is `5000000` (500万円), THE `Header` SHALL display `「500万円」`.
7. WHEN the price value is `50000000` (5000万円), THE `Header` SHALL display `「5,000万円」`.

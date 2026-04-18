# 実装計画：物件リスト報告ページ ヘッダー機能拡張

## 概要

`PropertyReportPage.tsx` のみを変更し、物件番号のワンクリックコピーと売買価格表示の2機能を追加する。

## タスク

- [x] 1. ReportData インターフェースと fetchData の更新
  - `ReportData` インターフェースに `price?: number | null` フィールドを追加する
  - `fetchData` 関数内の `initial` オブジェクトに `price: d.price ?? null` を追加する
  - _要件: 2.1, 2.2_

- [x] 2. ヘルパー関数の追加
  - [x] 2.1 `formatPrice` 関数を実装する
    - 円単位の整数を受け取り、`Math.floor(price / 10000)` で万円に変換する
    - `toLocaleString('ja-JP')` でカンマ区切りにし、末尾に「万円」を付けた文字列を返す
    - 例: `50000000` → `"5,000万円"`、`5000000` → `"500万円"`
    - _要件: 2.3, 2.6, 2.7_

  - [ ]* 2.2 プロパティテストを書く：価格フォーマットの正確性（プロパティ 2）
    - **プロパティ 2: 価格フォーマットの正確性**
    - fast-check を使用し、`fc.integer({ min: 10000, max: 9999999990000 })` で任意の正の整数を生成する
    - `formatPrice(price)` の結果が `${Math.floor(price / 10000).toLocaleString('ja-JP')}万円` と等しいことを検証する
    - **検証対象: 要件 2.3, 2.6, 2.7**

  - [x] 2.3 `handleCopyPropertyNumber` 関数を実装する
    - `propertyNumber` が `undefined` の場合は早期リターンする
    - `navigator.clipboard.writeText(propertyNumber)` を呼び出す
    - 成功時: `setSnackbar({ open: true, message: '物件番号をコピーしました', severity: 'success' })` を呼び出す
    - 失敗時: `setSnackbar({ open: true, message: 'コピーに失敗しました', severity: 'error' })` を呼び出す
    - 既存の `snackbar` ステートを再利用し、新規ステートは追加しない
    - _要件: 1.2, 1.3, 1.4_

  - [ ]* 2.4 プロパティテストを書く：クリップボードコピーの正確性（プロパティ 1）
    - **プロパティ 1: クリップボードコピーの正確性**
    - fast-check を使用し、`fc.string({ minLength: 1 })` で任意の物件番号文字列を生成する
    - `navigator.clipboard.writeText` が必ずその物件番号文字列と同一の引数で呼ばれることを検証する
    - **検証対象: 要件 1.2**

- [x] 3. ヘッダー JSX の変更
  - [x] 3.1 物件番号をクリッカブルな `Box` でラップする
    - `Typography` 内の `{propertyNumber}` 部分を `Box component="span"` でラップする
    - `onClick={handleCopyPropertyNumber}` を設定する
    - `sx={{ cursor: 'pointer', '&:hover': { opacity: 0.7 } }}` を設定する
    - _要件: 1.1, 1.5_

  - [x] 3.2 住所の右隣に価格を表示する JSX を追加する
    - 住所の `Typography` を `Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}` でラップする
    - `reportData.price != null && reportData.price > 0` の条件で価格 `Typography` を表示する
    - 価格 `Typography` は `variant="body2"` と `color="text.secondary"` を使用する
    - `{formatPrice(reportData.price)}` で価格文字列を表示する
    - _要件: 2.3, 2.4, 2.5_

  - [ ]* 3.3 プロパティテストを書く：APIレスポンスの price マッピング（プロパティ 3）
    - **プロパティ 3: APIレスポンスの price マッピング**
    - fast-check を使用し、`fc.oneof(fc.integer({ min: 1 }), fc.constant(0), fc.constant(null), fc.constant(undefined))` で任意の price 値を生成する
    - `fetchData` 相当のマッピング処理後の `reportData.price` が `d.price ?? null` の結果と等しいことを検証する
    - **検証対象: 要件 2.2, 2.4**

- [x] 4. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP では省略可能
- 変更対象ファイルは `frontend/frontend/src/pages/PropertyReportPage.tsx` のみ
- バックエンドの変更は不要
- 新規ステートや新規コンポーネントは追加しない
- 各タスクは要件との対応を明示している

# 実装計画：売主新規登録コピーフィールド

## 概要

バックエンドAPIの追加 → `POST /api/sellers` の拡張 → フロントエンド修正 → プロパティベーステストの順で実装する。
暗号化フィールド（`name`, `phone_number`, `email`）は必ず `decrypt()` を通して扱うこと。
`backend/src/` 配下のみ編集し、`backend/api/` は触らない。

---

## タスク

- [x] 1. `GET /api/sellers/next-seller-number` エンドポイントを追加する
  - `backend/src/routes/sellers.ts` に新規ルートを追加する
  - `BuyerNumberSpreadsheetClient` と同じパターンで `GoogleSheetsClient` を使い、連番シート（ID: `19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs`）の「連番」シートの C2 セルを `readRawRange` で読み取る
  - C2 の値を数値に変換し、`"AA" + String(n + 1)` 形式で返す
  - C2 読み取り失敗時は 500 エラーを返す
  - ルートは `router.get('/search', ...)` より前に配置する（Express のルート順序の問題を避けるため）
  - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 1.1 `GET /api/sellers/next-seller-number` のプロパティテストを書く
    - **Property 4: 売主番号フォーマットの正確性**
    - `fc.integer({ min: 1, max: 99999 })` でランダムな整数 `n` を生成し、`"AA" + String(n + 1)` が返ることを検証
    - **Validates: Requirements 4.2, 4.3**

- [x] 2. `GET /api/sellers/search` の売主番号・名前検索を確認・修正する
  - 既存の `sellerService.searchSellers(query)` が `seller_number` と `name`（復号済み）の両方を対象に部分一致検索していることを確認する
  - レスポンスに `id`, `sellerNumber`, `name`, `propertyAddress` が含まれることを確認する
  - 検索結果が `seller_number` または `name` にクエリを含む売主のみであることを確認する
  - _Requirements: 1.2_

  - [ ]* 2.1 `GET /api/sellers/search` のプロパティテストを書く
    - **Property 1: 売主コピー検索結果の整合性**
    - `fc.string()` でランダムなクエリを生成し、返却された全候補が `seller_number` または `name` にクエリを含むことを検証
    - **Validates: Requirements 1.2**

- [x] 3. `POST /api/sellers` 成功後の連番シート C2 更新を実装する
  - `backend/src/services/SellerService.supabase.ts` の `createSeller()` を修正する
  - DB 登録成功後、連番シートの C2 セルを `writeRawCell` で `(現在値 + 1)` に更新する
  - C2 更新はベストエフォート（失敗してもDB登録は成功として返す）
  - 失敗時はエラーをログに記録する
  - _Requirements: 4.4, 4.5_

- [x] 4. `POST /api/sellers` 成功後の売主リストスプレッドシートへの行追加を実装する
  - `backend/src/services/SellerService.supabase.ts` の `createSeller()` を修正する
  - DB 登録成功後、売主リストスプレッドシート（ID: `1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I`）の「売主リスト」シートの最終行に `appendRow` で新規売主データを追加する
  - `seller-spreadsheet-column-mapping.md` のカラムマッピングに従ってデータを書き込む（B列が `seller_number`）
  - 行追加はベストエフォート（失敗してもDB登録は成功として返す）
  - 失敗時はエラーをログに記録する
  - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 4.1 売主リスト行追加のプロパティテストを書く
    - **Property 6: 売主リストへの正確な行追加**
    - ランダムな売主データを生成し、`appendRow` で追加された行の各カラムがカラムマッピングに従って正しい位置に書き込まれることを検証
    - **Validates: Requirements 6.1, 6.2**

- [x] 5. チェックポイント - バックエンドの動作確認
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

- [x] 6. `NewSellerPage.tsx` に売主番号フィールドを追加する
  - `frontend/frontend/src/pages/NewSellerPage.tsx` を修正する
  - ページ表示時（`useEffect`）に `GET /api/sellers/next-seller-number` を呼び出し、取得した番号を state に保存する
  - 基本情報セクションの名前フィールドの上に「売主番号」TextField を追加する（`InputProps.readOnly: true`）
  - 売主番号が空の場合は登録ボタンを `disabled` にする
  - 取得失敗時はエラーメッセージを表示する
  - `handleSubmit` の送信データに `sellerNumber` を含める
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 7. `NewSellerPage.tsx` に売主コピーフィールドを追加する
  - MUI `Autocomplete` コンポーネントを使用する
  - 売主番号フィールドの上（基本情報セクション先頭）に配置する
  - 入力値が変わるたびに `GET /api/sellers/search?q={input}` を呼び出して候補を表示する
  - 候補の表示形式: `"{sellerNumber} - {name}"`
  - 候補選択後に `GET /api/sellers/by-number/{sellerNumber}` を呼び出す
  - 取得成功時: `name`, `address`（依頼者住所）, `phoneNumber`, `email` を自動入力する
  - 取得失敗時: エラーメッセージを表示し、フィールドは変更しない
  - 任意入力（必須ではない）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 7.1 売主コピーによるフィールド自動入力のプロパティテストを書く
    - **Property 2: 売主コピーによるフィールド自動入力**
    - ランダムな売主データを生成し、コピー後のフォームフィールドが売主データの対応フィールドと一致することを検証
    - **Validates: Requirements 1.3, 1.4**

- [x] 8. `NewSellerPage.tsx` に買主コピーフィールドを追加する
  - MUI `Autocomplete` コンポーネントを使用する
  - 売主コピーフィールドの下、売主番号フィールドの上に配置する
  - 入力値が変わるたびに `GET /api/buyers/search?q={input}&limit=20` を呼び出して候補を表示する
  - 候補の表示形式: `"{buyerNumber} - {name}"`
  - 候補選択後に `GET /api/buyers/{buyerNumber}` を呼び出す
  - 取得成功時: `name`, `phone_number`, `email` を自動入力する（暗号化フィールドは `decrypt()` 済みの値が返ってくる）
  - 取得失敗時: エラーメッセージを表示し、フィールドは変更しない
  - 任意入力（必須ではない）
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 8.1 買主コピーによるフィールド自動入力のプロパティテストを書く
    - **Property 3: 買主コピーによるフィールド自動入力**
    - ランダムな買主データを生成し、コピー後のフォームフィールドが買主データの対応フィールドと一致することを検証
    - **Validates: Requirements 2.3, 2.4**

- [x] 9. 基本情報セクションのフィールド表示順序を整える
  - 基本情報セクション内のフィールドを以下の順序に並べ替える：
    1. 売主コピー（Autocomplete）
    2. 買主コピー（Autocomplete）
    3. 売主番号（読み取り専用 TextField）
    4. 名前（既存）
    5. 依頼者住所（既存）
    6. 電話番号（既存）
    7. メールアドレス（既存）
  - _Requirements: 5.1, 5.2_

- [x] 10. 売主番号の DB 保存ラウンドトリップを確認する
  - `POST /api/sellers` のバリデーションで `sellerNumber` が `AA{5桁数字}` 形式であることを確認する（既存バリデーション）
  - 登録後に `GET /api/sellers/by-number/{sellerNumber}` で同じ `sellerNumber` が返ることを確認する

  - [ ]* 10.1 売主番号のDB保存ラウンドトリップのプロパティテストを書く
    - **Property 5: 売主番号のDB保存ラウンドトリップ**
    - ランダムな売主番号を生成し、登録後に `by-number` で取得した `seller_number` が一致することを検証（統合テスト）
    - **Validates: Requirements 4.6**

- [x] 11. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

---

## 注意事項

- タスクに `*` が付いているものは任意（スキップ可能）
- 各タスクは前のタスクの成果物を前提として進める
- `backend/api/` は公開物件サイト用のため絶対に触らない
- 暗号化フィールド（`name`, `phone_number`, `email`）は `decrypt()` を通して扱う
- 売主リストスプレッドシートの B 列が `seller_number`（A 列は空列）

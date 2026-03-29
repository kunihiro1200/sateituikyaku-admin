# 実装計画: buyer-copy-fields-registration

## 概要

`NewBuyerPage.tsx` に売主コピー・買主コピーフィールドを追加する。
`NewSellerPage.tsx` の既存実装を参考に、TypeScript で移植する。
変更対象は `frontend/frontend/src/pages/NewBuyerPage.tsx` のみ。

## タスク

- [x] 1. 売主コピー・買主コピーの state を追加する
  - `sellerCopyInput`, `sellerCopyOptions`, `sellerCopyLoading` の3つの state を追加
  - `buyerCopyInput`, `buyerCopyOptions`, `buyerCopyLoading` の3つの state を追加
  - 型定義は `NewSellerPage.tsx` の実装に合わせる
  - _Requirements: 1.1, 2.1_


- [x] 2. 売主コピーのハンドラ関数を実装する
  - [x] 2.1 `handleSellerCopySearch(query: string)` を実装する
    - `query.length < 2` の場合は `sellerCopyOptions` をクリアして早期リターン
    - `GET /api/sellers/search?q={query}` を呼び出して `sellerCopyOptions` にセット
    - `sellerCopyLoading` で読み込み状態を管理
    - _Requirements: 1.2, 1.6_

  - [ ]* 2.2 `handleSellerCopySearch` のプロパティテストを書く
    - **Property 3: コピーフィールドは2文字以上で検索APIを呼び出す（売主側）**
    - **Validates: Requirements 1.2**

  - [x] 2.3 `handleSellerCopySelect(option)` を実装する
    - `GET /api/sellers/by-number/{option.sellerNumber}` で売主詳細を取得
    - `seller.name` → `setName()`、`seller.phoneNumber` → `setPhoneNumber()`、`seller.email` → `setEmail()`
    - `setInquirySource('売主')` を自動設定
    - エラー時は `setError('売主情報の取得に失敗しました')`
    - _Requirements: 1.3, 1.4, 1.5, 4.2_

  - [ ]* 2.4 `handleSellerCopySelect` のプロパティテストを書く
    - **Property 1: 売主コピー選択後の自動入力と問合せ元設定**
    - **Validates: Requirements 1.3, 1.4, 1.5, 4.2**


- [x] 3. 買主コピーのハンドラ関数を実装する
  - [x] 3.1 `handleBuyerCopySearch(query: string)` を実装する
    - `query.length < 2` の場合は `buyerCopyOptions` をクリアして早期リターン
    - `GET /api/buyers/search?q={query}&limit=20` を呼び出して `buyerCopyOptions` にセット
    - `buyerCopyLoading` で読み込み状態を管理
    - _Requirements: 2.2, 2.6_

  - [ ]* 3.2 `handleBuyerCopySearch` のプロパティテストを書く
    - **Property 3: コピーフィールドは2文字以上で検索APIを呼び出す（買主側）**
    - **Validates: Requirements 2.2**

  - [x] 3.3 `handleBuyerCopySelect(option)` を実装する
    - `GET /api/buyers/{option.buyer_number}` で買主詳細を取得
    - `buyer.name` → `setName()`、`buyer.phoneNumber || buyer.phone_number` → `setPhoneNumber()`、`buyer.email` → `setEmail()`
    - `setInquirySource('2件目以降')` を自動設定
    - エラー時は `setError('買主情報の取得に失敗しました')`
    - _Requirements: 2.3, 2.4, 2.5, 4.1_

  - [ ]* 3.4 `handleBuyerCopySelect` のプロパティテストを書く
    - **Property 2: 買主コピー選択後の自動入力と問合せ元設定**
    - **Validates: Requirements 2.3, 2.4, 2.5, 4.1**


- [x] 4. チェックポイント - ハンドラ関数の動作確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 5. JSX に売主コピー・買主コピーフィールドを追加する
  - 基本情報セクションの「買主番号（自動採番）」フィールドの直前に2つの `Autocomplete` を追加
  - 配置順序: 売主コピー → 買主コピー → 買主番号（自動採番）
  - 売主コピーの `Autocomplete` は `NewSellerPage.tsx` の実装をそのまま参考にする
    - `getOptionLabel`: `${option.sellerNumber} - ${option.name}`
    - `noOptionsText`: `"該当する売主が見つかりません"`
    - `isOptionEqualToValue`: `option.sellerNumber === value.sellerNumber`
  - 買主コピーの `Autocomplete` は `NewSellerPage.tsx` の実装をそのまま参考にする
    - `getOptionLabel`: `${option.buyer_number} - ${option.name}`
    - `noOptionsText`: `"該当する買主が見つかりません"`
    - `isOptionEqualToValue`: `option.buyer_number === value.buyer_number`
  - 日本語ファイルの編集は `file-encoding-protection.md` のルールに従い Python スクリプトを使用する
  - _Requirements: 1.1, 2.1, 3.1_

  - [ ]* 5.1 フォーム送信データにコピーフィールドが含まれないことのプロパティテストを書く
    - **Property 5: コピーフィールドはDBに保存されない**
    - **Validates: Requirements 5.2**


- [x] 6. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは要件との対応関係を明記
- 日本語ファイルの編集は必ず Python スクリプト経由で行う（`file-encoding-protection.md` 参照）
- デプロイは `git add . && git commit -m "..." && git push origin main` で行う
- プロパティテストは `fast-check` を使用し、各プロパティにつき100回以上実行する

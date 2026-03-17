# 実装計画: レインズ登録・サイト入力ページ

## 概要

物件詳細画面にボタンを追加し、レインズ登録・サイト入力専用ページを新規作成する。
既存の `PUT /api/property-listings/:propertyNumber` を使用し、バックエンドの変更は不要。

## タスク

- [x] 1. App.tsx にルートを追加する
  - `ReinsRegistrationPage` のインポートを追加
  - `/property-listings/:propertyNumber/reins-registration` ルートを `ProtectedRoute` でラップして追加
  - 既存の `/property-listings/:propertyNumber` ルートの前に配置
  - 日本語を含むファイルのためPythonスクリプトでUTF-8書き込みを行う
  - _Requirements: 1.2, 1.3_

- [x] 2. PropertyListingDetailPage.tsx にボタンを追加する
  - `navigate` を使用して `/property-listings/${propertyNumber}/reins-registration` へ遷移するボタンを追加
  - 「報告」ボタンの前（`<Box sx={{ display: 'flex', gap: 2 }}>` の直後）に配置
  - スタイル: `borderColor: '#1565c0', color: '#1565c0'`
  - 日本語を含むファイルのためPythonスクリプトでUTF-8書き込みを行う
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. ReinsRegistrationPage.tsx を新規作成する
  - [x] 3.1 ページの基本構造とデータ取得を実装する
    - `useParams` で `propertyNumber` を取得
    - ページ読み込み時に `GET /api/property-listings/:propertyNumber` で現在値を取得
    - `loading`, `data`, `updating`, `snackbar` のstateを定義
    - 物件番号をページヘッダーに表示
    - 物件詳細画面へ戻るボタンを実装（`/property-listings/:propertyNumber` へ遷移）
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 3.2 3つのボタン切り替えフィールドを実装する
    - `REINS_FIELDS` 定義（`reins_certificate_email`, `cc_assignee`, `report_date_setting`）
    - 各フィールドに対してボタングループを表示
    - 現在値のボタンを `variant="contained"` で強調表示、他を `variant="outlined"` で表示
    - ボタンクリック時に `PUT /api/property-listings/:propertyNumber` を呼び出す
    - 更新中は `updating` stateにフィールド名をセットしてローディング表示
    - 成功時はSnackbarで成功メッセージを表示
    - 失敗時はSnackbarでエラーメッセージを表示し、UIを更新前の値に戻す
    - _Requirements: 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 3.3 レインズURLボタンを実装する
    - 「レインズURL」ボタンをクリックすると `https://system.reins.jp/` を新しいタブで開く
    - _Requirements: 4.1, 4.2_

  - [ ]* 3.4 Property 1のプロパティテストを書く
    - **Property 1: ボタンクリックによるDB更新**
    - **Validates: Requirements 3.2, 3.3, 5.2, 5.3, 6.2, 6.3, 7.1**

  - [ ]* 3.5 Property 3のプロパティテストを書く
    - **Property 3: 現在値の強調表示**
    - **Validates: Requirements 3.4, 5.4, 6.4**

  - [ ]* 3.6 Property 4のプロパティテストを書く
    - **Property 4: ページ読み込み時のDB値反映**
    - **Validates: Requirements 2.3**

  - [ ]* 3.7 Property 6のプロパティテストを書く
    - **Property 6: DB更新失敗時のエラー表示**
    - **Validates: Requirements 7.3**

- [x] 4. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` 付きのサブタスクはオプションであり、スキップ可能
- 日本語を含むファイル（`App.tsx`, `PropertyListingDetailPage.tsx`）の編集はPythonスクリプトでUTF-8書き込みを行う
- バックエンドの変更は不要（`backend/api/` は公開物件サイト用なので触らない）
- 各タスクは要件との対応を明記

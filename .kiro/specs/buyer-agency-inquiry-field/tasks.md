# 実装計画: 業者問合せフィールド（buyer-agency-inquiry-field）

## 概要

新規買主登録画面（`NewBuyerPage.tsx`）と買主詳細画面（`BuyerDetailPage.tsx`）に、法人名の入力有無を条件として業者問合せフィールドを条件付き表示する機能を追加する。フロントエンドのみの変更で完結する。

## タスク

- [x] 1. NewBuyerPage.tsx に法人名・業者問合せフィールドを追加する
  - `company_name` と `broker_inquiry` の state を追加する
  - 基本情報セクションに「法人名」テキストフィールドを追加する
  - `showBrokerInquiry()` ヘルパー関数を実装する（`company_name.trim().length > 0` で判定）
  - 法人名に入力がある場合のみ「業者問合せ」ドロップダウンを表示する（選択肢: 「業者問合せ」「業者（両手）」）
  - 法人名がクリアされた場合に `broker_inquiry` の値を空文字列にリセットする
  - `POST /api/buyers` の送信データに `company_name` と `broker_inquiry` を含める（法人名が空の場合は `broker_inquiry` を空文字列で送信）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [-]* 1.1 `showBrokerInquiry()` 関数のプロパティテストを書く
    - **Property 1: 法人名の有無と業者問合せの表示状態の一致**
    - **Validates: Requirements 1.2, 1.3**
    - fast-check を使用し、任意の文字列に対して `showBrokerInquiry()` の結果が `companyName.trim().length > 0` と等価であることを検証する

  - [ ]* 1.2 法人名クリア時のリセット動作のプロパティテストを書く
    - **Property 2: 法人名クリア時の業者問合せ値のリセット**
    - **Validates: Requirements 1.4**
    - fast-check を使用し、任意の法人名・業者問合せ値の組み合わせで法人名を空にした場合に `broker_inquiry` が空文字列になることを検証する

  - [ ]* 1.3 送信ペイロードへの broker_inquiry 包含のプロパティテストを書く
    - **Property 3: 登録リクエストへの broker_inquiry の包含**
    - **Validates: Requirements 3.1, 3.2**
    - fast-check を使用し、任意のフォームデータに対して送信ペイロードに `broker_inquiry` キーが含まれることを検証する

- [x] 2. BuyerDetailPage.tsx に業者問合せフィールドを追加する
  - `BUYER_FIELD_SECTIONS` の基本情報セクションで `company_name` フィールドの直後に `broker_inquiry` フィールドを追加する
  - `conditionalOn: 'company_name'` の仕組みを実装し、`company_name` が空の場合はフィールドを非表示にする
  - `fieldType: 'dropdown'` として「業者問合せ」「業者（両手）」の選択肢でインライン編集可能にする
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 2.1 BuyerDetailPage の条件付き表示のプロパティテストを書く
    - **Property 4: BuyerDetailPage での条件付き表示**
    - **Validates: Requirements 4.2, 4.3**
    - fast-check を使用し、任意の買主データに対して `company_name` の有無と `broker_inquiry` フィールドの表示状態が一致することを検証する

- [x] 3. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVP を優先する場合はスキップ可能
- 日本語を含むファイルの編集は Pythonスクリプトを使用して UTF-8 で書き込むこと（`file-encoding-protection.md` のルール）
- 変更前に必ず `git log` でコミット履歴を確認すること（`git-history-first-approach.md` のルール）
- fast-check のインストールが必要な場合: `npm install --save-dev fast-check`（`frontend/frontend/` ディレクトリで実行）
- プロパティテストは各プロパティを独立したサブタスクとして実装する

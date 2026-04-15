# 実装計画: ATBB状況変更時の買付情報「状況」必須バリデーション

## 概要

`PropertyListingDetailPage.tsx` に対して以下の変更を加える:
1. `isPreToPublicTransition` 純粋関数を新規追加
2. `handleSaveHeader` にATBB状況変更時の `offer_status` バリデーションを追加

バックエンドへの変更は不要。既存の `offerErrors` / `isOfferEditMode` の仕組みを活用する。

## タスク

- [x] 1. `isPreToPublicTransition` 純粋関数の実装
  - `PropertyListingDetailPage.tsx` 内に `isPreToPublicTransition(prevStatus, nextStatus)` 関数を追加する
  - 「専任・公開前 → 専任・公開中」と「一般・公開前 → 一般・公開中」の2パターンのみ `true` を返す
  - `null` / `undefined` を受け取った場合は `false` を返す
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 1.1 プロパティテスト: 公開前→公開中判定の排他性（Property 1）
    - **Property 1: 公開前→公開中判定の排他性**
    - fast-check で全ATBB状況の組み合わせを生成し、`true` を返すのが2パターンのみであることを検証する
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

  - [ ]* 1.2 ユニットテスト: `isPreToPublicTransition` の具体的なケース
    - 「専任・公開前 → 専任・公開中」: `true`
    - 「一般・公開前 → 一般・公開中」: `true`
    - 「専任・公開前 → 一般・公開中」: `false`（媒介種別が変わる）
    - 「一般・公開前 → 専任・公開中」: `false`（媒介種別が変わる）
    - 「専任・公開中 → 非公開（専任）」: `false`
    - `null → 専任・公開中`: `false`
    - `専任・公開前 → null`: `false`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 2. `handleSaveHeader` へのATBB状況バリデーション追加
  - `handleSaveHeader` 関数の先頭に、`editedData.atbb_status` が存在する場合のバリデーションロジックを追加する
  - `isPreToPublicTransition` を呼び出し、スキップ条件に該当しない場合のみ `offer_status` の空チェックを行う
  - `offer_status` が空の場合: `setOfferErrors(prev => ({ ...prev, offer_status: '必須項目です' }))` を呼び出し、`setIsOfferEditMode(true)` で編集モードに切り替え、`return` で保存を中断する
  - `offer_status` の現在値は `editedData.offer_status` が優先、なければ `data?.offer_status` を参照する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.1 プロパティテスト: ATBB状況変更時のoffer_statusバリデーション（Property 2）
    - **Property 2: ATBB状況変更時のoffer_statusバリデーション**
    - `validateAtbbStatusChangeForHeader(prevStatus, nextStatus, offerStatus)` として純粋関数に切り出してテストする
    - fast-check で prevStatus / nextStatus / offerStatus の組み合わせを生成し、4つの条件分岐すべてが正しく動作することを検証する
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [ ]* 2.2 ユニットテスト: `handleSaveHeader` のバリデーション動作
    - ATBB状況変更あり・スキップ条件外・offer_status空 → APIが呼ばれない、`offerErrors.offer_status` にエラーがセットされる、`isOfferEditMode` が `true` になる
    - ATBB状況変更あり・スキップ条件外・offer_status有 → APIが呼ばれる
    - ATBB状況変更あり・スキップ条件（専任・公開前→専任・公開中）・offer_status空 → APIが呼ばれる
    - ATBB状況変更なし・offer_status空 → APIが呼ばれる
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.3, 2.4_

- [x] 3. チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは対応する要件番号を参照している
- プロパティテストは fast-check を使用し、最低100回のイテレーションで実行する
- バックエンドへの変更は不要

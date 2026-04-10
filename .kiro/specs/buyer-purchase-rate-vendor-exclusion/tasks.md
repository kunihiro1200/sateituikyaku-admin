# 実装計画：買付率計算における業者問合せ買主の除外

## 概要

`backend/src/services/BuyerService.ts` のみを変更し、買付率統計の集計から業者問合せ買主（`broker_inquiry` に値がある買主）を除外する。フロントエンドおよびAPIレスポンス形式への変更は不要。

## タスク

- [x] 1. `isVendorBuyer` ヘルパー関数の実装
  - `BuyerService.ts` 内（またはモジュールスコープ）に `isVendorBuyer(brokerInquiry: string | null | undefined): boolean` を定義する
  - `null`・`undefined`・`''`・`'0'` の場合は `false`、それ以外は `true` を返す
  - _Requirements: 1.3, 1.4_

  - [ ]* 1.1 `isVendorBuyer` のプロパティテストを作成する
    - **Property 2: 業者問合せ判定関数の正確性**
    - **Validates: Requirements 1.3, 1.4**
    - fast-check を使用し、`null`・`''`・`'0'` → `false`、それ以外の任意文字列 → `true` を検証する

  - [ ]* 1.2 `isVendorBuyer` のユニットテストを作成する
    - `null` → `false`、`''` → `false`、`'0'` → `false`、`'1'` → `true`、`'業者'` → `true` を確認する
    - _Requirements: 1.3, 1.4_

- [x] 2. `getPurchaseRateStatistics` のSupabaseクエリに `broker_inquiry` を追加する
  - `.select(...)` の文字列に `broker_inquiry` カラムを追加する
  - _Requirements: 3.1_

- [x] 3. `groupByMonthAndAssignee` に業者問合せ除外ロジックを追加する
  - 既存の `GYOSHA` 除外処理の直後に `isVendorBuyer(buyer.broker_inquiry)` が `true` の場合は `continue` する処理を追加する
  - _Requirements: 1.1, 1.2, 1.5, 3.2, 3.3_

  - [ ]* 3.1 `groupByMonthAndAssignee` のプロパティテストを作成する
    - **Property 1: 業者問合せ買主は集計から除外される**
    - **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 3.2**
    - fast-check で業者問合せあり・なし混在の買主リストを生成し、結果グループに業者問合せ買主が含まれないことを検証する

  - [ ]* 3.2 `groupByMonthAndAssignee` のプロパティテストを作成する（全員業者問合せのケース）
    - **Property 3: 内覧件数0の場合は買付率がnull**
    - **Validates: Requirements 2.4**
    - 全員が業者問合せ買主のリストを渡した場合、`grouped.size === 0` になることを検証する

  - [ ]* 3.3 `groupByMonthAndAssignee` のユニットテストを作成する
    - 業者問合せ買主が除外されること、GYOSHA担当者と業者問合せ買主の両方が除外されること、通常買主のみのリストでは全員が集計対象になることを確認する
    - _Requirements: 1.1, 1.2, 1.5, 3.2_

- [x] 4. チェックポイント — 全テストがパスすることを確認する
  - 全テストがパスすることを確認し、疑問点があればユーザーに確認する。

- [x] 5. キャッシュ整合性の確認
  - `purchaseRateStatisticsCache` への保存処理が除外後のデータを使っていることをコードレビューで確認する（既存のキャッシュ無効化タイミングは変更しない）
  - _Requirements: 4.1, 4.2_

- [x] 6. 既存機能への影響がないことを確認する
  - `BuyerService.ts` 内の他のメソッド（買主一覧取得、買主詳細取得など）が変更されていないことを確認する
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 7. 最終チェックポイント — 全テストがパスすることを確認する
  - 全テストがパスすることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVPを優先する場合はスキップ可能
- 各タスクは要件番号を参照しており、トレーサビリティを確保している
- 変更対象ファイルは `backend/src/services/BuyerService.ts` のみ
- プロパティテストには fast-check（TypeScript向けPBTライブラリ）を使用する

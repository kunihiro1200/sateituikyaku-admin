# 実装計画: buyer-viewing-notification-sender-fix

## 概要

買主詳細ページの内覧セクションに `notification_sender`（通知送信者）と `viewing_type`（内覧形態）フィールドを追加し、`BuyerStatusCalculator.ts` の Priority 3 判定条件に `isBlank(buyer.notification_sender)` を追加するバグ修正。

## タスク

- [x] 1. `BuyerDetailPage.tsx` の `BUYER_FIELD_SECTIONS` にフィールドを追加する
  - `BUYER_FIELD_SECTIONS` の「基本情報」セクションまたは内覧関連の適切なセクションに以下を追加する
    - `{ key: 'notification_sender', label: '通知送信者', inlineEditable: true }`
    - `{ key: 'viewing_type', label: '内覧形態', inlineEditable: true }`
  - 既存フィールド（`latest_viewing_date`、`viewing_result_follow_up` 等）が存在するセクションを確認し、同じセクションに追加する
  - _Requirements: 2.1, 2.2, 3.4_

  - [x]* 1.1 `BUYER_FIELD_SECTIONS` に `notification_sender` と `viewing_type` が含まれることを確認するユニットテストを追加する
    - `BUYER_FIELD_SECTIONS` のいずれかのセクションに `key: 'notification_sender'` のフィールドが存在すること
    - `BUYER_FIELD_SECTIONS` のいずれかのセクションに `key: 'viewing_type'` のフィールドが存在すること
    - 既存フィールド（`latest_viewing_date` 等）が引き続き存在すること
    - _Requirements: 2.1, 2.2_

- [x] 2. `BuyerStatusCalculator.ts` の Priority 3 判定条件を修正する
  - Priority 3（内覧日前日）の `if` 条件に `isBlank(buyer.notification_sender)` を追加する
  - 修正後の条件:
    ```typescript
    // Priority 3: 内覧日前日（業者問合せは除外、通知送信者が入力済みの場合も除外）
    if (
      and(
        isNotBlank(buyer.latest_viewing_date),
        not(equals(buyer.broker_inquiry, '業者問合せ')),
        isBlank(buyer.notification_sender),  // ← 追加
        or(
          and(isTomorrow(buyer.latest_viewing_date), not(equals(getDayOfWeek(buyer.latest_viewing_date), '木曜日'))),
          and(isDaysFromToday(buyer.latest_viewing_date, 2), equals(getDayOfWeek(buyer.latest_viewing_date), '木曜日'))
        )
      )
    )
    ```
  - _Requirements: 2.3_

  - [x] 2.1 `BuyerStatusCalculator.bugfix.test.ts` にバグ修正確認テストを追加する
    - `notification_sender = '山田'`、`latest_viewing_date = 明日`、`broker_inquiry = null` → ステータスが「内覧日前日」以外であることを確認
    - `notification_sender = '山田'`、`latest_viewing_date = 木曜日（2日後）` → ステータスが「内覧日前日」以外であることを確認
    - `notification_sender = null`、`latest_viewing_date = 明日`、`broker_inquiry = null` → ステータスが「内覧日前日」であることを確認（リグレッション防止）
    - `notification_sender = ''`（空文字）、`latest_viewing_date = 明日` → ステータスが「内覧日前日」であることを確認（リグレッション防止）
    - `broker_inquiry = '業者問合せ'`、`notification_sender = null`、`latest_viewing_date = 明日` → ステータスが「内覧日前日」以外であることを確認（既存ロジックの保持）
    - _Requirements: 2.3, 3.1, 3.2, 3.3_

  - [x]* 2.2 Property 1 のプロパティベーステストを追加する
    - **Property 1: 通知送信者入力済みの場合は内覧日前日カテゴリーから除外される**
    - **Validates: Requirements 2.3**
    - `fast-check` を使用し、非空の `notification_sender` と「業者問合せ」以外の `broker_inquiry` の任意の組み合わせで `status !== '内覧日前日'` を検証する（numRuns: 100）

  - [x]* 2.3 Property 2 のプロパティベーステストを追加する
    - **Property 2: 通知送信者が空欄の場合は内覧日前日カテゴリーに表示され続ける**
    - **Validates: Requirements 3.1, 3.2**
    - `fast-check` を使用し、空欄の `notification_sender`（null/undefined/空文字）と「業者問合せ」以外の `broker_inquiry` の任意の組み合わせで `status === '内覧日前日'` を検証する（numRuns: 100）

  - [x]* 2.4 Property 3 のプロパティベーステストを追加する
    - **Property 3: 業者問合せの場合は内覧日前日カテゴリーから除外され続ける**
    - **Validates: Requirements 3.3**
    - `fast-check` を使用し、任意の `notification_sender` と `broker_inquiry = '業者問合せ'` の組み合わせで `status !== '内覧日前日'` を検証する（numRuns: 100）

- [x] 3. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP では省略可能
- `buyer-column-mapping.json` の変更は不要（3フィールドともすでにマッピング済み）
- `BuyerData` インターフェースの変更は不要（`notification_sender` はすでに定義済み）
- フロントエンドの `Buyer` インターフェースは `[key: string]: any` の動的型定義のため、型定義変更も不要
- プロパティベーステストのタグコメント形式: `// Feature: buyer-viewing-notification-sender-fix, Property N: ...`

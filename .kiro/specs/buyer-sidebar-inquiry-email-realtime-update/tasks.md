# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - inquiry_email_phone 更新でサイドバーカウント更新がトリガーされない
  - **重要**: このテストは未修正コードで必ず FAIL する — FAIL することでバグの存在を確認する
  - **修正を試みないこと** — テストが失敗しても、テストもコードも修正しない
  - **注意**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **目的**: バグの存在を示すカウンターエグザンプルを発見する
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト1: `shouldUpdateBuyerSidebarCounts({ inquiry_email_phone: '済' })` が `true` を返すことをアサート（未修正コードでは `false` を返すため FAIL）
  - テスト2: `determineBuyerCategories({ inquiry_email_phone: '未', ... })` が `inquiryEmailUnanswered` カテゴリを含むことをアサート（未修正コードでは含まれないため FAIL）
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 発見されたカウンターエグザンプルを記録して根本原因を理解する（例: `shouldUpdateBuyerSidebarCounts({ inquiry_email_phone: '済' })` が `false` を返す）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 2.1, 2.2_

- [x] 2. 保持プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - 既存フィールドの監視動作と他カテゴリ判定が維持される
  - **重要**: 観察優先メソドロジーに従う
  - 観察: 未修正コードで `shouldUpdateBuyerSidebarCounts({ next_call_date: '2026-01-01' })` が `true` を返すことを確認
  - 観察: 未修正コードで `shouldUpdateBuyerSidebarCounts({ follow_up_assignee: '担当者' })` が `true` を返すことを確認
  - 観察: 未修正コードで `shouldUpdateBuyerSidebarCounts({ viewing_date: '2026-01-01' })` が `true` を返すことを確認
  - 観察: 未修正コードで `shouldUpdateBuyerSidebarCounts({ notification_sender: '送信者' })` が `true` を返すことを確認
  - 観察: 未修正コードで `determineBuyerCategories({ inquiry_email_phone: '済', ... })` が `inquiryEmailUnanswered` を含まないことを確認
  - プロパティベーステスト: `inquiry_email_phone` を含まない任意の更新データで `shouldUpdateBuyerSidebarCounts()` の動作が変わらないことを検証
  - プロパティベーステスト: `inquiry_email_phone` が `'未'` でない買主データで `determineBuyerCategories()` が `inquiryEmailUnanswered` を返さないことを検証
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが PASS する（これがベースライン動作を確認する）
  - テストを作成し、実行し、未修正コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. inquiry_email_phone リアルタイム更新バグの修正

  - [x] 3.1 BuyerService.ts の sidebarFields に inquiry_email_phone を追加
    - `backend/src/services/BuyerService.ts` の `shouldUpdateBuyerSidebarCounts()` を修正
    - `sidebarFields` 配列に `'inquiry_email_phone'` を追加
    - 変更前: `['next_call_date', 'follow_up_assignee', 'viewing_date', 'notification_sender']`
    - 変更後: `['next_call_date', 'follow_up_assignee', 'viewing_date', 'notification_sender', 'inquiry_email_phone']`
    - _Bug_Condition: 'inquiry_email_phone' IN keys(updateData) かつ sidebarCountUpdateTriggered(updateData) が false_
    - _Expected_Behavior: shouldUpdateBuyerSidebarCounts(updateData) が true を返す（inquiry_email_phone を含む場合）_
    - _Preservation: next_call_date, follow_up_assignee, viewing_date, notification_sender を含む更新は従来通り true を返す_
    - _Requirements: 2.1, 3.1_

  - [x] 3.2 SidebarCountsUpdateService.ts の determineBuyerCategories に inquiryEmailUnanswered 判定を追加
    - `backend/src/services/SidebarCountsUpdateService.ts` の `determineBuyerCategories()` を修正
    - 既存の `viewingDayBefore`、`todayCall`、`assigned` カテゴリ判定の後に `inquiryEmailUnanswered` 判定を追加
    - 判定条件（OR）:
      - `buyer.inquiry_email_phone === '未'`
      - `buyer.inquiry_email_reply === '未'`
      - `!buyer.latest_viewing_date && buyer.inquiry_email_phone === '不要' && (buyer.inquiry_email_reply === '未' || !buyer.inquiry_email_reply)`
    - 条件を満たす場合 `categories.push({ category: 'inquiryEmailUnanswered', assignee: null })` を追加
    - _Bug_Condition: buyer.inquiry_email_phone === '未' かつ determineBuyerCategories が inquiryEmailUnanswered を返さない_
    - _Expected_Behavior: isBugCondition(buyer) が true の場合、categories に inquiryEmailUnanswered が含まれる_
    - _Preservation: inquiry_email_phone が '未' でない買主は inquiryEmailUnanswered に含まれない_
    - _Requirements: 2.2, 3.2_

  - [x] 3.3 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - inquiry_email_phone 更新でサイドバーカウント更新がトリガーされる
    - **重要**: タスク1で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS すれば、期待動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 保持テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 既存フィールドの監視動作と他カテゴリ判定が維持される
    - **重要**: タスク2で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク2の保持プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。

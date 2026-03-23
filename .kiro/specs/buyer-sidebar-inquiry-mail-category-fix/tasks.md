# Implementation Plan

- [x] 1. バグ条件探索テストの作成と実行
  - **Property 1: Bug Condition** - 問合メール未対応の分類漏れバグ
  - **CRITICAL**: このテストは修正前のコードで FAIL することが期待される — FAIL がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示す反例を発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `backend/src/services/BuyerStatusCalculator.ts` の `calculateBuyerStatus`
  - バグ条件（isBugCondition）:
    - ケース1: `inquiry_email_phone = "未"`, `inquiry_email_reply = null`（空欄）
    - ケース2: `inquiry_email_phone = null`（空欄）, `inquiry_email_reply = "未"`
    - ケース3: `latest_viewing_date = null`, `inquiry_email_phone = "不要"`, `inquiry_email_reply = "未"`
    - ケース4: `latest_viewing_date = null`, `inquiry_email_phone = "不要"`, `inquiry_email_reply = null`（空欄）
  - 期待動作（expectedBehavior）: `result.status === '問合メール未対応'` かつ `result.priority === 7`
  - 修正前コードで実行 → **EXPECTED OUTCOME: FAIL**（バグの存在を確認）
  - 反例を記録する（例: `calculateBuyerStatus({ inquiry_email_phone: '未', inquiry_email_reply: null })` が `'問合メール未対応'` を返さない）
  - テストを書いて実行し、FAIL を確認したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保持確認プロパティテストの作成と実行（修正前に実施）
  - **Property 2: Preservation** - バグ条件を満たさない買主の動作保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 修正前コードで非バグ条件の入力を実行し、実際の出力を観察・記録する
  - 観察対象（isBugCondition が false のケース）:
    - `inquiry_email_phone = "不通"` → 「問合メール未対応」に分類されないことを確認
    - `inquiry_email_phone = null`, `inquiry_email_reply = null` → 「問合メール未対応」に分類されないことを確認
    - Priority 1〜6 の条件を満たす買主 → それぞれの優先度の高いカテゴリーに分類されることを確認
    - Priority 8 以降の条件のみを満たす買主 → 正しいカテゴリーに分類されることを確認
  - 観察した動作をプロパティベーステストとして記述する
  - 修正前コードで実行 → **EXPECTED OUTCOME: PASS**（ベースライン動作を確認）
  - テストを書いて実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Priority 7「問合メール未対応」判定条件の修正

  - [x] 3.1 BuyerStatusCalculator.ts の Priority 7 条件を修正する
    - `backend/src/services/BuyerStatusCalculator.ts` の Priority 7 ブロックを修正
    - `and(equals(buyer.inquiry_email_phone, '未'), equals(buyer.inquiry_email_reply, '未'))` を以下に変更:
      ```typescript
      or(
        equals(buyer.inquiry_email_phone, '未'),
        equals(buyer.inquiry_email_reply, '未'),
        and(
          isBlank(buyer.latest_viewing_date),
          equals(buyer.inquiry_email_phone, '不要'),
          or(
            equals(buyer.inquiry_email_reply, '未'),
            isBlank(buyer.inquiry_email_reply)
          )
        )
      )
      ```
    - `status`, `priority`, `matchedCondition`, `color` の返却値は変更しない
    - _Bug_Condition: isBugCondition(buyer) — inquiry_email_phone = "未" OR inquiry_email_reply = "未" OR (latest_viewing_date が空欄 AND inquiry_email_phone = "不要" AND inquiry_email_reply が "未" または空欄)_
    - _Expected_Behavior: result.status = '問合メール未対応', result.priority = 7_
    - _Preservation: Priority 1〜6 の優先度順序を維持、"不通" は対象外、両フィールドが空欄の場合は対象外_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 バグ条件探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 問合メール未対応の正しい分類
    - **IMPORTANT**: タスク 1 で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク 1 のテストは期待動作をエンコードしている
    - このテストが PASS することで、修正が正しいことを確認する
    - **EXPECTED OUTCOME: PASS**（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 保持確認テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 非バグ条件の動作保持
    - **IMPORTANT**: タスク 2 で作成した同じテストを再実行する — 新しいテストを書かない
    - **EXPECTED OUTCOME: PASS**（リグレッションがないことを確認）
    - 修正後も全ての保持テストが PASS することを確認する

- [x] 4. チェックポイント — 全テストの PASS を確認する
  - タスク 1 のバグ条件探索テストが PASS していることを確認
  - タスク 2 の保持確認テストが PASS していることを確認
  - 疑問点があればユーザーに確認する

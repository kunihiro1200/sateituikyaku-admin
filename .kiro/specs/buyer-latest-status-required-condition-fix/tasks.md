# Tasks

## Task List

- [x] 1. Exploratory Bug Condition Tests（バグ確認テスト）
  - [x] 1.1 `frontend/frontend/src/__tests__/buyerLatestStatusRequired.bugfix.test.ts` を作成し、未修正コードでバグ条件が発生することを確認するテストを書く
    - broker_inquiry あり → latest_status が必須扱いされないべきなのに必須扱いされることを確認
    - reception_date が 2026-02-08 より前 → 同上
    - inquiry_hearing 空欄・inquiry_email_phone 未済 → 同上
  - [x] 1.2 テストを実行し、未修正コードでテストが失敗（バグ再現）することを確認する

- [x] 2. Fix Implementation（修正実装）
  - [x] 2.1 `frontend/frontend/src/pages/BuyerDetailPage.tsx` に `isLatestStatusRequired` ヘルパーロジックを追加する（Pythonスクリプト経由でUTF-8安全に編集）
  - [x] 2.2 `checkMissingFields` 内の `latest_status` チェックを `isLatestStatusRequired` を使った条件付きチェックに修正する
  - [x] 2.3 `fetchBuyer` 内の `initialMissing` 構築処理の `latest_status` チェックを同様に修正する

- [x] 3. Fix Checking Tests（修正確認テスト）
  - [x] 3.1 1.1 で作成したテストを再実行し、修正後に全テストがパスすることを確認する
  - [x] 3.2 全条件を満たす買主で `latest_status = ""` の場合に必須扱いされることを確認するテストを追加する

- [x] 4. Preservation Checking Tests（保存チェックテスト）
  - [x] 4.1 `frontend/frontend/src/__tests__/buyerLatestStatusRequired.property.test.ts` を作成し、プロパティベーステストを書く
    - Property 1: isBugCondition が true の全入力で latest_status が必須扱いされない
    - Property 2: latest_status 以外の必須フィールド（initial_assignee, inquiry_source, distribution_type 等）のチェック結果が変わらない
  - [x] 4.2 プロパティテストを実行し、全てパスすることを確認する

- [x] 5. Deploy（デプロイ）
  - [x] 5.1 `git add .` → `git commit -m "fix: latest_status 必須チェック条件を正しい条件に修正"` → `git push origin main` でデプロイする

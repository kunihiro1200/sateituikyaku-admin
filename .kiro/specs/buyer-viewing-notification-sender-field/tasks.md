# 実装計画：内覧ページへの「通知送信者」フィールド追加

## 概要

`BuyerViewingResultPage` に `InlineEditableField` を使って「通知送信者」フィールドを追加する。
Supabaseマイグレーションでカラムを冪等に追加し、既存の `handleInlineFieldSave` と `isViewingPreDay` ロジックをそのまま活用する。

## タスク

- [x] 1. Supabaseマイグレーションファイルの作成
  - `backend/supabase/migrations/20260328_add_notification_sender_to_buyers.sql` を新規作成
  - `ALTER TABLE buyers ADD COLUMN IF NOT EXISTS notification_sender TEXT;` を記述
  - Supabaseダッシュボードで実行する（冪等なので既存環境でも安全）
  - _要件: 3.1, 3.2, 3.3_

- [x] 2. `BuyerViewingResultPage.tsx` への「通知送信者」フィールド追加
  - [x] 2.1 内覧情報セクションの `Box` 内に `InlineEditableField` を追加する
    - 内覧日・時間・後続担当・内覧未確定が並ぶ `Box` 内に配置
    - `fieldName="notification_sender"`、`fieldType="text"`、`placeholder="例: 山田"` を設定
    - 既存の `handleInlineFieldSave('notification_sender', newValue)` を `onSave` に渡す
    - `value={buyer.notification_sender || ''}` で保存済み値を表示
    - _要件: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 2.2 プロパティテスト：通知送信者の保存ラウンドトリップ（プロパティ 1）
    - **プロパティ 1: 通知送信者の保存ラウンドトリップ**
    - **検証: 要件 1.3, 1.4, 1.5, 2.1**
    - `fast-check` で任意の文字列（空文字含む）を `notification_sender` として保存し、取得後の値が一致することを確認
    - テストファイル: `frontend/frontend/src/__tests__/notificationSender.property.test.ts`

  - [ ]* 2.3 プロパティテスト：通知送信者入力済みの場合は内覧前日判定が false（プロパティ 2）
    - **プロパティ 2: 通知送信者入力済みの場合は内覧前日判定が false**
    - **検証: 要件 5.1, 5.2, 5.4**
    - `fast-check` で任意の非空文字列を `notification_sender` に持つ買主に対して `isViewingPreDay` が `false` を返すことを確認
    - テストファイル: `frontend/frontend/src/__tests__/notificationSender.property.test.ts`

  - [ ]* 2.4 プロパティテスト：通知送信者空欄かつ内覧前日条件を満たす場合は内覧前日判定が true（プロパティ 3）
    - **プロパティ 3: 通知送信者空欄かつ内覧前日条件を満たす場合は内覧前日判定が true**
    - **検証: 要件 5.3**
    - `fast-check` で `notification_sender` が null または空文字、`broker_inquiry` が「業者問合せ」以外、内覧日が翌日の買主に対して `isViewingPreDay` が `true` を返すことを確認
    - テストファイル: `frontend/frontend/src/__tests__/notificationSender.property.test.ts`

- [x] 3. チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 4. git push でデプロイ
  - `git add .` → `git commit -m "feat: add notification_sender field to BuyerViewingResultPage"` → `git push origin main`
  - Vercel の自動デプロイで `sateituikyaku-admin-frontend` と `baikyaku-property-site3` の両方がデプロイされることを確認
  - _要件: 1.1〜1.6, 2.1, 3.1〜3.3_

## 備考

- `*` が付いたサブタスクはオプション（スキップ可能）
- 変更不要なファイル（`buyer-column-mapping.json`、`BuyerDetailPage.tsx`、`types/index.ts`、`BuyerService.ts`、`BuyerStatusCalculator.ts`）は既に実装済みのため触らない
- GASの `BUYER_COLUMN_MAPPING` には既に `'通知送信者': 'notification_sender'` が定義済みのため更新不要

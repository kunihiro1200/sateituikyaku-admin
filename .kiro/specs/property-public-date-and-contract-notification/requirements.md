# 要件定義書

## はじめに

本スペックは2つの独立した機能改善を1つのスペックとして実装します。

**機能1**: 物件詳細画面（`PropertyListingDetailPage`）の物件概要セクションに「公開日」フィールドを追加し、スプレッドシートのAD列（カラム名：`配信日【公開）`）と同期する。

**機能2**: 売買契約完了セクションで「契約完了したのでネット非公開お願いします。」のメッセージを送信する際、物件担当（`sales_assignee`）が設定されていない場合に、指定のGoogle Chat URLにフォールバック通知を送る。現在の実装では `DEFAULT_WEBHOOK_URL` が既に定義されているが、担当者が見つからない場合のフォールバックが不完全な状態にある。

---

## 用語集

- **Property_Listing_Detail_Page**: 物件詳細画面（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）
- **PropertyListingService**: 物件リストのデータ取得・更新サービス（`backend/src/services/PropertyListingService.ts`）
- **PropertyListingSyncService**: スプレッドシートと物件リストDBの同期サービス（`backend/src/services/PropertyListingSyncService.ts`）
- **property_listings**: Supabaseの物件リストテーブル
- **distribution_date**: DBカラム名。スプレッドシートの「配信日【公開）」（AD列）に対応する
- **sales_assignee**: 物件担当者（営業担当）のイニシャルまたは名前
- **StaffManagementService**: スタッフのGoogle Chat Webhook URLを取得するサービス（`backend/src/services/StaffManagementService.ts`）
- **Fallback_Webhook_URL**: 担当者が未設定または担当者のWebhook URLが取得できない場合に使用するデフォルトのGoogle Chat URL
- **notify-contract-completed**: 売買契約完了通知を送信するAPIエンドポイント（`POST /api/property-listings/:propertyNumber/notify-contract-completed`）

---

## 要件

### 要件1: 物件概要セクションへの「公開日」フィールド追加

**ユーザーストーリー:** 担当者として、物件詳細画面の物件概要セクションで公開日（配信日）を確認・編集したい。そうすることで、スプレッドシートを開かずに物件の公開状況を把握できる。

#### 受け入れ基準

1. THE Property_Listing_Detail_Page SHALL 物件概要セクション内に「公開日」フィールドを表示する
2. WHEN 物件概要セクションが表示モードの場合、THE Property_Listing_Detail_Page SHALL `distribution_date` の値を `YYYY/MM/DD` 形式で表示する（値がない場合は「-」を表示する）
3. WHEN 物件概要セクションが編集モードの場合、THE Property_Listing_Detail_Page SHALL `distribution_date` を日付入力フィールド（`type="date"`）として表示する
4. WHEN ユーザーが公開日を変更して保存した場合、THE PropertyListingService SHALL `distribution_date` をDBの `property_listings` テーブルに保存する
5. WHEN スプレッドシートのAD列（`配信日【公開）`）が更新された場合、THE PropertyListingSyncService SHALL `distribution_date` をDBに同期する（スプシ→DB方向）
6. THE Property_Listing_Detail_Page SHALL 既存の「配信日（公開）」フィールド（基本情報セクション）と重複しないよう、物件概要セクションへの追加は既存フィールドの参照として実装する

### 要件2: 売買契約完了通知のフォールバック送信先

**ユーザーストーリー:** 担当者として、物件担当（`sales_assignee`）が設定されていない物件でも売買契約完了通知をチャットに送信したい。そうすることで、担当者未設定の場合でも通知が確実に届く。

#### 受け入れ基準

1. WHEN `notify-contract-completed` エンドポイントが呼び出され、かつ `sales_assignee` が空または未設定の場合、THE System SHALL フォールバックURL（`https://chat.googleapis.com/v1/spaces/AAAAlknS4P0/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=61OklKGHQpRoIFhiI00wGZPmcRHd4oY_BV47uQGMWbg`）にGoogle Chat通知を送信する
2. WHEN `notify-contract-completed` エンドポイントが呼び出され、かつ `sales_assignee` が設定されているが StaffManagementService がWebhook URLの取得に失敗した場合、THE System SHALL フォールバックURLにGoogle Chat通知を送信する
3. WHEN `notify-contract-completed` エンドポイントが呼び出され、かつ `sales_assignee` が設定されており StaffManagementService がWebhook URLの取得に成功した場合、THE System SHALL 担当者のWebhook URLにGoogle Chat通知を送信する
4. THE System SHALL フォールバックURLへの送信時も、担当者URLへの送信時と同一のメッセージ形式（`契約が完了しましたので、ネット非公開お願いします。{物件番号}　{住所}よろしくお願いいたします`）を使用する
5. IF Google Chat通知の送信に失敗した場合、THEN THE System SHALL エラーをログに記録し、HTTPステータス500とエラーメッセージをレスポンスとして返す

# 要件ドキュメント

## はじめに

買主詳細画面（BuyerDetailPage.tsx）のUI変更と、物件担当者へのチャット送信機能の改善を行います。具体的には「その他」セクションの削除、「配信種別」フィールドの削除、「担当への確認事項」の配置変更、およびチャット送信ボタンの表示改善を実施します。

## 用語集

- **BuyerDetailPage**: 買主詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **BUYER_FIELD_SECTIONS**: 買主詳細画面のセクション・フィールド定義配列
- **confirmation_to_assignee**: 「担当への確認事項」フィールドのDBカラム名
- **distribution_type**: 「配信種別」フィールドのDBカラム名
- **PropertyAssignee**: 物件担当者（紐づく物件の `sales_assignee` フィールド）
- **StaffManagementService**: スタッフ管理スプレッドシートからスタッフ情報（チャットWebhook URL等）を取得するバックエンドサービス
- **ChatWebhook**: スタッフ管理スプレッドシートのF列「Chat webhook」に格納されているGoogle Chat送信先URL
- **ConfirmationToAssignee**: 担当への確認事項コンポーネント（`frontend/frontend/src/components/ConfirmationToAssignee.tsx`）

## 要件

### 要件1: 「その他」セクションの削除

**ユーザーストーリー:** 担当者として、買主詳細画面の「その他」セクションを削除したい。なぜなら、このセクションは不要であり、画面をシンプルにしたいからです。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 「その他」セクション（`title: 'その他'`）を表示しない
2. WHEN 買主詳細画面が表示される場合、THE BuyerDetailPage SHALL `BUYER_FIELD_SECTIONS` から「その他」セクションを除外する

---

### 要件2: 「配信種別」フィールドの削除

**ユーザーストーリー:** 担当者として、「配信種別」フィールドを画面から完全に削除したい。なぜなら、このフィールドは不要になったからです。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 「配信種別」フィールド（`key: 'distribution_type'`）を画面のどこにも表示しない
2. THE BuyerDetailPage SHALL 「問合せ内容」セクションから `distribution_type` フィールドの定義を削除する

---

### 要件3: 「担当への確認事項」の配置変更

**ユーザーストーリー:** 担当者として、「担当への確認事項」を「配信種別」があった位置（「問合せ内容」セクション内）に表示したい。なぜなら、確認事項は問合せ内容と関連が深く、担当者がすぐに確認できる位置に置きたいからです。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 「担当への確認事項」（`confirmation_to_assignee`）を「問合せ内容」セクション内の「配信種別」があった位置に表示する
2. WHEN 紐づく物件に PropertyAssignee（`sales_assignee`）が設定されている場合、THE BuyerDetailPage SHALL 「担当への確認事項」セクションを表示する
3. WHEN 紐づく物件に PropertyAssignee が設定されていない場合、THE BuyerDetailPage SHALL 「担当への確認事項」セクションを表示しない
4. THE BuyerDetailPage SHALL 「担当への確認事項」を `ConfirmationToAssignee` コンポーネントを使用して表示する

---

### 要件4: チャット送信ボタンの表示と動作

**ユーザーストーリー:** 担当者として、「担当への確認事項」に入力がある場合に「〇〇へチャット送信」ボタンを表示したい。なぜなら、物件担当者に確認事項を素早くチャットで通知したいからです。

#### 受け入れ基準

1. WHEN `confirmation_to_assignee` フィールドに1文字以上の入力がある場合、THE ConfirmationToAssignee SHALL 「〇〇へチャット送信」ボタンを表示する（〇〇は PropertyAssignee の名前）
2. WHEN `confirmation_to_assignee` フィールドが空または未入力の場合、THE ConfirmationToAssignee SHALL チャット送信ボタンを表示しない
3. WHEN チャット送信ボタンがクリックされた場合、THE ConfirmationToAssignee SHALL `/api/buyers/:buyer_number/send-confirmation` エンドポイントを呼び出す
4. WHEN チャット送信が成功した場合、THE ConfirmationToAssignee SHALL 成功メッセージを表示する
5. IF チャット送信が失敗した場合、THEN THE ConfirmationToAssignee SHALL エラーメッセージを表示する
6. THE ConfirmationToAssignee SHALL ボタンのラベルを「{PropertyAssignee名}へチャット送信」の形式で表示する

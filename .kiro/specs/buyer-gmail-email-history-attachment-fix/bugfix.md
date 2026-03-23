# Bugfix Requirements Document

## Introduction

買主詳細ページのGmail送信機能に2つのバグがあります。

**バグ1**: Gmail送信後にメール送信履歴が「メール・SMS送信履歴」セクションに表示されない。SMSは正常に表示されるが、メールのみ表示されない。根本原因は `gmail.ts` の `saveEmailHistory` 呼び出しで `buyerId`（UUID形式）をそのまま渡しているが、`email_history.buyer_id` カラムは `buyer_number`（例: "4370"）で保存する必要があるため。

**バグ2**: 買主Gmail送信モーダル（`BuyerEmailCompositionModal`）に添付ファイルのUIが存在しない。売主リストのレインズ登録ページ（`ReinsRegistrationPage.tsx`）では同様の添付機能が実装されているが、買主側には未実装。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主詳細ページからGmail送信ボタンでメールを送信する THEN システムは `email_history` テーブルに `buyer_id` としてUUID形式の値を保存し、`buyer_number` で検索する履歴表示クエリにヒットしないためメール履歴が表示されない

1.2 WHEN `gmail.ts` の `/api/gmail/send` エンドポイントが `saveEmailHistory` を呼び出す THEN システムは `buyerId`（フロントエンドから渡されたUUID）をそのまま `email_history.buyer_id` に保存する（`buyer.buyer_number` を使用しない）

1.3 WHEN 買主Gmail送信モーダル（`BuyerEmailCompositionModal`）を開く THEN システムは添付ファイル選択UIを表示しない

1.4 WHEN 買主Gmail送信ボタン（`BuyerGmailSendButton`）がメールを送信する THEN システムは `multipart/form-data` ではなく JSON形式で `/api/gmail/send` にリクエストを送信し、添付ファイルを含めることができない

1.5 WHEN `/api/gmail/send` エンドポイントがリクエストを受け取る THEN システムは添付ファイルの処理を行わない（`multer` 等のファイル受信処理がない）

### Expected Behavior (Correct)

2.1 WHEN 買主詳細ページからGmail送信ボタンでメールを送信する THEN システムは `email_history.buyer_id` に `buyer.buyer_number`（例: "4370"）を保存し、メール履歴が「メール・SMS送信履歴」セクションに正しく表示される SHALL

2.2 WHEN `gmail.ts` の `/api/gmail/send` エンドポイントが `saveEmailHistory` を呼び出す THEN システムは `buyerService.getById(buyerId)` で取得した `buyer.buyer_number` を `buyerId` の代わりに使用する SHALL

2.3 WHEN 買主Gmail送信モーダル（`BuyerEmailCompositionModal`）を開く THEN システムはファイル選択ボタンと選択済みファイルのChipリスト（削除可能）を表示する SHALL

2.4 WHEN 買主Gmail送信ボタン（`BuyerGmailSendButton`）がメールを送信する THEN システムは添付ファイルがある場合に `multipart/form-data` 形式で `/api/gmail/send` にリクエストを送信する SHALL

2.5 WHEN `/api/gmail/send` エンドポイントがリクエストを受け取る THEN システムは添付ファイルを受信・処理し、Gmail APIを通じてメールに添付して送信する SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN SMS送信を行う THEN システムは引き続き SMS送信履歴を「メール・SMS送信履歴」セクションに正常に表示する SHALL CONTINUE TO

3.2 WHEN 添付ファイルなしでGmail送信を行う THEN システムは引き続き メールを正常に送信し、メール履歴を正しく保存・表示する SHALL CONTINUE TO

3.3 WHEN テンプレート選択・マージ処理を行う THEN システムは引き続き テンプレート選択モーダルと内容マージ処理を正常に動作させる SHALL CONTINUE TO

3.4 WHEN 売主リストのレインズ登録ページから添付ファイル付きメールを送信する THEN システムは引き続き 既存の添付機能を正常に動作させる SHALL CONTINUE TO

3.5 WHEN `buyerService.getById()` で買主情報を取得する THEN システムは引き続き 買主のメールアドレス・名前等の情報を正常に返す SHALL CONTINUE TO

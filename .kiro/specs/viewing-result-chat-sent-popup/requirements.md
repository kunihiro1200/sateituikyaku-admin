# 要件ドキュメント

## はじめに

内覧ページ（`BuyerViewingResultPage`）において、「買付ハズレチャット送信」ボタンを押してChat送信が完了した後に、担当者へ「★最新状況」の更新を促すリマインダーポップアップを表示する機能。

「買付外れました」が選択された状態でChat送信が行われた後、担当者は買主詳細ページに戻って「★最新状況」を「買付外れました」以外の正確な値（例：「他決」「キャンセル」など）に更新する必要がある。このポップアップはその更新を忘れないよう促すためのリマインダーである。

## 用語集

- **ViewingResultPage**: 内覧ページ（`/buyers/:buyer_number/viewing-result`）。内覧予約・管理・Chat送信を行うページ
- **BuyerDetailPage**: 買主詳細ページ（`/buyers/:buyer_number`）
- **OfferFailedChatSentPopup**: 買付ハズレチャット送信完了後に表示されるモーダルダイアログ
- **LatestStatus**: 「★最新状況」フィールド（`latest_status`）。買主の現在の購入状況を示すドロップダウン選択肢
- **handleOfferChatSend**: 内覧ページの「買付ハズレチャット送信」ボタン押下時に実行されるChat送信ハンドラー関数
- **isOfferFailed**: 買付外れ状態かどうかを判定するフラグ（`isOfferFailedFlag`）

## 要件

### 要件1：Chat送信完了後のポップアップ表示

**ユーザーストーリー：** 担当者として、「買付ハズレチャット送信」ボタンを押してChat送信が完了したとき、「★最新状況」の更新を促すポップアップを見たい。そうすることで、買主詳細ページに戻って「★最新状況」を正確な値に更新することを忘れずに行える。

#### 受け入れ基準

1. WHEN 「買付ハズレチャット送信」ボタン（`isOfferFailed()` が `true` の状態での送信ボタン）が押され、Chat送信APIが成功した場合、THE OfferFailedChatSentPopup SHALL モーダルダイアログとして表示される
2. THE OfferFailedChatSentPopup SHALL 「正確な★最新状況を入力してください。注意！！ 『買付外れました』以外です！！」というメッセージを表示する
3. THE OfferFailedChatSentPopup SHALL 「OK」ボタンを1つのみ表示する
4. IF Chat送信APIが失敗した場合、THEN THE OfferFailedChatSentPopup SHALL 表示されない
5. IF 「買付ハズレチャット送信」ではなく通常の「買付チャット送信」（`isOfferFailed()` が `false`）が完了した場合、THEN THE OfferFailedChatSentPopup SHALL 表示されない

### 要件2：ポップアップのナビゲーション動作

**ユーザーストーリー：** 担当者として、ポップアップの「OK」ボタンを押したとき、買主詳細ページに遷移したい。そうすることで、すぐに「★最新状況」を正確な値に更新できる。

#### 受け入れ基準

1. WHEN 「OK」ボタンが押された場合、THE OfferFailedChatSentPopup SHALL 閉じられる
2. WHEN 「OK」ボタンが押された場合、THE ViewingResultPage SHALL 現在の買主番号に対応する買主詳細ページ（`/buyers/:buyer_number`）に遷移する
3. WHILE OfferFailedChatSentPopup が表示されている間、THE ViewingResultPage SHALL ポップアップの背後でインタラクションを受け付けない（モーダル動作）

# 要件ドキュメント

## はじめに

買主詳細ページの「★最新状況」フィールドで"買"を含む選択肢（例：「買（専任 両手）」「買（専任 片手）」「買（一般 両手）」「買（一般 片手）」「買付外れました」）が選択された際に、Chat送信のために内覧ページへの誘導ポップアップを表示する機能。

ポップアップには「Chat送信のため　内覧ページに飛んでください」というメッセージと、「内覧ページ」（推奨・強調）ボタンおよび「ここにとどまる」ボタンを表示する。

## 用語集

- **BuyerDetailPage**: 買主詳細ページ（`/buyers/:buyer_number`）
- **LatestStatus**: 「★最新状況」フィールド（`latest_status`）。買主の現在の購入状況を示すドロップダウン選択肢
- **BuyingStatus**: "買"を含む最新状況の選択肢（例：「買（専任 両手）」「買（専任 片手）」「買（一般 両手）」「買（一般 片手）」「買付外れました」）
- **ViewingResultPage**: 内覧ページ（`/buyers/:buyer_number/viewing-result`）。内覧予約・管理・Chat送信を行うページ
- **ChatNavigationPopup**: 「★最新状況」でBuyingStatusが選択された際に表示されるモーダルダイアログ
- **InlineEditableField**: 買主詳細ページ内でフィールドをインライン編集するコンポーネント

## 要件

### 要件1：BuyingStatus選択時のポップアップ表示

**ユーザーストーリー：** 担当者として、「★最新状況」で"買"を含む選択肢を選んだとき、Chat送信が必要であることを知らせるポップアップを見たい。そうすることで、内覧ページでのChat送信を忘れずに行える。

#### 受け入れ基準

1. WHEN 「★最新状況」フィールドで"買"を含む値（BuyingStatus）が選択され保存が完了した場合、THE ChatNavigationPopup SHALL モーダルダイアログとして表示される
2. THE ChatNavigationPopup SHALL 「Chat送信のため　内覧ページに飛んでください」というメッセージを表示する
3. THE ChatNavigationPopup SHALL 「内覧ページ」ボタンと「ここにとどまる」ボタンの2つのボタンを表示する
4. THE ChatNavigationPopup SHALL 「内覧ページ」ボタンを視覚的に強調表示する（推奨ボタンとして目立つスタイル）
5. IF 「★最新状況」フィールドで"買"を含まない値が選択された場合、THEN THE ChatNavigationPopup SHALL 表示されない

### 要件2：ポップアップのナビゲーション動作

**ユーザーストーリー：** 担当者として、ポップアップの「内覧ページ」ボタンを押したとき、内覧ページに遷移したい。そうすることで、すぐにChat送信の操作ができる。

#### 受け入れ基準

1. WHEN 「内覧ページ」ボタンが押された場合、THE BuyerDetailPage SHALL 現在の買主番号に対応する内覧ページ（`/buyers/:buyer_number/viewing-result`）に遷移する
2. WHEN 「ここにとどまる」ボタンが押された場合、THE ChatNavigationPopup SHALL 閉じられ、BuyerDetailPage SHALL 現在のページにとどまる
3. WHEN ChatNavigationPopup が表示されている間、THE BuyerDetailPage SHALL ポップアップの背後でインタラクションを受け付けない（モーダル動作）

### 要件3：BuyingStatus判定ロジック

**ユーザーストーリー：** システムとして、"買"を含む選択肢を正確に判定したい。そうすることで、誤ったタイミングでポップアップが表示されることを防げる。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 「★最新状況」の選択値に"買"という文字が含まれる場合にBuyingStatusと判定する
2. THE BuyerDetailPage SHALL 「★最新状況」の選択値に"買"という文字が含まれない場合はBuyingStatusと判定しない
3. THE BuyerDetailPage SHALL `LATEST_STATUS_OPTIONS`の現在の選択肢（「買（専任 両手）」「買（専任 片手）」「買（一般 両手）」「買（一般 片手）」「買付外れました」）をBuyingStatusとして正しく判定する

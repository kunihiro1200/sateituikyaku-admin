# 要件定義書

## はじめに

物件リスト詳細画面（`PropertyListingDetailPage`）の `PriceSection` コンポーネントには、売買価格を変更して「CHAT送信」ボタンを押すと Google Chat にメッセージを送信する機能が既存で存在する。

今回の新機能として、送信されるチャットメッセージの内容の**一番上に物件番号を表示**する。これにより、受信者がどの物件に関する情報かを即座に識別できるようになる。

### 既存の動作（参考）

- `PriceSection` の「CHAT送信」ボタン（`handleSendPriceReductionChat`）を押すと、売買価格変更の通知メッセージが Google Chat に送信される
- 現在のメッセージ内容には物件番号が含まれていないか、一番上に表示されていない

### 今回追加する動作

- 送信されるチャットメッセージの先頭行に物件番号を表示する
- 例：`物件番号：AA1234` のような形式で一番上に追加する

---

## 用語集

- **PropertyListingDetailPage**: 物件リスト詳細画面（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）
- **PriceSection**: 売買価格・値下げ履歴を表示・編集するコンポーネント（`frontend/frontend/src/components/PriceSection.tsx`）
- **CHAT送信ボタン**: `PriceSection` 内の売買価格変更通知を Google Chat に送信するボタン
- **物件番号（propertyNumber）**: 各物件を一意に識別する番号（例：AA1234）
- **チャットメッセージ**: Google Chat に送信されるテキストメッセージ
- **ChatMessage_Builder**: チャット送信メッセージを組み立てる処理（`PriceSection` 内の `handleSendPriceReductionChat` またはメッセージ生成ロジック）

---

## 要件

### 要件1：チャットメッセージ先頭への物件番号表示

**ユーザーストーリー：** 担当者として、売買価格変更のチャット通知を受け取った際に、メッセージの一番上に物件番号が表示されてほしい。これにより、受信者がどの物件の情報かをすぐに識別できる。

#### 受け入れ基準

1. WHEN `PriceSection` の「CHAT送信」ボタンが押されて Google Chat への送信が実行される場合、THE `ChatMessage_Builder` SHALL 送信メッセージの先頭行に物件番号を含める

2. THE `ChatMessage_Builder` SHALL 物件番号を `物件番号：{propertyNumber}` の形式でメッセージの一番上の行に配置する

3. WHEN 物件番号が存在する場合、THE `ChatMessage_Builder` SHALL 物件番号行の直後に改行を挿入し、既存のメッセージ内容を続けて配置する

4. IF 物件番号が取得できない場合、THEN THE `ChatMessage_Builder` SHALL 物件番号行を省略し、既存のメッセージ内容のみを送信する

### 要件2：物件番号の取得と受け渡し

**ユーザーストーリー：** 開発者として、`PriceSection` コンポーネントが物件番号を受け取り、メッセージ生成時に利用できる設計にしたい。これにより、コンポーネントの責務が明確になる。

#### 受け入れ基準

1. THE `PriceSection` SHALL `propertyNumber` プロパティ（props）を通じて物件番号を受け取り、チャットメッセージの生成に使用する

2. WHEN `PropertyListingDetailPage` が `PriceSection` をレンダリングする場合、THE `PropertyListingDetailPage` SHALL 現在表示中の物件の `propertyNumber` を `PriceSection` に渡す

3. WHERE `PriceSection` がすでに `propertyNumber` を props として受け取っている場合、THE `PriceSection` SHALL 既存の props をそのままメッセージ生成に活用する

### 要件3：既存機能への影響なし

**ユーザーストーリー：** 担当者として、物件番号表示の追加によって既存のチャット送信機能の動作が変わらないことを確認したい。これにより、安心して新機能をリリースできる。

#### 受け入れ基準

1. WHEN 物件番号がメッセージ先頭に追加された場合、THE `PriceSection` SHALL 既存の売買価格変更内容・値下げ情報などのメッセージ本文をそのまま維持する

2. WHEN `PriceSection` の「CHAT送信」が成功した場合、THE `PriceSection` SHALL 既存の `onChatSendSuccess` コールバックを従来通り呼び出す

3. IF `PriceSection` の「CHAT送信」が失敗した場合、THEN THE `PriceSection` SHALL 既存のエラーハンドリング処理（`onChatSendError` コールバック等）を従来通り実行する

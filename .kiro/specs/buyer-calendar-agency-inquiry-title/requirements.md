# 要件定義書

## はじめに

買主リストの内覧ページ（`BuyerViewingResultPage`）において、「業者問合せ」フィールドの値が `'業者問合せ'` の場合、内覧日のカレンダー送信時にカレンダーイベントのタイトル末尾に「氏名・会社名」（`name` フィールド）の値を追加する。

これにより、業者経由の問い合わせ案件のカレンダーイベントを一目で識別できるようになる。

## 用語集

- **BuyerViewingResultPage**: 買主リストの内覧結果・後続対応ページ。`/buyers/:buyer_number/viewing` に対応するフロントエンドページ
- **broker_inquiry**: 買主テーブルの「業者問合せ」フィールドのDBカラム名。値が `'業者問合せ'` の場合に本機能が適用される
- **name**: 買主テーブルの「氏名・会社名」フィールドのDBカラム名（スプレッドシートG列 `●氏名・会社名`）
- **カレンダータイトル**: Googleカレンダーの新規イベント作成URLに渡す `text` パラメータの値
- **handleCalendarButtonClick**: `BuyerViewingResultPage.tsx` 内でカレンダー送信URLを生成・開く関数
- **業者問合せ条件**: `buyer.broker_inquiry === '業者問合せ'` が成立する状態

---

## 要件

### 要件1：業者問合せ時のカレンダータイトルへの氏名・会社名追加

**ユーザーストーリー：** 担当者として、業者経由の問い合わせ案件の内覧カレンダーを送信する際に、タイトルに氏名・会社名が自動で付与されるようにしたい。そうすることで、カレンダー上で業者案件を一目で識別できる。

#### 受け入れ基準

1. WHEN `buyer.broker_inquiry` が `'業者問合せ'` の場合、THE BuyerViewingResultPage SHALL カレンダー送信時のイベントタイトル末尾に `buyer.name` の値を追加する
2. WHEN `buyer.broker_inquiry` が `'業者問合せ'` かつ `buyer.name` が空文字またはnullの場合、THE BuyerViewingResultPage SHALL カレンダー送信時のイベントタイトルを変更せず、末尾への追加を行わない
3. WHEN `buyer.broker_inquiry` が `'業者問合せ'` 以外の値（null、空文字、その他の値）の場合、THE BuyerViewingResultPage SHALL カレンダー送信時のイベントタイトルを変更しない
4. THE BuyerViewingResultPage SHALL タイトルの追加形式を `{既存タイトル} {buyer.name}` とする（スペース区切りで末尾に追加）
5. WHEN `buyer.broker_inquiry` が `'業者問合せ'` の場合、THE BuyerViewingResultPage SHALL カレンダー送信のその他の動作（送信先メールアドレス、日時、場所等）を変更しない

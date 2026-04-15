# 要件ドキュメント

## はじめに

買主リストの内覧日カレンダー送信時に、Googleカレンダーイベントのメモ（description）の先頭行に買主番号を表示する機能。`buyerNumber` はリクエストボディから取得済みで常に存在するため、条件分岐なしに先頭行へ追加する。

## 用語集

- **BuyerAppointmentRoute**: 内覧予約を処理するルート（`backend/src/routes/buyer-appointments.ts`）
- **defaultDescription**: BuyerAppointmentRoute 内でカレンダーイベントのメモ文字列を生成する変数
- **buyerNumber**: 買主に割り当てられた識別番号（例: 7359）。リクエストボディの `buyerNumber` フィールドとして受け取り、バリデーション済み（`body('buyerNumber').isString()`）
- **CalendarService**: Googleカレンダーイベントの作成・管理を担うサービス（`backend/src/services/CalendarService.supabase.ts`）

## 要件

### 要件 1: カレンダーメモへの買主番号表示

**ユーザーストーリー:** 担当者として、Googleカレンダーの内覧予約イベントのメモで買主番号をすぐに確認したい。そうすることで、内覧時に買主を素早く特定できる。

#### 受け入れ基準

1. WHEN 内覧日カレンダーが送信される場合、THE `BuyerAppointmentRoute` SHALL `defaultDescription` の先頭行に `買主番号: {buyerNumber}` を追加する
2. THE `defaultDescription` SHALL 以下の順序でメモを構成する: 買主番号 → 物件住所 → GoogleMap → お客様名 → 電話番号 → 問合時ヒアリング → 内覧取得者名 → 買主詳細ページURL
3. WHEN 買主番号が先頭に追加される場合、THE `BuyerAppointmentRoute` SHALL 既存の他フィールド（物件住所・GoogleMap URL・お客様名・電話番号・問合時ヒアリング・内覧取得者名・買主詳細ページURL）を変更せずに維持する

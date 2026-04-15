# 要件ドキュメント

## はじめに

売主リストの訪問予約でGoogleカレンダーを送信する際、カレンダーイベントのメモ（description）の先頭に売主番号を表示する機能。売主番号が設定されている場合のみ先頭行に追加し、未設定の場合は既存のメモ構造を維持する。

## 用語集

- **CalendarService**: Googleカレンダーイベントの作成・管理を担うサービス（`backend/src/services/CalendarService.supabase.ts`）
- **formatEventDescription**: CalendarService 内でカレンダーイベントのメモ文字列を生成するプライベートメソッド
- **sellerNumber**: 売主に割り当てられた識別番号（例: AA1234）。`SellerService.getSeller()` が返す `seller.sellerNumber` フィールド
- **AppointmentRoute**: 訪問予約を処理するルート（`backend/src/routes/appointments.ts`）

## 要件

### 要件 1: カレンダーメモへの売主番号表示

**ユーザーストーリー:** 担当者として、Googleカレンダーの訪問予約イベントのメモで売主番号をすぐに確認したい。そうすることで、現地訪問時に売主を素早く特定できる。

#### 受け入れ基準

1. WHEN `sellerNumber` が存在する場合、THE `CalendarService` SHALL メモの先頭行に `売主番号: {sellerNumber}` を表示する
2. WHEN `sellerNumber` が `undefined` または `null` の場合、THE `CalendarService` SHALL 売主番号行を出力せず、既存のメモ構造（売主名・電話・物件住所・備考）をそのまま維持する
3. THE `formatEventDescription` SHALL メモを以下の順序で構成する: 売主番号（存在する場合）→ 売主名 → 電話 → 物件住所 → 備考（存在する場合）
4. WHEN `notes` が存在する場合、THE `CalendarService` SHALL 備考を `\n\n備考: {notes}` としてメモの末尾に追加する

### 要件 2: AppointmentRoute からの売主番号受け渡し

**ユーザーストーリー:** システムとして、訪問予約作成時に売主番号をカレンダーサービスへ正しく渡したい。そうすることで、追加のDBクエリなしに売主番号をメモへ反映できる。

#### 受け入れ基準

1. WHEN 訪問予約が作成される場合、THE `AppointmentRoute` SHALL `seller.sellerNumber` を `CalendarService.createAppointment` の引数として渡す
2. THE `CalendarService.createAppointment` SHALL `sellerNumber` をオプション引数（`sellerNumber?: string`）として受け取る
3. IF `seller.sellerNumber` が未設定の場合、THEN THE `AppointmentRoute` SHALL 既存の予約作成フローに影響を与えずに処理を完了する

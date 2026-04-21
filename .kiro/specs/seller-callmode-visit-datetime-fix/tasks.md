# Implementation Tasks

## Tasks

- [x] 1. 探索的テスト（バグ再現テスト）を作成する
  - [x] 1.1 `combineVisitDateAndTime` のバグ再現テストを作成する（経路B）
    - `visitTime` が空欄の場合に `YYYY-MM-DD` 形式が返ることを確認するテスト
    - 未修正コードで「成功」するが、これがバグの原因であることを記録
    - ファイル: `backend/src/__tests__/seller-visit-datetime-bug-exploration.test.ts`
  - [x] 1.2 フロントエンドの `new Date()` タイムゾーン変換バグ再現テストを作成する（経路A）
    - `"YYYY-MM-DD"` 形式の文字列を `new Date()` でパースすると時間がずれることを確認
    - ファイル: `backend/src/__tests__/seller-visit-datetime-bug-exploration.test.ts`（同ファイルに追記）
  - [x] 1.3 探索的テストを未修正コードで実行し、バグを確認する

- [x] 2. バックエンド修正：`combineVisitDateAndTime` を修正する
  - [x] 2.1 `combineVisitDateAndTime` の `visitTime` 空欄時の処理を修正する
    - `visitTime` が空欄の場合、`YYYY-MM-DD` ではなく `YYYY-MM-DD 00:00:00` を返すよう修正
    - ファイル: `backend/src/services/EnhancedAutoSyncService.ts`
  - [x] 2.2 スプレッドシート同期時の `visit_date` 比較ロジックを確認・修正する
    - `sheetVisitDateTimeForCompare` と `dbVisitDateTime` の比較が正しく機能することを確認
    - 訪問時間なしの場合に既存の時刻を不必要に上書きしないことを確認

- [x] 3. フロントエンド修正：`new Date()` によるタイムゾーン変換を除去する
  - [x] 3.1 初期化処理の `new Date(sellerData.visitDate)` を文字列直接パースに変更する
    - 対象: 行1754-1763 付近の `appointmentDateLocal` 計算処理
    - `"YYYY-MM-DD HH:mm:ss"` または `"YYYY-MM-DDTHH:mm:ss"` 形式を直接パース
    - ファイル: `frontend/frontend/src/pages/CallModePage.tsx`
  - [x] 3.2 キャンセル時処理の `new Date(seller.visitDate)` を文字列直接パースに変更する
    - 対象: 行5217-5222 付近の `cancelDateLocal` 計算処理
    - ファイル: `frontend/frontend/src/pages/CallModePage.tsx`
  - [x] 3.3 編集モード開始時処理の `new Date(seller.visitDate)` を文字列直接パースに変更する
    - 対象: 行5244 付近の `appointmentDateLocal` 計算処理
    - ファイル: `frontend/frontend/src/pages/CallModePage.tsx`
  - [x] 3.4 共通のパース関数を抽出する（オプション）
    - 3箇所で同じロジックを使うため、ヘルパー関数 `parseVisitDateToLocal(visitDate: string): string` を作成
    - タイムゾーン変換なしで `"YYYY-MM-DDTHH:mm"` 形式に変換する

- [x] 4. Fix Checking テストを作成・実行する
  - [x] 4.1 `combineVisitDateAndTime` の修正後テストを作成する（Property 1）
    - `visitTime` が空欄の場合に `"YYYY-MM-DD 00:00:00"` 形式が返ることを確認
    - `visitTime` がある場合に `"YYYY-MM-DD HH:mm:ss"` 形式が返ることを確認
    - ファイル: `backend/src/__tests__/seller-visit-datetime-fix-checking.test.ts`
  - [x] 4.2 フロントエンドのパース処理の修正後テストを作成する（Property 1）
    - `"2026-05-10 14:30:00"` → `"2026-05-10T14:30"` に正しく変換されることを確認
    - `"2026-05-10T14:30:00.000Z"` → タイムゾーン変換なしで正しく変換されることを確認
    - ファイル: `backend/src/__tests__/seller-visit-datetime-fix-checking.test.ts`（同ファイルに追記）
  - [x] 4.3 Fix Checking テストを修正後コードで実行し、全テストが通ることを確認する

- [x] 5. Preservation Checking テストを作成・実行する
  - [x] 5.1 訪問時間あり同期の保持テストを作成する（Property 2）
    - `combineVisitDateAndTime("2026-05-10", "14:30")` が修正前後で同じ結果を返すことを確認
    - ファイル: `backend/src/__tests__/seller-visit-datetime-preservation.test.ts`
  - [x] 5.2 null クリアの保持テストを作成する（Property 2）
    - `visitDate` が空欄の場合に `null` が保存されることを確認
    - ファイル: `backend/src/__tests__/seller-visit-datetime-preservation.test.ts`（同ファイルに追記）
  - [x] 5.3 プロパティベーステストを作成する（Property 2）
    - ランダムな日付・時刻の組み合わせで `combineVisitDateAndTime` が常に `YYYY-MM-DD HH:mm:ss` 形式を返すことを検証
    - ランダムな `visit_date` 文字列に対してパース処理が時間部分を保持することを検証
    - ファイル: `backend/src/__tests__/seller-visit-datetime-preservation.test.ts`（同ファイルに追記）
  - [x] 5.4 Preservation テストを実行し、全テストが通ることを確認する

- [-] 6. 動作確認・統合テスト
  - [ ] 6.1 ローカル環境でフロントエンドを起動し、訪問日時の入力・保存・リロードを手動確認する
    - `2026-05-10T14:30` を入力して保存 → リロード後も `14:30` が表示されることを確認
  - [ ] 6.2 スプレッドシート同期後の訪問日時が正しく保存されることを確認する
    - 訪問時間なしのケースで既存の時刻が保持されることを確認
  - [ ] 6.3 売主 AA14001 で実際のバグが解消されていることを確認する

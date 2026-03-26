# 要件ドキュメント

## はじめに

買主リストにおいて「★最新状況」フィールドが2箇所に存在する：
1. **買主詳細画面**（`BuyerDetailPage.tsx`）の「問合せ内容」セクション
2. **内覧ページ**（`BuyerViewingResultPage.tsx`）

現状、どちらの画面も同じDBカラム（`buyers.latest_status`）を参照しているが、一方で更新しても他方のUIには即座に反映されない。本機能では、どちらの画面で更新しても常に最新値が表示・保存されるよう双方向同期を実現する。

## 用語集

- **BuyerDetailPage**: 買主詳細画面。「問合せ内容」セクションに★最新状況フィールドを持つ
- **BuyerViewingResultPage**: 内覧ページ。★最新状況フィールドを持つ
- **latest_status**: DBカラム名。★最新状況の値を格納する
- **BuyerService**: バックエンドの買主データ管理サービス（`backend/src/services/BuyerService.ts`）
- **buyerApi**: フロントエンドのAPI呼び出しサービス（`frontend/frontend/src/services/api.ts`）
- **スプレッドシート**: Google Sheetsの買主リストスプレッドシート。DBと双方向同期される

## 要件

### 要件1: 問合せ内容セクションからの更新

**ユーザーストーリー:** 担当者として、買主詳細画面の問合せ内容セクションで★最新状況を更新したとき、内覧ページを開いても同じ値が表示されることを期待する。

#### 受け入れ基準

1. WHEN BuyerDetailPageの問合せ内容セクションで★最新状況フィールドに値を入力・保存する、THE BuyerService SHALL その値をDBの`latest_status`カラムに保存する
2. WHEN BuyerDetailPageで★最新状況を保存した後にBuyerViewingResultPageを開く、THE BuyerViewingResultPage SHALL DBから取得した最新の`latest_status`値を表示する
3. WHEN BuyerDetailPageで★最新状況を保存する、THE BuyerService SHALL スプレッドシートの「★最新状況」列にも同じ値を同期する

### 要件2: 内覧ページからの更新

**ユーザーストーリー:** 担当者として、内覧ページで★最新状況を更新したとき、買主詳細画面を開いても同じ値が表示されることを期待する。

#### 受け入れ基準

1. WHEN BuyerViewingResultPageの★最新状況フィールドに値を入力・保存する、THE BuyerService SHALL その値をDBの`latest_status`カラムに保存する
2. WHEN BuyerViewingResultPageで★最新状況を保存した後にBuyerDetailPageを開く、THE BuyerDetailPage SHALL DBから取得した最新の`latest_status`値を表示する
3. WHEN BuyerViewingResultPageで★最新状況を保存する、THE BuyerService SHALL スプレッドシートの「★最新状況」列にも同じ値を同期する

### 要件3: 後から入力された値の優先

**ユーザーストーリー:** 担当者として、どちらの画面で最後に入力した値が最終的な値として保存されることを期待する。

#### 受け入れ基準

1. WHEN BuyerDetailPageで★最新状況に値Aを保存した後、BuyerViewingResultPageで値Bを保存する、THE BuyerService SHALL DBの`latest_status`を値Bで上書き保存する
2. WHEN BuyerViewingResultPageで★最新状況に値Bを保存した後、BuyerDetailPageで値Cを保存する、THE BuyerService SHALL DBの`latest_status`を値Cで上書き保存する
3. THE BuyerService SHALL 保存時刻が新しい値を常に最終値として扱う（後勝ちルール）

### 要件4: スプレッドシートへの最新値保存

**ユーザーストーリー:** 担当者として、どちらの画面で更新しても、スプレッドシートには常に最後に入力された値が保存されることを期待する。

#### 受け入れ基準

1. WHEN いずれかの画面で★最新状況を保存する、THE BuyerService SHALL `sync=true`オプションを使用してDBとスプレッドシートを同時に更新する
2. WHEN スプレッドシート同期が失敗する、THE BuyerService SHALL DBへの保存は成功として扱い、同期失敗をpendingキューに追加する
3. THE BuyerService SHALL スプレッドシートの「★最新状況\n」列（`buyer-column-mapping.json`のマッピングに従う）に最新値を書き込む

### 要件5: 同一ページ内でのUI整合性

**ユーザーストーリー:** 担当者として、★最新状況を更新した後、同じページ内でも更新後の値が即座に反映されることを期待する。

#### 受け入れ基準

1. WHEN BuyerDetailPageで★最新状況を保存する、THE BuyerDetailPage SHALL 保存成功後にbuyerステートを更新し、ページヘッダーのChipラベルにも最新値を反映する
2. WHEN BuyerViewingResultPageで★最新状況を保存する、THE BuyerViewingResultPage SHALL 保存成功後にbuyerステートを更新し、同ページ内の表示に最新値を反映する
3. IF 保存に失敗する、THEN THE BuyerDetailPage SHALL エラーメッセージをSnackbarで表示し、フィールドの値を保存前の値に戻す
4. IF 保存に失敗する、THEN THE BuyerViewingResultPage SHALL エラーメッセージをSnackbarで表示し、フィールドの値を保存前の値に戻す

# 要件ドキュメント

## はじめに

買主リストの新規作成時における買主番号の生成方法を変更する機能です。
現在はDBの `buyers` テーブルの最大値+1で採番していますが、Googleスプレッドシートの特定セル（`連番` シートの B2）を参照して採番するように変更します。

これにより、スプレッドシート側で管理している連番と買主番号の整合性を保つことができます。

## 用語集

- **BuyerService**: 買主データのCRUD操作を担うバックエンドサービス（`backend/src/services/BuyerService.ts`）
- **GoogleSheetsClient**: Google Sheets API との通信を担うクライアント（`backend/src/services/GoogleSheetsClient.ts`）
- **採番スプレッドシート**: 買主番号の連番を管理するGoogleスプレッドシート（ID: `19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs`）
- **連番シート**: 採番スプレッドシート内のシート名（`連番`）
- **参照セル**: 連番シートの B2 セル（現在の最終採番値が格納されている）
- **次の買主番号**: 参照セルの値 + 1 として算出される番号
- **next-buyer-number エンドポイント**: `GET /api/buyers/next-buyer-number`（フロントエンドが採番プレビュー表示に使用）

## 要件

### 要件1: スプレッドシートからの買主番号採番

**ユーザーストーリー:** 担当者として、スプレッドシートで管理している連番と一致した買主番号を自動採番したい。そうすることで、DBとスプレッドシートの番号体系を統一できる。

#### 受け入れ基準

1. WHEN 新規買主の作成リクエストが発生したとき、THE BuyerService SHALL 採番スプレッドシートの `連番` シート B2 セルの値を取得する
2. WHEN B2 セルの値が正常に取得できたとき、THE BuyerService SHALL その値に 1 を加算した値を次の買主番号として使用する
3. WHEN `GET /api/buyers/next-buyer-number` エンドポイントが呼び出されたとき、THE BuyerService SHALL 採番スプレッドシートの B2 セルの値 + 1 を返す
4. THE BuyerService SHALL 採番スプレッドシートへのアクセスに既存の GoogleSheetsClient を使用する

### 要件2: スプレッドシートアクセス失敗時のエラーハンドリング

**ユーザーストーリー:** 担当者として、スプレッドシートへのアクセスが失敗した場合でも、適切なエラーメッセージを受け取りたい。そうすることで、問題の原因を把握して対処できる。

#### 受け入れ基準

1. IF 採番スプレッドシートへのアクセスが失敗したとき、THEN THE BuyerService SHALL エラーをスローし、買主の作成を中断する
2. IF B2 セルの値が数値として解釈できない場合、THEN THE BuyerService SHALL エラーをスローし、買主の作成を中断する
3. IF B2 セルの値が空欄の場合、THEN THE BuyerService SHALL エラーをスローし、買主の作成を中断する
4. WHEN エラーが発生したとき、THE BuyerService SHALL エラーの内容をログに出力する

### 要件3: 設定の外部化

**ユーザーストーリー:** 開発者として、採番スプレッドシートの設定を環境変数で管理したい。そうすることで、スプレッドシートIDやシート名が変わった場合にコードを変更せずに対応できる。

#### 受け入れ基準

1. THE BuyerService SHALL 採番スプレッドシートIDを環境変数 `BUYER_NUMBER_SPREADSHEET_ID` から取得する
2. THE BuyerService SHALL 採番シート名を環境変数 `BUYER_NUMBER_SHEET_NAME` から取得する（デフォルト値: `連番`）
3. THE BuyerService SHALL 参照セルのアドレスを環境変数 `BUYER_NUMBER_CELL` から取得する（デフォルト値: `B2`）
4. WHERE 環境変数 `BUYER_NUMBER_SPREADSHEET_ID` が未設定の場合、THE BuyerService SHALL 起動時またはアクセス時にエラーをスローする

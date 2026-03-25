# 要件書

## はじめに

売主リスト新規登録画面（NewSellerPage）に、既存の売主・買主情報をコピーして基本情報を自動入力する機能と、売主番号の自動採番機能を追加する。

これにより、既存顧客の情報を再利用した迅速な登録が可能になり、入力ミスの削減と業務効率の向上が期待できる。

---

## 用語集

- **NewSellerPage**: 売主新規登録画面（`frontend/frontend/src/pages/NewSellerPage.tsx`）
- **SellerService**: 売主データを管理するバックエンドサービス（`backend/src/services/SellerService.supabase.ts`）
- **BuyerService**: 買主データを管理するバックエンドサービス（`backend/src/services/BuyerService.ts`）
- **GoogleSheetsClient**: Google Sheets APIクライアント（`backend/src/services/GoogleSheetsClient.ts`）
- **SellerNumberService**: 売主番号の採番を管理するサービス（`backend/src/services/SellerNumberService.ts`）
- **Autocomplete**: 入力に応じて候補を表示するUI部品（MUI Autocomplete）
- **連番シート**: スプレッドシート（ID: `19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs`）のシート名「連番」
- **C2セル**: 連番シートのC2セル。現在の最大売主番号の数値部分を保持する
- **基本情報セクション**: NewSellerPageの「基本情報」Paperコンポーネント内のフィールド群

---

## 要件

### 要件1：売主コピーフィールド

**ユーザーストーリー：** 担当者として、既存の売主番号を入力して選択することで、基本情報を自動入力したい。そうすることで、同一人物の再登録時に入力の手間を省き、ミスを防ぎたい。

#### 受け入れ基準

1. THE NewSellerPage SHALL 基本情報セクションの名前フィールドの上に「売主コピー」オートコンプリートフィールドを表示する
2. WHEN ユーザーが「売主コピー」フィールドに文字を入力する、THE Autocomplete SHALL `GET /api/sellers/search?q={入力値}` を呼び出して既存の売主番号と名前の候補を表示する
3. WHEN ユーザーが候補から売主番号を選択する、THE NewSellerPage SHALL `GET /api/sellers/by-number/{sellerNumber}` を呼び出して売主の詳細情報を取得する
4. WHEN 売主の詳細情報の取得に成功する、THE NewSellerPage SHALL 基本情報セクションの以下のフィールドを取得した売主情報で自動入力する：名前、依頼者住所、電話番号、メールアドレス
5. IF 売主の詳細情報の取得に失敗する、THEN THE NewSellerPage SHALL エラーメッセージを表示し、フィールドの自動入力を行わない
6. THE NewSellerPage SHALL 「売主コピー」フィールドを必須項目としない（任意入力）

### 要件2：買主コピーフィールド

**ユーザーストーリー：** 担当者として、既存の買主番号を入力して選択することで、基本情報を自動入力したい。そうすることで、買主が売主として登録する際の入力の手間を省き、ミスを防ぎたい。

#### 受け入れ基準

1. THE NewSellerPage SHALL 「売主コピー」フィールドの下に「買主コピー」オートコンプリートフィールドを表示する
2. WHEN ユーザーが「買主コピー」フィールドに文字を入力する、THE Autocomplete SHALL `GET /api/buyers/search?q={入力値}&limit=20` を呼び出して既存の買主番号と名前の候補を表示する
3. WHEN ユーザーが候補から買主番号を選択する、THE NewSellerPage SHALL `GET /api/buyers/{buyerNumber}` を呼び出して買主の詳細情報を取得する
4. WHEN 買主の詳細情報の取得に成功する、THE NewSellerPage SHALL 基本情報セクションの以下のフィールドを取得した買主情報で自動入力する：名前、電話番号、メールアドレス
5. IF 買主の詳細情報の取得に失敗する、THEN THE NewSellerPage SHALL エラーメッセージを表示し、フィールドの自動入力を行わない
6. THE NewSellerPage SHALL 「買主コピー」フィールドを必須項目としない（任意入力）

### 要件3：売主番号フィールド

**ユーザーストーリー：** 担当者として、新規登録時に売主番号が自動的に採番されて表示されることを望む。そうすることで、番号の重複や採番ミスを防ぎ、スプレッドシートとの整合性を保ちたい。

#### 受け入れ基準

1. THE NewSellerPage SHALL 「買主コピー」フィールドの下に「売主番号」フィールドを表示する
2. WHEN NewSellerPage が表示される、THE NewSellerPage SHALL `GET /api/sellers/next-seller-number` を呼び出して次の売主番号を取得し、「売主番号」フィールドに表示する
3. THE NewSellerPage SHALL 「売主番号」フィールドを読み取り専用で表示する（ユーザーによる手動編集を不可とする）
4. THE NewSellerPage SHALL 「売主番号」フィールドを必須項目として扱い、値が空の場合は登録ボタンを無効化する

### 要件4：売主番号の自動採番バックエンドAPI

**ユーザーストーリー：** システムとして、Google スプレッドシートの連番シートを参照して次の売主番号を採番し、登録後にシートを更新したい。そうすることで、スプレッドシートとシステムの売主番号が常に同期された状態を保ちたい。

#### 受け入れ基準

1. THE SellerService SHALL `GET /api/sellers/next-seller-number` エンドポイントを提供する
2. WHEN `GET /api/sellers/next-seller-number` が呼び出される、THE SellerService SHALL スプレッドシート（ID: `19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs`）の「連番」シートのC2セルの値を取得する
3. WHEN C2セルの値が取得できる、THE SellerService SHALL 次の売主番号を `AA` + (C2の値 + 1) の形式で返す（例：C2が13584の場合、`AA13585` を返す）
4. WHEN 新規売主の登録（`POST /api/sellers`）が成功する、THE SellerService SHALL 連番シートのC2セルを新しい番号（C2の値 + 1）に更新する
5. IF スプレッドシートへのアクセスに失敗する、THEN THE SellerService SHALL エラーレスポンスを返し、売主番号の採番を行わない
6. THE SellerService SHALL 採番した売主番号を `POST /api/sellers` のリクエストボディで受け取り、DBの `seller_number` カラムに保存する

### 要件5：フィールドの表示順序

**ユーザーストーリー：** 担当者として、コピーフィールドと売主番号フィールドが基本情報セクションの先頭に整理されて表示されることを望む。そうすることで、登録フローが直感的になり、操作ミスを防ぎたい。

#### 受け入れ基準

1. THE NewSellerPage SHALL 基本情報セクション内のフィールドを以下の順序で表示する：
   1. 売主コピー（オートコンプリート）
   2. 買主コピー（オートコンプリート）
   3. 売主番号（読み取り専用テキストフィールド）
   4. 名前（既存）
   5. 依頼者住所（既存）
   6. 電話番号（既存）
   7. メールアドレス（既存）
2. THE NewSellerPage SHALL 「売主コピー」「買主コピー」フィールドのラベルを明確に表示し、それぞれの用途（売主情報のコピー、買主情報のコピー）をユーザーが識別できるようにする

### 要件6：新規売主のスプレッドシート追加

**ユーザーストーリー：** システムとして、新規売主が登録された際に売主リストスプレッドシートの最終行に自動追加したい。そうすることで、スプレッドシートとDBの売主データを常に同期された状態に保ちたい。

#### 受け入れ基準

1. WHEN 新規売主の登録（`POST /api/sellers`）が成功する、THE SellerService SHALL スプレッドシート（ID: `1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I`）の「売主リスト」シートの最終行に新規売主データを追加する
2. THE SellerService SHALL 売主リストシートへの追加時、既存のカラムマッピング（`seller-spreadsheet-column-mapping.md`）に従ってデータを書き込む
3. IF スプレッドシートへの書き込みに失敗する、THEN THE SellerService SHALL エラーをログに記録するが、売主のDB登録は成功として扱う（スプレッドシート追加はベストエフォート）

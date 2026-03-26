# 要件ドキュメント

## はじめに

通話モードページ（CallModePage）に2つの機能を追加する。

1. **サイトURLリンク表示**：サイト（`inquiry_site`）が「ウ」（イエウール）の場合のみ、コメントフィールドの右側にサイトURLをリンク付きで表示する。
2. **査定理由フィールドの常時表示**：サイトの種類に関わらず、コメントと保存ボタンの間に「査定理由（査定サイトから転記）」フィールドを読み取り専用で常時表示する。

## 用語集

- **CallModePage**: 売主管理システムの通話モードページ（`frontend/frontend/src/pages/CallModePage.tsx`）
- **SellerService**: 売主データを管理するバックエンドサービス（`backend/src/services/SellerService.supabase.ts`）
- **inquiry_site**: スプレッドシートの「サイト」列に対応するDBカラム。売主の問い合わせサイトを示す（例：「ウ」＝イエウール）
- **site_url**: スプレッドシートのAP列「サイトURL」に対応するDBカラム（既存）
- **valuation_reason**: スプレッドシートのAO列「査定理由（査定サイトから転記）」に対応するDBカラム（既存）
- **Seller型**: フロントエンドの売主データ型（`frontend/frontend/src/types/index.ts`）

## 要件

### 要件1：サイトURLリンク表示（イエウール限定）

**ユーザーストーリー：** 担当者として、サイトが「ウ」（イエウール）の売主の通話モードページを開いたとき、コメント欄の右側にサイトURLをリンクとして確認したい。そうすることで、イエウールの管理画面に素早くアクセスできる。

#### 受け入れ基準

1. WHEN 売主の `inquiry_site` が「ウ」である THEN THE CallModePage SHALL コメントフィールドの右側にサイトURLをリンク付きで表示する
2. WHEN 売主の `inquiry_site` が「ウ」以外である THEN THE CallModePage SHALL サイトURLリンクを表示しない
3. WHEN サイトURLリンクをクリックする THEN THE CallModePage SHALL 新しいタブでURLを開く
4. WHEN `site_url` フィールドが空である AND `inquiry_site` が「ウ」である THEN THE CallModePage SHALL サイトURLリンクを表示しない
5. THE SellerService SHALL `site_url` フィールドをAPIレスポンスに含める（既存の `siteUrl` フィールドとして）

### 要件2：査定理由フィールドの常時表示

**ユーザーストーリー：** 担当者として、通話モードページのコメント欄と保存ボタンの間に「査定理由（査定サイトから転記）」フィールドを常に確認したい。そうすることで、スプレッドシートから転記された査定理由を通話中に参照できる。

#### 受け入れ基準

1. THE CallModePage SHALL コメントフィールドと保存ボタンの間に「査定理由（査定サイトから転記）」フィールドを表示する
2. WHILE `valuation_reason` が空である THEN THE CallModePage SHALL 「査定理由（査定サイトから転記）」フィールドを空または「未入力」として表示する
3. THE CallModePage SHALL 「査定理由（査定サイトから転記）」フィールドを読み取り専用で表示する（編集不可）
4. THE CallModePage SHALL サイトの種類に関わらず「査定理由（査定サイトから転記）」フィールドを常時表示する
5. THE SellerService SHALL `valuation_reason` フィールドをAPIレスポンスに含める（既存の `valuationReason` フィールドとして）

### 要件3：同期方向の制約

**ユーザーストーリー：** システム管理者として、査定理由フィールドはスプレッドシートからDBへの片方向同期のみとしたい。そうすることで、DBからの誤った上書きを防止できる。

#### 受け入れ基準

1. THE System SHALL `valuation_reason` をスプレッドシート→DB方向のみ同期する（GASの `syncSellerList` による定期同期）
2. THE CallModePage SHALL `valuation_reason` フィールドへの編集UIを提供しない
3. IF ユーザーが `valuation_reason` を変更しようとする THEN THE System SHALL その操作を受け付けない

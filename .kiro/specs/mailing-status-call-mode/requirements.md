# 要件定義書

## はじめに

売主リストの通話モードページ（CallModePage）の「査定計算」セクションに「郵送」フィールドを追加する機能。査定方法（valuation_method）が「郵送」に設定された場合に、郵送ステータス（「未」/「済」）を管理するフィールドを表示する。また、サイドバーの「査定書郵送_未」カテゴリー（mailingPending）との連携、およびスプレッドシートBY列との双方向同期を実現する。

---

## 用語集

- **CallModePage**: 売主リストの通話モードページ（`/sellers/:id/call`）
- **査定計算セクション**: CallModePageの査定額・査定方法を管理するセクション
- **valuation_method**: 査定方法フィールド（DBカラム名）。「郵送」「机上」「訪問」などの値を持つ
- **mailing_status**: 郵送ステータスフィールド（DBカラム名）。「未」または「済」の値を持つ
- **mailingStatus**: フロントエンドのcamelCase表記（`mailing_status`に対応）
- **mailingPending**: サイドバーのカテゴリー名。`mailingStatus === '未'` の売主を集計する
- **BY列**: スプレッドシートの「郵送」カラム（`mailing_status`に対応）
- **SyncQueue**: DB→スプレッドシートの即時同期キュー
- **GAS syncSellerList**: スプレッドシート→DBの定期同期（10分ごと）

---

## 要件

### 要件1: 郵送フィールドの表示条件

**ユーザーストーリー:** 担当者として、査定方法が「郵送」の場合に郵送ステータスを管理したい。そうすることで、査定書の郵送状況を通話モードページで確認・更新できる。

#### 受け入れ基準

1. WHEN 査定方法（valuation_method）が「郵送」に設定されている場合、THE CallModePage SHALL 査定計算セクション内に「郵送」フィールドを表示する
2. WHEN 査定方法（valuation_method）が「郵送」以外の値（「机上」「訪問」等）または空欄の場合、THE CallModePage SHALL 「郵送」フィールドを非表示にする
3. WHEN 査定方法が「郵送」に変更された場合、THE CallModePage SHALL 「郵送」フィールドを即座に表示する
4. WHEN 査定方法が「郵送」から他の値に変更された場合、THE CallModePage SHALL 「郵送」フィールドを即座に非表示にする

---

### 要件2: 郵送フィールドのUI

**ユーザーストーリー:** 担当者として、郵送ステータスを「未」または「済」のボタン形式で選択したい。そうすることで、直感的に郵送状況を更新できる。

#### 受け入れ基準

1. THE CallModePage SHALL 「郵送」フィールドに「未」と「済」の2つのボタンを表示する
2. WHEN 郵送ステータス（mailing_status）が「未」の場合、THE CallModePage SHALL 「未」ボタンを塗りつぶし（選択状態）で表示する
3. WHEN 郵送ステータス（mailing_status）が「済」の場合、THE CallModePage SHALL 「済」ボタンを塗りつぶし（選択状態）で表示する
4. WHEN 査定方法が「郵送」に変更された直後（mailing_statusが未設定の場合）、THE CallModePage SHALL デフォルトで「未」を選択状態にする
5. WHEN ユーザーが「未」または「済」ボタンをクリックした場合、THE CallModePage SHALL mailing_statusをDBに保存する
6. THE CallModePage SHALL 査定方法が「郵送」になった日時（valuation_method更新日時）を「郵送」フィールドの近傍に表示する

---

### 要件3: サイドバーカテゴリー連携

**ユーザーストーリー:** 担当者として、郵送ステータスが「未」の売主をサイドバーで確認したい。そうすることで、査定書郵送が未完了の売主を素早く把握できる。

#### 受け入れ基準

1. WHEN mailing_statusが「未」の場合、THE SellerStatusSidebar SHALL 当該売主を「査定書郵送_未」カテゴリー（mailingPending）にカウントする
2. WHEN mailing_statusが「済」または空欄の場合、THE SellerStatusSidebar SHALL 当該売主をmailingPendingカテゴリーにカウントしない
3. THE SellerStatusSidebar SHALL 既存の`isMailingPending`フィルター関数（`mailingStatus === '未'`の判定）を使用してmailingPendingカテゴリーを表示する
4. WHEN ユーザーがCallModePageで郵送ステータスを「未」から「済」に変更した場合、THE SellerStatusSidebar SHALL 次回のサイドバーデータ更新時にmailingPendingカウントを減算する

---

### 要件4: スプレッドシート双方向同期

**ユーザーストーリー:** 担当者として、郵送ステータスをDBとスプレッドシートで同期したい。そうすることで、スプレッドシートとシステムのデータ整合性を保てる。

#### 受け入れ基準

1. WHEN CallModePageでmailing_statusが更新された場合、THE SyncQueue SHALL mailing_statusをスプレッドシートのBY列「郵送」カラムに即時同期する
2. WHEN GASのsyncSellerListが実行された場合、THE EnhancedAutoSyncService SHALL スプレッドシートのBY列「郵送」カラムの値をDBのmailing_statusカラムに同期する
3. THE ColumnMapper SHALL スプレッドシートの「郵送」カラムとDBの`mailing_status`カラムのマッピングを`column-mapping.json`に定義する
4. IF スプレッドシートのBY列「郵送」カラムが空欄の場合、THEN THE EnhancedAutoSyncService SHALL DBのmailing_statusを変更しない（空欄は同期対象外とする）
5. THE SpreadsheetSyncService SHALL `ColumnMapper.mapToSheet()`を通じてmailing_statusをスプレッドシートに書き込む

---

### 要件5: データ整合性

**ユーザーストーリー:** 担当者として、郵送ステータスのデータが常に正確であることを保証したい。そうすることで、誤った情報に基づいた業務判断を防げる。

#### 受け入れ基準

1. THE CallModePage SHALL mailing_statusの値として「未」または「済」のみを受け付ける
2. WHEN mailing_statusが保存される場合、THE SellerService SHALL `updateSeller()`メソッドを通じてDBの`mailing_status`カラムを更新する
3. THE SellerService SHALL `decryptSeller()`メソッドのレスポンスに`mailingStatus`フィールドを含める（既存実装済み）
4. FOR ALL 売主データ、THE SellerService SHALL `mailingStatus`フィールドをAPIレスポンスに含めて返す

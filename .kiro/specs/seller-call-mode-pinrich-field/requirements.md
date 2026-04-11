# 要件ドキュメント

## はじめに

売主リストの通話モードページ（`/sellers/:id/call`）のステータスセクションに「Pinrich」フィールドを追加する機能です。除外日フィールドの右側に配置し、スプレッドシートのAH列（カラム名「Pinrich」）と同期します。

## 用語集

- **CallModePage**: 売主リストの通話モードページ（`/sellers/:id/call`）
- **ステータスセクション**: CallModePageの状況・次電日・確度・除外日などを表示・編集するセクション
- **Pinrich**: 不動産会社向けのメール配信サービス。売主のPinrich登録状況を管理するフィールド
- **pinrich_status**: データベースカラム名（`sellers`テーブル）
- **AH列**: スプレッドシート「売主リスト」のAH列（カラム名「Pinrich」）
- **SellerService**: バックエンドの売主データ管理サービス（`backend/src/services/SellerService.supabase.ts`）
- **decryptSeller**: SellerServiceの売主データ復号・整形メソッド

---

## 要件

### 要件1: ステータスセクションへのPinrichフィールド表示

**ユーザーストーリー:** 担当者として、通話モードページのステータスセクションでPinrichの登録状況を確認したい。そうすることで、電話対応中にPinrich状況を素早く把握できる。

#### 受け入れ基準

1. THE CallModePage SHALL ステータスセクションの除外日フィールドの右側にPinrichフィールドを表示する
2. WHEN seller.pinrichStatus に値が存在する場合、THE CallModePage SHALL その値をPinrichフィールドに表示する
3. WHEN seller.pinrichStatus が空欄または未設定の場合、THE CallModePage SHALL Pinrichフィールドに「－」を表示する
4. THE CallModePage SHALL Pinrichフィールドを除外日フィールドと同じボックス形式（border付きBox）で表示する

---

### 要件2: Pinrichフィールドの編集・保存

**ユーザーストーリー:** 担当者として、通話モードページでPinrichの値を直接編集・保存したい。そうすることで、電話対応中にPinrich状況を更新できる。

#### 受け入れ基準

1. THE CallModePage SHALL Pinrichフィールドを編集可能なテキスト入力として提供する
2. WHEN ユーザーがPinrichフィールドの値を変更した場合、THE CallModePage SHALL ステータス変更フラグ（statusChanged）をtrueに設定する
3. WHEN ユーザーが「ステータスを更新」ボタンをクリックした場合、THE CallModePage SHALL 変更されたPinrich値をバックエンドAPIに送信する
4. WHEN バックエンドAPIへの保存が成功した場合、THE CallModePage SHALL 保存成功メッセージを表示する
5. IF バックエンドAPIへの保存が失敗した場合、THEN THE CallModePage SHALL エラーメッセージを表示する

---

### 要件3: バックエンドAPIでのPinrich値の受け取りと保存

**ユーザーストーリー:** システムとして、フロントエンドから送信されたPinrich値をデータベースに保存したい。そうすることで、データの永続化と整合性が保たれる。

#### 受け入れ基準

1. WHEN フロントエンドから pinrichStatus フィールドを含む更新リクエストが送信された場合、THE SellerService SHALL pinrich_status カラムを更新する
2. THE SellerService の decryptSeller メソッド SHALL pinrichStatus フィールドをAPIレスポンスに含める
3. WHEN 売主データが取得された場合、THE SellerService SHALL seller.pinrich_status の値を pinrichStatus としてレスポンスに含める

---

### 要件4: スプレッドシートとの同期

**ユーザーストーリー:** システムとして、データベースのpinrich_statusとスプレッドシートのAH列（Pinrich）を双方向に同期したい。そうすることで、スプレッドシートとシステムのデータ整合性が保たれる。

#### 受け入れ基準

1. WHEN スプレッドシートのAH列（Pinrich）が更新された場合、THE EnhancedAutoSyncService SHALL pinrich_status カラムをデータベースに同期する
2. WHEN データベースの pinrich_status が更新された場合、THE SpreadsheetSyncService SHALL スプレッドシートのAH列（Pinrich）に値を書き込む
3. THE column-mapping.json SHALL "Pinrich" → "pinrich_status"（spreadsheetToDatabase）のマッピングを含む
4. THE column-mapping.json SHALL "pinrich_status" → "Pinrich"（databaseToSpreadsheet）のマッピングを含む

---

### 要件5: Pinrich空欄サイドバーカテゴリとの連携

**ユーザーストーリー:** 担当者として、Pinrichが未登録の売主をサイドバーの「Pinrich空欄」カテゴリで確認したい。そうすることで、Pinrich未登録の売主を効率的に管理できる。

#### 受け入れ基準

1. WHEN 売主が当日TEL分の条件を満たし、かつ pinrichStatus が空欄の場合、THE SellerStatusSidebar SHALL その売主を「Pinrich空欄」カテゴリに分類する
2. WHEN 売主の pinrichStatus に値が入力された場合、THE SellerStatusSidebar SHALL その売主を「Pinrich空欄」カテゴリから除外する
3. FOR ALL 売主データに対して、isPinrichEmpty(seller) が true を返す場合、THE SellerStatusSidebar SHALL その売主を「Pinrich空欄」カテゴリに含める（ラウンドトリップ特性）

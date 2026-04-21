# 要件ドキュメント

## はじめに

売主リストの通話ノードページ（`/sellers/:id/call`）において、Pinrichフィールドの状態に基づく2つのサイドバーカテゴリーを実装する機能です。

1. **「Pinrich要変更」カテゴリー**: ステータスの「Pinrich」が「配信中」かつ「営業担当（visitAssignee）」に値が入っており、かつ反響日（`inquiry_date`）が2026/1/1以降の場合に表示
2. **「Pinrich空欄」カテゴリー**: 「Pinrich（pinrich_status）」フィールドが空欄であり、かつ反響日（`inquiry_date`）が2026/1/1以降の場合に表示（既存カテゴリーの拡張・修正）

また、PinrichフィールドとスプレッドシートのスプレッドシートAH列（カラム名「Pinrich」）との相互同期を確実に行います。

### 過去の失敗事例と注意点

過去の実装において、サイドバーカテゴリーから表示が消えずにクリックするとデータなしとなる問題が発生しています。本機能では、条件から外れた売主がサイドバーカテゴリーから**即座に**消えることを必須要件とします。

---

## 用語集

- **CallModePage**: 売主リストの通話モードページ（`/sellers/:id/call`）
- **SellerStatusSidebar**: 売主リストのサイドバーコンポーネント（`frontend/frontend/src/components/SellerStatusSidebar.tsx`）
- **sellerStatusFilters**: サイドバーカテゴリーのフィルタリングロジック（`frontend/frontend/src/utils/sellerStatusFilters.ts`）
- **pinrich_status**: データベースカラム名（`sellers`テーブル）。Pinrichの登録状況を管理するフィールド
- **pinrichStatus**: フロントエンド・APIレスポンスでのフィールド名（camelCase）
- **visitAssignee**: 営業担当（`visit_assignee`カラム）
- **「配信中」**: Pinrichフィールドの値の一つ。Pinrichサービスで配信中であることを示す
- **AH列**: スプレッドシート「売主リスト」のAH列（カラム名「Pinrich」）
- **SellerService**: バックエンドの売主データ管理サービス（`backend/src/services/SellerService.supabase.ts`）
- **EnhancedAutoSyncService**: スプレッドシート→DB同期サービス（`backend/src/services/EnhancedAutoSyncService.ts`）
- **SpreadsheetSyncService**: DB→スプレッドシート同期サービス（`backend/src/services/SpreadsheetSyncService.ts`）
- **StatusCategory**: サイドバーカテゴリーの型定義（`SellerStatusSidebar.tsx`内）
- **inquiry_date**: 反響日（`inquiry_date`カラム）。両カテゴリーの共通フィルター条件として使用

---

## 要件

### 要件1: 「Pinrich要変更」サイドバーカテゴリーの表示

**ユーザーストーリー:** 担当者として、Pinrichが「配信中」かつ営業担当が設定されている売主を「Pinrich要変更」カテゴリーで確認したい。そうすることで、Pinrichの変更が必要な売主を効率的に管理できる。

#### 受け入れ基準

1. WHEN 売主の `pinrichStatus` が「配信中」であり、かつ `visitAssignee` に値が入っており、かつ `inquiryDate` が2026/1/1以降の場合、THE SellerStatusSidebar SHALL その売主を「Pinrich要変更」カテゴリーに表示する

2. WHEN 売主の `pinrichStatus` が「配信中」以外の値（「クローズ」等）に変更された場合、THE SellerStatusSidebar SHALL その売主を「Pinrich要変更」カテゴリーから即座に除外する

3. WHEN 売主の `visitAssignee` が空欄になった場合、THE SellerStatusSidebar SHALL その売主を「Pinrich要変更」カテゴリーから即座に除外する

4. WHEN 売主の `pinrichStatus` が「配信中」であり、かつ `visitAssignee` が空欄の場合、THE SellerStatusSidebar SHALL その売主を「Pinrich要変更」カテゴリーに含めない

5. WHEN 売主の `inquiryDate` が2026/1/1より前の場合、THE SellerStatusSidebar SHALL その売主を「Pinrich要変更」カテゴリーに含めない

6. THE SellerStatusSidebar SHALL 「Pinrich要変更」カテゴリーの件数を正確に表示する

7. WHEN ユーザーが「Pinrich要変更」カテゴリーをクリックした場合、THE SellerStatusSidebar SHALL 条件を満たす売主のみを一覧に表示する（データなしとならないこと）

---

### 要件2: 「Pinrich要変更」カテゴリーのリアルタイム更新

**ユーザーストーリー:** 担当者として、通話モードページでPinrichの値を変更した後、サイドバーカテゴリーが即座に更新されることを期待する。そうすることで、変更後に誤ったカテゴリーが表示され続けることを防げる。

#### 受け入れ基準

1. WHEN 通話モードページで `pinrichStatus` を「配信中」から別の値に変更して保存した場合、THE SellerStatusSidebar SHALL 「Pinrich要変更」カテゴリーからその売主を即座に除外する

2. WHEN 通話モードページで `visitAssignee` を空欄に変更して保存した場合、THE SellerStatusSidebar SHALL 「Pinrich要変更」カテゴリーからその売主を即座に除外する

3. WHEN 通話モードページで `pinrichStatus` を「配信中」に変更し、かつ `visitAssignee` に値が入っている状態で保存した場合、THE SellerStatusSidebar SHALL 「Pinrich要変更」カテゴリーにその売主を即座に追加する

4. IF ステータス更新後にサイドバーカテゴリーの再取得が失敗した場合、THEN THE SellerStatusSidebar SHALL エラーを表示し、前回の表示状態を維持する

---

### 要件3: 「Pinrich空欄」サイドバーカテゴリーの表示と即時更新

**ユーザーストーリー:** 担当者として、Pinrichが未登録の売主を「Pinrich空欄」カテゴリーで確認したい。そうすることで、Pinrich未登録の売主を効率的に管理できる。

#### 受け入れ基準

1. WHEN 売主の `pinrichStatus` が空欄であり、かつ `inquiryDate` が2026/1/1以降であり、かつ当日TEL分の条件（追客中 + 次電日が今日以前 + コミュニケーション情報が全て空 + 営担なし）を満たす場合、THE SellerStatusSidebar SHALL その売主を「Pinrich空欄」カテゴリーに表示する

2. WHEN 売主の `pinrichStatus` に何らかの値が入力された場合、THE SellerStatusSidebar SHALL その売主を「Pinrich空欄」カテゴリーから即座に除外する

3. WHEN ユーザーが「Pinrich空欄」カテゴリーをクリックした場合、THE SellerStatusSidebar SHALL 条件を満たす売主のみを一覧に表示する（データなしとならないこと）

4. WHEN 売主の `inquiryDate` が2026/1/1より前の場合、THE SellerStatusSidebar SHALL その売主を「Pinrich空欄」カテゴリーに含めない

5. THE SellerStatusSidebar SHALL 「Pinrich空欄」カテゴリーの件数を正確に表示する

---

### 要件4: サイドバーカテゴリーのフィルタリングロジック

**ユーザーストーリー:** システムとして、「Pinrich要変更」カテゴリーの判定ロジックを正確に実装したい。そうすることで、条件を満たす売主のみが正確に分類される。

#### 受け入れ基準

1. THE sellerStatusFilters SHALL `isPinrichNeedsChange(seller)` 関数を提供し、`seller.pinrichStatus === '配信中'` かつ `seller.visitAssignee` に値があり、かつ `seller.inquiryDate >= '2026-01-01'` の場合に `true` を返す

2. WHEN `isPinrichNeedsChange(seller)` が `true` を返す場合、THE SellerStatusSidebar SHALL その売主を `pinrichNeedsChange` カテゴリーに分類する

3. FOR ALL 売主データに対して、`isPinrichNeedsChange(seller)` が `true` を返す場合、THE SellerStatusSidebar SHALL その売主を「Pinrich要変更」カテゴリーに含める（ラウンドトリップ特性）

4. WHEN `pinrichStatus` が「配信中」であり `visitAssignee` が空欄の場合、THE sellerStatusFilters SHALL `isPinrichNeedsChange(seller)` が `false` を返す

5. WHEN `pinrichStatus` が「配信中」以外であり `visitAssignee` に値がある場合、THE sellerStatusFilters SHALL `isPinrichNeedsChange(seller)` が `false` を返す

---

### 要件5: バックエンドAPIでのカテゴリーカウント取得

**ユーザーストーリー:** システムとして、「Pinrich要変更」カテゴリーのカウントをバックエンドから正確に取得したい。そうすることで、サイドバーに正確な件数が表示される。

#### 受け入れ基準

1. WHEN `getSidebarCounts()` が呼び出された場合、THE SellerService SHALL `pinrichNeedsChange` カテゴリーのカウントをレスポンスに含める

2. THE SellerService SHALL `pinrichNeedsChange` カウントを、`pinrich_status = '配信中'` かつ `visit_assignee` に値があり、かつ `inquiry_date >= '2026-01-01'` の売主の件数として計算する

3. WHEN `getSidebarCounts()` が呼び出された場合、THE SellerService SHALL `pinrichEmpty` カテゴリーのカウントをレスポンスに含める（既存機能の確認）

4. FOR ALL 売主データに対して、バックエンドの `pinrichNeedsChange` カウントとフロントエンドの `isPinrichNeedsChange()` フィルター結果が一致する（モデルベーステスト特性）

---

### 要件6: スプレッドシートとの相互同期

**ユーザーストーリー:** システムとして、データベースの `pinrich_status` とスプレッドシートのAH列（Pinrich）を双方向に同期したい。そうすることで、スプレッドシートとシステムのデータ整合性が保たれる。

#### 受け入れ基準

1. WHEN スプレッドシートのAH列（Pinrich）が更新された場合、THE EnhancedAutoSyncService SHALL `pinrich_status` カラムをデータベースに同期する

2. WHEN データベースの `pinrich_status` が更新された場合、THE SpreadsheetSyncService SHALL スプレッドシートのAH列（Pinrich）に値を書き込む

3. THE column-mapping.json SHALL `"Pinrich"` → `"pinrich_status"`（spreadsheetToDatabase）のマッピングを含む

4. THE column-mapping.json SHALL `"pinrich_status"` → `"Pinrich"`（databaseToSpreadsheet）のマッピングを含む

5. WHEN スプレッドシートのAH列（Pinrich）が「配信中」に更新され、かつ対象売主の `visit_assignee` に値がある場合、THE EnhancedAutoSyncService SHALL 同期後にサイドバーカテゴリーの再計算が行われるよう `pinrich_status` を正しく保存する

6. WHEN スプレッドシートのAH列（Pinrich）が空欄に更新された場合、THE EnhancedAutoSyncService SHALL `pinrich_status` を空欄（NULL または空文字）としてデータベースに保存する

---

### 要件7: サイドバーカテゴリーの即時反映（過去の失敗防止）

**ユーザーストーリー:** 担当者として、Pinrichの値を変更した後にサイドバーカテゴリーが即座に更新されることを保証したい。そうすることで、過去に発生した「カテゴリーから消えずにクリックするとデータなし」という問題を防止できる。

#### 受け入れ基準

1. WHEN 売主の `pinrichStatus` または `visitAssignee` が変更されて保存された場合、THE SellerStatusSidebar SHALL サイドバーカテゴリーのデータを再取得する

2. WHEN サイドバーカテゴリーのデータが再取得された場合、THE SellerStatusSidebar SHALL 最新のデータに基づいてカテゴリー表示を更新する

3. WHEN 「Pinrich要変更」カテゴリーに表示されている売主の `pinrichStatus` が「配信中」以外に変更された場合、THE SellerStatusSidebar SHALL その売主をカテゴリーから除外し、クリック時にデータなしとならないことを保証する

4. WHEN 「Pinrich空欄」カテゴリーに表示されている売主の `pinrichStatus` に値が入力された場合、THE SellerStatusSidebar SHALL その売主をカテゴリーから除外し、クリック時にデータなしとならないことを保証する

5. THE SellerStatusSidebar SHALL サイドバーカテゴリーの表示とフィルタリング結果が常に一致することを保証する（不変条件）

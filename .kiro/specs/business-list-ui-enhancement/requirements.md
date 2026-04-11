# 要件ドキュメント

## はじめに

業務リスト（WorkTaskDetailModal）のUIを複数改善する。フィールドの入力方式変更、編集不可設定、説明書き追加、スプレッドシート同期の根本修正、スタッフ選択のイニシャル動的取得を行う。

## 用語集

- **WorkTaskDetailModal**: 業務依頼の詳細モーダル（`frontend/frontend/src/components/WorkTaskDetailModal.tsx`）
- **WorkTasksPage**: 業務リスト一覧ページ（`frontend/frontend/src/pages/WorkTasksPage.tsx`）
- **GAS**: Google Apps Script（スプレッドシートとSupabaseを同期するスクリプト）
- **is_normal**: employeesテーブルの「通常スタッフ」フラグ（スタッフ管理シートの「通常」列=TRUEに対応）
- **cadastral_map_url**: 字図・地積測量図のURLフィールド
- **cadastral_map_sales_input**: 地積測量図・字図（営業入力）フィールド
- **site_registration_requestor**: サイト登録依頼コメント（テキスト）フィールド
- **site_registration_requester**: サイト登録依頼者（ボタン選択）フィールド
- **email_distribution**: メール配信フィールド
- **floor_plan_revision_count**: 間取図修正回数フィールド

## 要件

### 要件1: 字図、地積測量図URLフィールドのボタン選択化

**ユーザーストーリー:** 担当者として、字図・地積測量図URLの入力状況をボタンで素早く選択したい。URLテキスト入力は不要で、「URL入力済み」か「未」かを選択できれば十分。

#### 受け入れ基準

1. WHEN 種別が「土」の場合、THE WorkTaskDetailModal SHALL 「字図、地積測量図URL*」フィールドをボタン選択（「URL入力済み」「未」の2択）で表示する
2. WHEN ユーザーがボタンを選択した場合、THE WorkTaskDetailModal SHALL 選択値を `cadastral_map_url` フィールドに保存する
3. THE WorkTaskDetailModal SHALL 現在の `cadastral_map_url` の値に応じて対応するボタンをハイライト表示する

---

### 要件2: 地積測量図・字図（営業入力）の編集不可化

**ユーザーストーリー:** 管理者として、「地積測量図・字図（営業入力）」フィールドはスプレッドシートから同期される値であり、UI上での編集を禁止したい。

#### 受け入れ基準

1. THE WorkTaskDetailModal SHALL 「地積測量図・字図（営業入力）」（`cadastral_map_sales_input`）フィールドを読み取り専用で表示する
2. THE WorkTaskDetailModal SHALL 読み取り専用フィールドに対してテキスト入力フォームを表示しない

---

### 要件3: サイト登録依頼コメントの編集不可化

**ユーザーストーリー:** 管理者として、「サイト登録依頼コメント」フィールドは自動生成されるテキストであり、UI上での直接編集を禁止したい。

#### 受け入れ基準

1. THE WorkTaskDetailModal SHALL 「サイト登録依頼コメント」（`site_registration_requestor`）フィールドを読み取り専用で表示する
2. THE WorkTaskDetailModal SHALL 読み取り専用フィールドに対してテキスト入力フォームを表示しない

---

### 要件4: パノラマフィールドのボタン選択化

**ユーザーストーリー:** 担当者として、パノラマの有無をボタンで素早く選択したい。

#### 受け入れ基準

1. THE WorkTaskDetailModal SHALL 「パノラマ」（`panorama`）フィールドをボタン選択（「あり」の1択）で表示する
2. WHEN ユーザーが「あり」ボタンを選択した場合、THE WorkTaskDetailModal SHALL 値を `panorama` フィールドに保存する
3. THE WorkTaskDetailModal SHALL 現在の `panorama` の値が「あり」の場合にボタンをハイライト表示する

---

### 要件5: サイト登録依頼者の同期問題の根本解決

**ユーザーストーリー:** 担当者として、「サイト登録依頼者」ボタン選択のオプションがスタッフ管理シートの「通常=TRUE」のスタッフから動的に取得されるようにしたい。

#### 背景・根本原因

現在の問題：
- `WorkTaskDetailModal` の「サイト登録依頼者」ボタン選択オプションがハードコードされている（`['K', 'Y', 'I', '林', '麻', 'U', 'R', '久', '和', 'H']`）
- `/api/employees/normal-initials` エンドポイントが `is_active=true` でフィルタリングしているが、スタッフ管理シートの「通常」列（`is_normal=true`）でフィルタリングすべき
- `BuyerService.fetchNormalStaffInitials()` は `is_normal=true` を使用しているが、`employees.ts` ルートは `is_active=true` を使用している（不整合）

#### 受け入れ基準

1. THE Backend SHALL `/api/employees/normal-initials` エンドポイントで `is_normal=true` のスタッフのイニシャルを返す
2. THE WorkTaskDetailModal SHALL モーダル起動時に `/api/employees/normal-initials` からスタッフイニシャル一覧を取得する
3. WHEN APIからイニシャル一覧が取得できた場合、THE WorkTaskDetailModal SHALL 「サイト登録依頼者」「営業担当」「媒介作成者」等のスタッフ選択ボタンのオプションとして動的に表示する
4. IF APIからイニシャル一覧が取得できない場合、THEN THE WorkTaskDetailModal SHALL フォールバックとしてデフォルトのオプション配列を使用する

---

### 要件6: 間取図修正回数フィールドへの説明書き追加

**ユーザーストーリー:** 担当者として、間取図修正回数の入力基準を明確にするため、フィールドの下に赤字で説明書きを表示したい。

#### 受け入れ基準

1. THE WorkTaskDetailModal SHALL 「間取図修正回数」（`floor_plan_revision_count`）フィールドの下に赤字テキストを表示する
2. THE WorkTaskDetailModal SHALL 赤字テキストとして「ここでの修正とは、当社のミスによる修正のことです。CWの方のミスによる修正はカウントNGです！！」を表示する

---

### 要件7: メール配信フィールドの内容反映（編集不可）

**ユーザーストーリー:** 担当者として、「確認後処理」セクションの「メール配信」フィールドにスプレッドシートから同期された `email_distribution` の値が正しく表示されるようにしたい。

#### 背景

現在、「確認後処理」セクションの `ReadOnlyDisplayField` で表示される「メール配信」フィールドが空になっている。`email_distribution` フィールドの値を正しく読み取り専用で表示する必要がある。

#### 受け入れ基準

1. THE WorkTaskDetailModal SHALL 「確認後処理」セクションの「メール配信」フィールドに `email_distribution` の値を読み取り専用で表示する
2. THE WorkTaskDetailModal SHALL `email_distribution` の値が空の場合は「-」または空文字を表示する
3. THE WorkTaskDetailModal SHALL このフィールドを編集不可（読み取り専用）で表示する

---

### 要件8: スタッフ選択項目でis_normal=trueのイニシャルを動的表示

**ユーザーストーリー:** 管理者として、業務リストのスタッフ選択ボタン（営業担当、媒介作成者、サイト登録依頼者等）がスタッフ管理シートの「通常=TRUE」のスタッフから動的に生成されるようにしたい。スタッフの追加・削除がシートで管理されるため、コードの変更なしに反映されるべき。

#### 受け入れ基準

1. THE WorkTaskDetailModal SHALL モーダル起動時に `/api/employees/normal-initials` からスタッフイニシャル一覧を取得する
2. WHEN イニシャル一覧が取得できた場合、THE WorkTaskDetailModal SHALL 以下の全スタッフ選択フィールドのボタン選択オプションとして動的に使用する：
   - 「営業担当」（`sales_assignee`）- ASSIGNEE_OPTIONS使用
   - 「媒介作成者」（`mediation_creator`）- ASSIGNEE_OPTIONS使用
   - 「社員が契約書作成」（`employee_contract_creation`）- ASSIGNEE_OPTIONS使用
   - 「サイト登録依頼者」（`site_registration_requester`）- 個別ハードコードから動的取得に変更
   - 「間取図確認者」（`floor_plan_confirmer`）- 個別ハードコードから動的取得に変更
3. IF イニシャル一覧が空またはAPIエラーの場合、THEN THE WorkTaskDetailModal SHALL フォールバックとして既存のハードコードされたオプション配列（`ASSIGNEE_OPTIONS`）を使用する

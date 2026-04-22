# 要件ドキュメント

## はじめに

買主リストの詳細ページにおいて、Pinrich（`pinrich`カラム）が空欄または「登録無し」の場合に、サイドバーカテゴリー「Pinrich未登録」として表示する機能です。

対象は受付日（`reception_date`）が2026/1/1以降の買主のみです。

Pinrichフィールドにそれ以外の値が入った場合は、サイドバーカテゴリーから**即座に**消えることを必須要件とします。

### 過去の失敗事例と注意点

過去の実装において、サイドバーカテゴリーから表示が消えずにクリックするとデータなしとなる問題が発生しています。本機能では、条件から外れた買主がサイドバーカテゴリーから**即座に**消えることを必須要件とします。

---

## 用語集

- **BuyerDetailPage**: 買主リストの詳細ページ（`/buyers/:id`）
- **BuyerStatusSidebar**: 買主リストのサイドバーコンポーネント（`frontend/frontend/src/components/BuyerStatusSidebar.tsx`）
- **BuyerService**: バックエンドの買主データ管理サービス（`backend/src/services/BuyerService.ts`）
- **pinrich**: データベースカラム名（`buyers`テーブル）。Pinrichの登録状況を管理するフィールド
- **「登録無し」**: Pinrichフィールドの値の一つ。Pinrichサービスに登録不要または登録できない状態を示す
- **reception_date**: 受付日（`reception_date`カラム）。カテゴリーの共通フィルター条件として使用
- **CategoryCounts**: サイドバーカテゴリーのカウント型定義（`BuyerStatusSidebar.tsx`内）
- **buyer_sidebar_counts**: サイドバーカウントを保存するDBテーブル
- **getSidebarCounts**: バックエンドAPIのサイドバーカウント取得メソッド
- **getSidebarCountsFallback**: サイドバーカウントの動的計算フォールバックメソッド
- **pinrichUnregistered**: フロントエンド・APIレスポンスでのカテゴリーキー名（camelCase）

---

## 要件

### 要件1: 「Pinrich未登録」サイドバーカテゴリーの表示条件

**ユーザーストーリー:** 担当者として、Pinrichが未登録の買主を「Pinrich未登録」カテゴリーで確認したい。そうすることで、Pinrich登録漏れの買主を効率的に管理できる。

#### 受け入れ基準

1. WHEN 買主の `pinrich` が空欄（NULL または空文字）であり、かつ `reception_date` が2026/1/1以降の場合、THE BuyerStatusSidebar SHALL その買主を「Pinrich未登録」カテゴリーに表示する

2. WHEN 買主の `pinrich` が「登録無し」であり、かつ `reception_date` が2026/1/1以降の場合、THE BuyerStatusSidebar SHALL その買主を「Pinrich未登録」カテゴリーに表示する

3. WHEN 買主の `pinrich` に空欄・「登録無し」以外の値（例: 「送信中」「クローズ」「登録不要（不可）」等）が入っている場合、THE BuyerStatusSidebar SHALL その買主を「Pinrich未登録」カテゴリーに含めない

7. WHEN 買主の `inquiry_source` が「2件目以降」の場合、THE BuyerStatusSidebar SHALL その買主を「Pinrich未登録」カテゴリーに含めない（`pinrich` が空欄であっても）

4. WHEN 買主の `reception_date` が2026/1/1より前の場合、THE BuyerStatusSidebar SHALL その買主を「Pinrich未登録」カテゴリーに含めない

5. THE BuyerStatusSidebar SHALL 「Pinrich未登録」カテゴリーの件数を正確に表示する

6. WHEN ユーザーが「Pinrich未登録」カテゴリーをクリックした場合、THE BuyerStatusSidebar SHALL 条件を満たす買主のみを一覧に表示する（データなしとならないこと）

---

### 要件2: 「Pinrich未登録」カテゴリーからの即時除外（過去の失敗防止）

**ユーザーストーリー:** 担当者として、買主のPinrichフィールドに値を入力して保存した後、「Pinrich未登録」カテゴリーから即座に消えることを期待する。そうすることで、過去に発生した「カテゴリーから消えずにクリックするとデータなし」という問題を防止できる。

#### 受け入れ基準

1. WHEN 買主の `pinrich` フィールドに空欄・「登録無し」以外の値が入力されて保存された場合、THE BuyerStatusSidebar SHALL 「Pinrich未登録」カテゴリーからその買主を即座に除外する

2. WHEN 買主の `pinrich` フィールドが「登録無し」から別の値に変更されて保存された場合、THE BuyerStatusSidebar SHALL 「Pinrich未登録」カテゴリーからその買主を即座に除外する

3. WHEN 「Pinrich未登録」カテゴリーに表示されている買主の `pinrich` に有効な値が入力された場合、THE BuyerStatusSidebar SHALL その買主をカテゴリーから除外し、クリック時にデータなしとならないことを保証する

4. IF サイドバーカテゴリーのデータ再取得が失敗した場合、THEN THE BuyerStatusSidebar SHALL エラーを表示し、前回の表示状態を維持する

---

### 要件3: バックエンドAPIでのカテゴリーカウント取得

**ユーザーストーリー:** システムとして、「Pinrich未登録」カテゴリーのカウントをバックエンドから正確に取得したい。そうすることで、サイドバーに正確な件数が表示される。

#### 受け入れ基準

1. WHEN `getSidebarCounts()` が呼び出された場合、THE BuyerService SHALL `pinrichUnregistered` カテゴリーのカウントをレスポンスに含める

2. THE BuyerService SHALL `pinrichUnregistered` カウントを、`pinrich` が NULL または空文字 または「登録無し」であり、かつ `reception_date >= '2026-01-01'` の買主の件数として計算する

3. WHEN `getSidebarCountsFallback()` が呼び出された場合、THE BuyerService SHALL `pinrichUnregistered` カウントを動的に計算してレスポンスに含める

4. FOR ALL 買主データに対して、バックエンドの `pinrichUnregistered` カウントとフロントエンドのフィルター結果が一致する（モデルベーステスト特性）

---

### 要件4: フロントエンドのフィルタリングロジック

**ユーザーストーリー:** システムとして、「Pinrich未登録」カテゴリーの判定ロジックを正確に実装したい。そうすることで、条件を満たす買主のみが正確に分類される。

#### 受け入れ基準

1. THE BuyerService SHALL `pinrichUnregistered` カテゴリーのフィルタリングにおいて、`pinrich` が NULL・空文字・「登録無し」のいずれかであり、かつ `reception_date >= '2026-01-01'` の場合に対象とする

2. WHEN `pinrich` が「送信中」「クローズ」「登録不要（不可）」等の値の場合、THE BuyerService SHALL その買主を `pinrichUnregistered` カテゴリーに含めない

3. FOR ALL 買主データに対して、`pinrichUnregistered` フィルターが `true` を返す場合、THE BuyerStatusSidebar SHALL その買主を「Pinrich未登録」カテゴリーに含める（ラウンドトリップ特性）

4. WHEN `pinrich` が空欄であり `reception_date` が「2025-12-31」の場合、THE BuyerService SHALL その買主を `pinrichUnregistered` カテゴリーに含めない

---

### 要件5: サイドバーカテゴリーの即時反映（過去の失敗防止）

**ユーザーストーリー:** 担当者として、Pinrichの値を変更した後にサイドバーカテゴリーが即座に更新されることを保証したい。そうすることで、過去に発生した「カテゴリーから消えずにクリックするとデータなし」という問題を防止できる。

#### 受け入れ基準

1. WHEN 買主の `pinrich` フィールドが変更されて保存された場合、THE BuyerService SHALL サイドバーカテゴリーのキャッシュを無効化する

2. WHEN サイドバーカテゴリーのキャッシュが無効化された場合、THE BuyerStatusSidebar SHALL 次回のデータ取得時に最新のカウントを反映する

3. THE BuyerStatusSidebar SHALL 「Pinrich未登録」カテゴリーの表示とフィルタリング結果が常に一致することを保証する（不変条件）

4. WHEN 「Pinrich未登録」カテゴリーに表示されている買主数とクリック後の一覧件数が一致しない場合、THE BuyerStatusSidebar SHALL その状態を発生させない（データなし問題の再発防止）

---

### 要件6: `inquiry_source='2件目以降'` の既存データ修正（バグ修正）

**ユーザーストーリー:** システムとして、`inquiry_source` が「2件目以降」の買主は `pinrich` が「登録不要（不可）」であるべきだが、過去の登録時に保存されていないケースがある。これを修正したい。

#### 背景

`BuyerDetailPage.tsx` の `useEffect` が `inquiry_source === '2件目以降'` のとき `pinrich` を「登録不要（不可）」に**フロントエンドのstateのみ**セットしていた。DBには保存されないため、サイドバーのカウント計算（DBの値を参照）では `pinrich = NULL` として扱われ、「Pinrich未登録」に誤って表示されていた。

#### 受け入れ基準

1. WHEN `inquiry_source` が「2件目以降」であり、かつ `pinrich` が NULL または空文字の買主が存在する場合、THE BuyerService SHALL その買主の `pinrich` を「登録不要（不可）」に一括更新する（データ修正スクリプト）

2. WHEN `BuyerStatusCalculator` が Priority 31 を評価する場合、THE BuyerStatusCalculator SHALL `inquiry_source === '2件目以降'` の買主を「ピンリッチ未登録」に含めない

3. WHEN `getBuyersByStatus('pinrichUnregistered')` が呼び出された場合、THE BuyerService SHALL `inquiry_source === '2件目以降'` の買主を結果に含めない

4. WHEN `getSidebarCountsFallback()` が `pinrichUnregistered` をカウントする場合、THE BuyerService SHALL `inquiry_source === '2件目以降'` の買主をカウントに含めない


# 要件ドキュメント

## はじめに

売主一覧ページ（カテゴリー別表示）に「プレゼンス表示」機能を追加する。
他のユーザーが現在どの売主の詳細ページ（通話モードページ）を開いているかをリアルタイムで一覧に表示し、
重複対応を防ぎ、チームの作業状況を可視化する。

**技術的背景**:
- バックエンドはVercelサーバーレス環境（常駐プロセスなし）
- Supabase Realtimeを使用したリアルタイム同期が最適
- ユーザー識別は既存の認証システム（`Employee`型、`name`フィールド）を使用
- プレゼンス情報はSupabaseの`Presence`機能またはDBテーブルで管理

---

## 用語集

- **Presence_System**: プレゼンス表示機能全体を指すシステム
- **Presence_Record**: 特定ユーザーが特定売主ページを閲覧中であることを示すレコード（`seller_number`、`user_name`、`entered_at`を含む）
- **Seller_List**: 売主一覧ページ（`SellersPage.tsx`）
- **Seller_Detail**: 売主詳細ページ（`SellerDetailPage.tsx`）または通話モードページ（`CallModePage.tsx`）
- **Active_User**: 現在売主詳細ページを開いているユーザー
- **Presence_Badge**: 売主一覧の各行に表示される「〇〇が入っています」という表示
- **Supabase_Realtime**: Supabaseのリアルタイム通信機能（Presence / Broadcast / Postgres Changes）
- **Stale_Record**: ユーザーがページを離脱したにもかかわらず残存するプレゼンスレコード

---

## 要件

### 要件1: プレゼンス情報の登録

**ユーザーストーリー**: 担当者として、売主詳細ページを開いたとき、自分が入室中であることをシステムに登録したい。そうすることで、他のユーザーが一覧から重複対応を避けられる。

#### 受け入れ基準

1. WHEN ユーザーが売主詳細ページ（`SellerDetailPage.tsx`）または通話モードページ（`CallModePage.tsx`）を開いたとき、THE Presence_System SHALL そのユーザーの`Presence_Record`（`seller_number`、`user_name`、`entered_at`）をSupabaseに登録する
2. WHEN ユーザーが売主詳細ページまたは通話モードページを離脱したとき（別ページへ遷移、ブラウザタブを閉じる、ブラウザを閉じる）、THE Presence_System SHALL そのユーザーの`Presence_Record`をSupabaseから削除する
3. THE Presence_System SHALL ユーザー識別に既存の認証システム（`useAuthStore`の`employee.name`）を使用する
4. IF ユーザーが認証されていない場合、THEN THE Presence_System SHALL プレゼンス情報の登録を行わない

### 要件2: プレゼンス情報のリアルタイム受信

**ユーザーストーリー**: 担当者として、売主一覧を見ているとき、他のユーザーがどの売主ページを開いているかをリアルタイムで確認したい。そうすることで、重複対応を防げる。

#### 受け入れ基準

1. WHEN 売主一覧ページ（`SellersPage.tsx`）が表示されているとき、THE Presence_System SHALL Supabase Realtimeを通じて全ユーザーのプレゼンス情報をリアルタイムで受信する
2. WHEN 他のユーザーが売主詳細ページに入室したとき、THE Presence_System SHALL 売主一覧の該当行に`Presence_Badge`を1秒以内に表示する
3. WHEN 他のユーザーが売主詳細ページから退室したとき、THE Presence_System SHALL 売主一覧の該当行の`Presence_Badge`を1秒以内に非表示にする
4. THE Presence_System SHALL 同一売主に複数ユーザーが入室している場合、全ユーザーの名前を`Presence_Badge`に表示する

### 要件3: プレゼンスバッジの表示

**ユーザーストーリー**: 担当者として、売主一覧の各行で誰が入室中かを一目で確認したい。そうすることで、素早く状況を把握できる。

#### 受け入れ基準

1. THE Presence_System SHALL `Presence_Badge`を売主一覧の各行（`seller_number`列の近く）に表示する
2. THE Presence_System SHALL `Presence_Badge`の表示形式を「〇〇が入っています」とする（例: 「林田が入っています」）
3. WHERE 複数ユーザーが同一売主ページを開いている場合、THE Presence_System SHALL 全ユーザー名をカンマ区切りで表示する（例: 「林田、田中が入っています」）
4. THE Presence_System SHALL `Presence_Badge`をMUI `Chip`コンポーネントで表示し、視覚的に目立つ色（`warning`または`info`）を使用する
5. WHILE 売主一覧ページが表示されているとき、THE Presence_System SHALL 自分自身のプレゼンス情報も`Presence_Badge`に表示する（自分が入室中であることも確認できる）

### 要件4: Staleレコードの自動クリーンアップ

**ユーザーストーリー**: 管理者として、ネットワーク切断やブラウザクラッシュなどで残存するStaleレコードが自動的に削除されることを期待する。そうすることで、誤った表示が長時間続かない。

#### 受け入れ基準

1. THE Presence_System SHALL `Presence_Record`に`entered_at`タイムスタンプを含める
2. WHEN `Presence_Record`の`entered_at`から30分以上経過した場合、THE Presence_System SHALL そのレコードをStaleとみなし削除する
3. THE Presence_System SHALL Supabase Realtimeの`Presence`機能を使用することで、接続切断時に自動的にプレゼンス情報を削除する

### 要件5: パフォーマンスと信頼性

**ユーザーストーリー**: 担当者として、プレゼンス機能が既存の売主一覧の表示速度に影響しないことを期待する。

#### 受け入れ基準

1. THE Presence_System SHALL プレゼンス情報の取得・表示を既存の売主データ取得と非同期で行い、売主一覧の初期表示を遅延させない
2. IF Supabase Realtimeへの接続が失敗した場合、THEN THE Presence_System SHALL エラーをコンソールに記録し、売主一覧の通常機能に影響を与えない
3. THE Presence_System SHALL Supabase Realtimeチャンネルを売主一覧ページのアンマウント時に適切にクリーンアップする（メモリリーク防止）
4. WHILE 売主一覧ページが表示されているとき、THE Presence_System SHALL Supabase Realtimeへの接続を維持し、再接続が必要な場合は自動的に再接続する

### 要件6: 通話モードページでのプレゼンス登録

**ユーザーストーリー**: 担当者として、通話モードページを開いたときも自分の入室情報が登録されることを期待する。そうすることで、売主一覧から見た他のユーザーが重複対応を避けられる。

#### 受け入れ基準

1. WHEN ユーザーが通話モードページ（`CallModePage.tsx`）を開いたとき、THE Presence_System SHALL 売主詳細ページと同様に`Presence_Record`を登録する
2. WHEN ユーザーが通話モードページから離脱したとき、THE Presence_System SHALL `Presence_Record`を削除する
3. THE Presence_System SHALL 通話モードページと売主詳細ページの両方で同一の`seller_number`に対してプレゼンスを登録し、売主一覧で統一して表示する

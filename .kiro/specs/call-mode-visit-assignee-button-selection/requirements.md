# 要件定義書: 通話モードページ訪問査定セクション「営担」フィールドのボタン選択式変更

## はじめに

本ドキュメントは、通話モードページ（`/sellers/:id/call`）の訪問査定セクションにある「営担」フィールドを、テキスト入力からボタン選択式に変更する機能の要件を定義します。

## 用語集

- **System**: 通話モードページの訪問査定セクション
- **User**: 通話モードページを使用する営業担当者
- **Normal_Staff**: スタッフ管理シート（`employees`テーブル）で`is_normal = true`のスタッフ
- **Visit_Assignee**: 訪問査定の営業担当者（イニシャル）
- **Initials**: スタッフのイニシャル（例: Y, I, K）
- **API**: バックエンドAPIエンドポイント `/api/employees/normal-initials`

## 要件

### 要件1: 通常スタッフイニシャルの取得

**ユーザーストーリー**: 営業担当者として、通常スタッフのイニシャル一覧を取得したい。なぜなら、営担を選択するためのボタンを表示する必要があるから。

#### 受入基準

1. WHEN System がマウントされる THEN THE System SHALL `/api/employees/normal-initials` エンドポイントにGETリクエストを送信する
2. WHEN API が正常にレスポンスを返す THEN THE System SHALL イニシャル配列を状態に保存する
3. WHEN API リクエストが失敗する THEN THE System SHALL エラーをコンソールに出力し、空配列を状態に設定する
4. THE API SHALL `is_normal = true` かつ `is_active = true` のスタッフのイニシャルのみを返す
5. THE API SHALL イニシャルをスタッフ名順にソートして返す

---

### 要件2: 営担選択UIの表示

**ユーザーストーリー**: 営業担当者として、通常スタッフのイニシャルをボタンで選択したい。なぜなら、テキスト入力よりも素早く正確に営担を設定できるから。

#### 受入基準

1. WHEN 通常スタッフイニシャルが取得される THEN THE System SHALL 各イニシャルに対応するボタンを表示する
2. WHEN ボタンが表示される THEN THE System SHALL 「クリア」ボタンも表示する
3. WHEN 営担が選択されている THEN THE System SHALL 選択されたボタンを `contained` スタイルで表示する
4. WHEN 営担が選択されていない THEN THE System SHALL 「クリア」ボタンを `contained` スタイルで表示する
5. WHEN 営担が選択されていない THEN THE System SHALL 全てのイニシャルボタンを `outlined` スタイルで表示する

---

### 要件3: 営担の選択

**ユーザーストーリー**: 営業担当者として、イニシャルボタンをクリックして営担を選択したい。なぜなら、訪問査定の担当者を設定する必要があるから。

#### 受入基準

1. WHEN User がイニシャルボタンをクリックする THEN THE System SHALL そのイニシャルを営担として設定する
2. WHEN 営担が設定される THEN THE System SHALL 選択されたボタンを `contained` スタイルに変更する
3. WHEN 営担が設定される THEN THE System SHALL 他の全てのボタンを `outlined` スタイルに変更する
4. WHEN 営担が設定される THEN THE System SHALL 「クリア」ボタンを `outlined` スタイルに変更する

---

### 要件4: 営担のクリア

**ユーザーストーリー**: 営業担当者として、「クリア」ボタンをクリックして営担を解除したい。なぜなら、営担を未設定の状態に戻す必要がある場合があるから。

#### 受入基準

1. WHEN User が「クリア」ボタンをクリックする THEN THE System SHALL 営担を空文字列に設定する
2. WHEN 営担がクリアされる THEN THE System SHALL 「クリア」ボタンを `contained` スタイルに変更する
3. WHEN 営担がクリアされる THEN THE System SHALL 全てのイニシャルボタンを `outlined` スタイルに変更する

---

### 要件5: 営担の保存

**ユーザーストーリー**: 営業担当者として、選択した営担を保存したい。なぜなら、訪問査定の担当者情報をデータベースに記録する必要があるから。

#### 受入基準

1. WHEN User が保存ボタンをクリックする THEN THE System SHALL 選択された営担をデータベースに保存する
2. WHEN 営担が空文字列でない THEN THE System SHALL 営担が通常スタッフのイニシャルであることを検証する
3. IF 営担が通常スタッフのイニシャルでない THEN THE System SHALL エラーメッセージを表示し、保存を中止する
4. WHEN 保存が成功する THEN THE System SHALL 成功メッセージを表示する

---

### 要件6: データ整合性の保証

**ユーザーストーリー**: システム管理者として、営担が常に有効な通常スタッフのイニシャルであることを保証したい。なぜなら、無効なデータがデータベースに保存されることを防ぐ必要があるから。

#### 受入基準

1. WHEN 営担が保存される THEN THE Backend SHALL 営担が `employees` テーブルに存在することを検証する
2. WHEN 営担が保存される THEN THE Backend SHALL 営担が `is_normal = true` かつ `is_active = true` のスタッフであることを検証する
3. IF 営担が無効である THEN THE Backend SHALL 400エラーを返し、「無効な営担です」というメッセージを含める
4. WHEN 営担が空文字列である THEN THE Backend SHALL 検証をスキップし、保存を許可する

---

### 要件7: パフォーマンスの最適化

**ユーザーストーリー**: 営業担当者として、通常スタッフイニシャルが素早く表示されることを期待する。なぜなら、毎回APIリクエストを送信すると遅延が発生するから。

#### 受入基準

1. WHEN 通常スタッフイニシャルが取得される THEN THE System SHALL イニシャルをローカルストレージにキャッシュする
2. WHEN キャッシュが有効である（5分以内） THEN THE System SHALL キャッシュからイニシャルを取得する
3. WHEN キャッシュが無効である（5分経過） THEN THE System SHALL APIからイニシャルを再取得する
4. WHEN キャッシュが存在しない THEN THE System SHALL APIからイニシャルを取得する

---

### 要件8: エラーハンドリング

**ユーザーストーリー**: 営業担当者として、通常スタッフが登録されていない場合に適切なメッセージを表示してほしい。なぜなら、何が問題なのかを理解する必要があるから。

#### 受入基準

1. WHEN 通常スタッフイニシャルが0件である THEN THE System SHALL 警告メッセージ「通常スタッフが登録されていません。管理者に連絡してください。」を表示する
2. WHEN API リクエストが失敗する THEN THE System SHALL エラーメッセージをコンソールに出力する
3. WHEN API リクエストが失敗する THEN THE System SHALL 空配列を状態に設定し、ボタンを表示しない

---

### 要件9: アクセシビリティ

**ユーザーストーリー**: 営業担当者として、キーボードでも営担を選択できるようにしてほしい。なぜなら、マウスを使わずに操作したい場合があるから。

#### 受入基準

1. WHEN User がTabキーを押す THEN THE System SHALL ボタン間をフォーカス移動できるようにする
2. WHEN ボタンがフォーカスされている THEN THE System SHALL Enterキーまたはスペースキーで選択できるようにする
3. WHEN ボタンがフォーカスされている THEN THE System SHALL フォーカスインジケーターを表示する

---

## 非機能要件

### パフォーマンス

1. THE System SHALL 通常スタッフイニシャルを5分間キャッシュする
2. THE System SHALL ボタンクリック時に100ms以内に状態を更新する
3. THE API SHALL 通常スタッフイニシャルを500ms以内に返す

### セキュリティ

1. THE API SHALL 認証済みユーザーのみがアクセスできるようにする
2. THE Backend SHALL 営担の検証を必ず実行する
3. THE Backend SHALL SQLインジェクション攻撃を防ぐ

### 互換性

1. THE System SHALL Material-UI v5のButtonコンポーネントを使用する
2. THE System SHALL 既存の通話モードページのスタイルと一貫性を保つ
3. THE System SHALL モバイル端末でも正しく表示される

---

## 制約事項

1. 通常スタッフ（`is_normal = true`）のみが営担として選択可能
2. 営担は1つのイニシャル（1文字）のみ
3. 既存のテキスト入力フィールドは完全に削除される
4. APIエンドポイント `/api/employees/normal-initials` は既に実装済み

---

## 依存関係

### フロントエンド

- React 18
- Material-UI v5
- Axios

### バックエンド

- Express.js
- Supabase
- `employees` テーブル（`is_normal`, `is_active`, `initials` カラム）

### データベース

- `employees` テーブル
- `sellers` テーブル（`visit_assignee` カラム）

---

**最終更新日**: 2026年4月1日  
**作成者**: KIRO AI Assistant

# 要件定義書

## はじめに

本機能は、社内管理システム（sateituikyaku-admin）の業務依頼リスト「サイト登録」タブに対して以下の3つの表示項目を追加するものです。

1. **「メール配信」の追加表示**：「公開予定日」の下に「メール配信」（赤字、読み取り専用）を追加表示する
2. **「間取図300円（CW）計」の追加表示**：「間取図完了日」の上に、CWカウントシートから取得した間取図300円の現在計を表示する
3. **「サイト登録（CW）計」の追加表示**：「サイト登録確認OK送信」の下に、CWカウントシートから取得したサイト登録の現在計を表示する

対象ファイルは主に以下の通りです：
- フロントエンド: `frontend/frontend/src/components/WorkTaskDetailModal.tsx`
- GAS: `gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs`（CWカウントシート参照ロジック追加）

## 用語集

- **WorkTaskDetailModal**: 業務依頼リストの詳細モーダルコンポーネント（`WorkTaskDetailModal.tsx`）
- **SiteRegistrationSection**: WorkTaskDetailModal内のサイト登録タブを描画するコンポーネント
- **EditableField**: WorkTaskDetailModal内で使用される汎用編集フィールドコンポーネント
- **CWカウントシート**: スプレッドシートID `1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g` のシート名「CWカウント」
- **email_distribution**: 「メール配信」に対応するDBカラム（既存）
- **pre_distribution_check**: 「確認後処理」セクションの「メール配信」に対応するDBカラム（既存）
- **floor_plan_completed_date**: 「間取図完了日」に対応するDBカラム（既存）
- **site_registration_ok_sent**: 「サイト登録確認OK送信」に対応するDBカラム（既存）
- **LOOKUP関数**: スプレッドシートの検索関数。`LOOKUP(検索値, 検索範囲, 結果範囲)` の形式で使用

---

## 要件

### 要件1: 「メール配信」の追加表示（公開予定日の下）

**ユーザーストーリー:** 担当者として、「確認後処理」セクションの「公開予定日」の下に「メール配信」フィールドを赤字で読み取り専用表示したい。そうすることで、公開予定日と合わせてメール配信の状況を一目で確認できる。

#### 受け入れ基準

1. THE SiteRegistrationSection SHALL 「確認後処理」セクションの「公開予定日」フィールドの直下に「メール配信」フィールドを表示する
2. THE SiteRegistrationSection SHALL 「メール配信」フィールドのラベルを赤字（`color: 'error'` または `color: 'red'`）で表示する
3. THE SiteRegistrationSection SHALL 「メール配信」フィールドを読み取り専用（編集不可）として表示する
4. THE SiteRegistrationSection SHALL 「メール配信」フィールドに `email_distribution` カラムの値を表示する
5. WHEN `email_distribution` の値が null または空の場合、THE SiteRegistrationSection SHALL 空の状態で表示する（エラーを発生させない）

---

### 要件2: 「間取図300円（CW）計」の追加表示（間取図完了日の上）

**ユーザーストーリー:** 担当者として、「確認関係」セクションの「間取図完了日」の上に「間取図300円（CW）計」として現在のCWカウントを表示したい。そうすることで、間取図作業の進捗状況を確認できる。

#### 受け入れ基準

1. THE SiteRegistrationSection SHALL 「確認関係」セクションの「間取図完了日*」フィールドの直上に「間取図300円（CW）計」の表示エリアを配置する
2. THE SiteRegistrationSection SHALL 「間取図300円（CW）計」の表示内容として、以下のスプレッドシート式に相当する値を表示する：
   ```
   "<間取図300円（CW)計>"&"⇒ "&LOOKUP("現在計","CWカウント","項目","間取図（300円）")
   ```
   すなわち、CWカウントシートの「項目」列が「間取図（300円）」の行の「現在計」列の値を取得し、`間取図300円（CW)計⇒ {値}` の形式で表示する
3. THE SiteRegistrationSection SHALL CWカウントシート（スプレッドシートID: `1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g`、シート名: `CWカウント`）からデータを取得する
4. WHEN CWカウントシートからのデータ取得に失敗した場合、THE SiteRegistrationSection SHALL エラーを表示せず、空または「-」を表示する
5. THE SiteRegistrationSection SHALL 「間取図300円（CW）計」を読み取り専用として表示する（編集不可）

---

### 要件3: 「サイト登録（CW）計」の追加表示（サイト登録確認OK送信の下）

**ユーザーストーリー:** 担当者として、「★サイト登録確認」セクションの「サイト登録確認OK送信」の下に「サイト登録（CW）計」として現在のCWカウントを表示したい。そうすることで、サイト登録作業の進捗状況を確認できる。

#### 受け入れ基準

1. THE SiteRegistrationSection SHALL 「★サイト登録確認」セクションの「サイト登録確認OK送信」フィールドの直下に「サイト登録（CW）計」の表示エリアを配置する
2. THE SiteRegistrationSection SHALL 「サイト登録（CW）計」の表示内容として、以下のスプレッドシート式に相当する値を表示する：
   ```
   "<サイト登録（CW)計>"&"⇒ "&LOOKUP("現在計","CWカウント","項目","サイト登録")
   ```
   すなわち、CWカウントシートの「項目」列が「サイト登録」の行の「現在計」列の値を取得し、`サイト登録（CW)計⇒ {値}` の形式で表示する
3. THE SiteRegistrationSection SHALL CWカウントシート（スプレッドシートID: `1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g`、シート名: `CWカウント`）からデータを取得する
4. WHEN CWカウントシートからのデータ取得に失敗した場合、THE SiteRegistrationSection SHALL エラーを表示せず、空または「-」を表示する
5. THE SiteRegistrationSection SHALL 「サイト登録（CW）計」を読み取り専用として表示する（編集不可）

---

### 要件4: CWカウントデータの取得方法

**ユーザーストーリー:** 開発者として、CWカウントシートのデータを効率的に取得する方法を定義したい。そうすることで、フロントエンドから安全にスプレッドシートデータを参照できる。

#### 受け入れ基準

1. THE System SHALL CWカウントシートのデータ取得方法として、以下のいずれかを採用する：
   - **方法A（GAS経由）**: GASにCWカウントデータを返すエンドポイントを追加し、フロントエンドから呼び出す
   - **方法B（バックエンドAPI経由）**: バックエンドAPIにCWカウント取得エンドポイントを追加し、Google Sheets APIを使用してデータを取得する
   - **方法C（GASでDBに同期）**: GASでCWカウントデータをSupabaseに定期同期し、フロントエンドはDBから取得する
2. THE System SHALL 選択した方法に応じて、適切なエラーハンドリングを実装する
3. IF データ取得に失敗した場合、THEN THE SiteRegistrationSection SHALL ユーザーに影響を与えない形でフォールバック表示を行う

---

## 実装上の注意事項

### 既存の「メール配信」フィールドについて

現在の「サイト登録」タブには以下の3箇所に「メール配信」関連フィールドが存在する：
- 左側「登録関係」: `email_distribution`（ラベル「メール配信」）
- 右側「確認関係」の「★サイト登録確認」セクション: `email_distribution`（ラベル「メール配信v」）
- 右側「確認後処理」セクション: `pre_distribution_check`（ラベル「メール配信」）

要件1で追加する「メール配信」は `email_distribution` カラムの値を「公開予定日」の下に赤字・読み取り専用で表示するものである。

### CWカウントシートのデータ構造

CWカウントシートは以下の構造を持つと想定される：
- 「項目」列: 作業種別（例: 「間取図（300円）」「サイト登録」など）
- 「現在計」列: 現在の集計値

LOOKUP関数の動作: 「項目」列から指定した値を検索し、対応する「現在計」列の値を返す。

### フロントエンドの表示形式

- 「メール配信」（要件1）: 赤字ラベル、読み取り専用テキスト表示
- 「間取図300円（CW）計」（要件2）: 読み取り専用テキスト表示、形式: `間取図300円（CW)計⇒ {値}`
- 「サイト登録（CW）計」（要件3）: 読み取り専用テキスト表示、形式: `サイト登録（CW)計⇒ {値}`

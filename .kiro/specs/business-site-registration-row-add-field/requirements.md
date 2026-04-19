# 要件ドキュメント

## はじめに

業務リスト詳細画面の「サイト登録」タブにおいて、「物件一覧に行追加」フィールドの配置変更と、「CWの方へ依頼メール（サイト登録）」フィールドとの連動バリデーション機能を追加する。

現状、「物件一覧に行追加」フィールドは【確認後処理】セクションに配置されているが、業務フロー上は図面作成依頼の後に確認すべき項目であるため、【図面作成依頼】セクションの直下に移動する。また、「CWの方へ依頼メール（サイト登録）」に値が入った場合に「物件一覧に行追加」の入力を促す仕組みを設ける。

## 用語集

- **WorkTaskDetailModal**: 業務リスト詳細モーダルコンポーネント（`WorkTaskDetailModal.tsx`）
- **SiteRegistrationSection**: サイト登録タブのセクションコンポーネント
- **property_list_row_added**: 「物件一覧に行追加」フィールドのDBカラム名
- **cw_request_email_site**: 「CWの方へ依頼メール（サイト登録）」フィールドのDBカラム名
- **【図面作成依頼】セクション**: 薄緑（`#e8f5e9`）背景のセクション
- **【確認後処理】セクション**: 薄灰（`#fafafa`）背景のセクション
- **保存ボタン**: サイト登録タブ内の「保存」ボタン（左側・右側の両方）

## 要件

### 要件1：「物件一覧に行追加」フィールドの移動

**ユーザーストーリー：** 業務担当者として、「物件一覧に行追加」フィールドを【図面作成依頼】セクションの直下に配置したい。そうすることで、図面作成依頼後に続けて物件一覧への行追加を確認できる。

#### 受け入れ基準

1. THE SiteRegistrationSection SHALL 「物件一覧に行追加」フィールドを【図面作成依頼】セクション（`#e8f5e9`背景）の直下に表示する
2. THE SiteRegistrationSection SHALL 「物件一覧に行追加」フィールドの背景色を薄いピンク（`#fce4ec`）で表示する
3. THE SiteRegistrationSection SHALL 【確認後処理】セクションから「物件一覧に行追加」フィールドを削除する
4. THE SiteRegistrationSection SHALL 「物件一覧に行追加」フィールドの選択肢（`['追加済', '未']`）と対応するDBカラム（`property_list_row_added`）を変更せずに維持する

### 要件2：「CWの方へ依頼メール（サイト登録）」連動による必須色付け

**ユーザーストーリー：** 業務担当者として、「CWの方へ依頼メール（サイト登録）」に値が入ったとき「物件一覧に行追加」フィールドが必須であることを視覚的に認識したい。そうすることで、入力漏れを防ぐことができる。

#### 受け入れ基準

1. WHEN `cw_request_email_site` フィールドに値が入力された、THE SiteRegistrationSection SHALL 「物件一覧に行追加」フィールドのラベルを目立つ色（赤系、`error`カラー）で表示する
2. WHEN `cw_request_email_site` フィールドが空欄になった、THE SiteRegistrationSection SHALL 「物件一覧に行追加」フィールドのラベルを通常色（`text.secondary`）で表示する
3. THE SiteRegistrationSection SHALL `cw_request_email_site` の値の有無をリアルタイムで監視し、ラベル色を即座に切り替える

### 要件3：保存時の条件付きバリデーションPOPUP

**ユーザーストーリー：** 業務担当者として、「CWの方へ依頼メール（サイト登録）」に値が入っているのに「物件一覧に行追加」が空欄のまま保存しようとしたとき、注意喚起のPOPUPを表示してほしい。そうすることで、入力漏れに気づいて修正できる。

#### 受け入れ基準

1. WHEN 保存ボタンが押下された AND `cw_request_email_site` に値が入っている AND `property_list_row_added` が空欄である、THE WorkTaskDetailModal SHALL 注意喚起POPUPを表示する
2. THE 注意喚起POPUP SHALL 「物件一覧に行追加が未入力です。このまま保存しますか？」というメッセージを表示する
3. THE 注意喚起POPUP SHALL 「このまま保存」ボタンと「キャンセル」ボタンを表示する
4. WHEN 注意喚起POPUPで「このまま保存」が選択された、THE WorkTaskDetailModal SHALL 通常の保存処理を実行する
5. WHEN 注意喚起POPUPで「キャンセル」が選択された、THE WorkTaskDetailModal SHALL 保存処理を中断し、POPUPを閉じる
6. WHEN 保存ボタンが押下された AND `cw_request_email_site` が空欄である、THE WorkTaskDetailModal SHALL 注意喚起POPUPを表示せずに通常の保存処理を実行する
7. WHEN 保存ボタンが押下された AND `property_list_row_added` に値が入っている、THE WorkTaskDetailModal SHALL 注意喚起POPUPを表示せずに通常の保存処理を実行する

### 要件4：既存機能の維持

**ユーザーストーリー：** 業務担当者として、今回の変更によって既存のサイト登録タブの他の機能が影響を受けないことを確認したい。

#### 受け入れ基準

1. THE SiteRegistrationSection SHALL 【確認後処理】セクションの他のフィールド（配信日、物件ファイル、公開予定日、メール配信、サイト登録締め日v）を変更せずに維持する
2. THE SiteRegistrationSection SHALL 既存の保存処理（`handleSave`）のロジックを変更せずに維持する（注意喚起POPUP経由の場合を除く）
3. THE SiteRegistrationSection SHALL 「サイト登録納期予定日」の必須表示ロジック（`isSiteDueDateRequired`）を変更せずに維持する

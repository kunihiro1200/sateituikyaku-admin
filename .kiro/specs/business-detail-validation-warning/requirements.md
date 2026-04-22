# 要件定義書

## はじめに

業務詳細画面（`WorkTaskDetailModal`）において、入力漏れを防ぐためのバリデーション警告機能を追加する。

対象は以下の2つのシナリオ：

1. 「サイト登録確認」と「サイト登録確認OK送信」のどちらか一方だけ入力されている場合の警告（両方空欄はOK、両方入力済みはOK、片方だけ入力済みの場合に警告）
2. 「間取図確認者」「間取図確認OK送信」「間取図完了日」「間取図格納済み連絡メール」のいずれかに値が入っていて、いずれかが空欄の場合の警告

どちらの警告も「このまま保存する」ボタンを設けて、ユーザーが警告を無視して保存することを可能にする。

## 用語集

- **WorkTaskDetailModal**: 業務詳細画面のモーダルコンポーネント（`frontend/frontend/src/components/WorkTaskDetailModal.tsx`）
- **ValidationWarningDialog**: バリデーション警告を表示するダイアログコンポーネント
- **site_registration_confirmed**: 「サイト登録確認」フィールド（値: `'確認中'` / `'完了'` / `'他'`）
- **site_registration_ok_sent**: 「サイト登録確認OK送信」フィールド（Yes/No）
- **floor_plan_confirmer**: 「間取図確認者」フィールド（担当者イニシャル）
- **floor_plan_ok_sent**: 「間取図確認OK送信」フィールド（Yes/No）
- **floor_plan_completed_date**: 「間取図完了日」フィールド（日付）
- **floor_plan_stored_email**: 「間取図格納済み連絡メール」フィールド（Yes/No）
- **handleSave**: 保存処理を実行する関数
- **editedData**: 編集中のフィールド変更を保持するオブジェクト

## 要件

### 要件1：サイト登録確認フィールドの整合性チェック

**ユーザーストーリー：** 担当者として、「サイト登録確認」と「サイト登録確認OK送信」のどちらか一方だけ入力されている状態で保存しようとした場合、強い警告を受け取りたい。そうすることで、入力漏れを防ぐことができる。

#### 受け入れ基準

1. WHEN 保存ボタンが押された時、THE WorkTaskDetailModal SHALL `site_registration_confirmed` および `site_registration_ok_sent` の最終値（保存済みデータと編集中データを合わせた値）を評価する。

2. WHEN 保存ボタンが押された時、かつ `site_registration_confirmed` と `site_registration_ok_sent` のうち1つに値が入っており、かつもう1つが空欄（`''` または `null` または `undefined`）である場合、THE WorkTaskDetailModal SHALL 保存処理を中断し、ValidationWarningDialog を表示する。

3. THE ValidationWarningDialog SHALL 警告メッセージとして「サイト登録確認関連フィールドに未入力項目があります」と表示する。

4. THE ValidationWarningDialog SHALL 空欄になっているフィールド名の一覧を表示する（例：「未入力：サイト登録確認OK送信」）。

5. THE ValidationWarningDialog SHALL 「このまま保存する」ボタンを表示する。

6. WHEN 「このまま保存する」ボタンが押された時、THE WorkTaskDetailModal SHALL ValidationWarningDialog を閉じ、バリデーションをスキップして保存処理を実行する。

7. THE ValidationWarningDialog SHALL 「キャンセル」ボタンを表示する。

8. WHEN 「キャンセル」ボタンが押された時、THE WorkTaskDetailModal SHALL ValidationWarningDialog を閉じ、保存処理を実行しない（ユーザーが修正できる状態に戻る）。

9. WHEN `site_registration_confirmed` と `site_registration_ok_sent` の両方が空欄である場合、THE WorkTaskDetailModal SHALL 要件1のバリデーションチェックをスキップする（両方空欄は正常状態）。

10. WHEN `site_registration_confirmed` と `site_registration_ok_sent` の両方に値が入っている場合、THE WorkTaskDetailModal SHALL 要件1のバリデーションチェックをスキップする（両方入力済みは正常状態）。

---

### 要件2：間取図関連フィールドの整合性チェック

**ユーザーストーリー：** 担当者として、「間取図確認者」「間取図確認OK送信」「間取図完了日」「間取図格納済み連絡メール」のいずれかに値が入っているのに、残りが空欄のまま保存しようとした場合、強い警告を受け取りたい。そうすることで、間取図関連の作業漏れを防ぐことができる。

#### 受け入れ基準

1. WHEN 保存ボタンが押された時、THE WorkTaskDetailModal SHALL 以下の4フィールドの最終値（保存済みデータと編集中データを合わせた値）を評価する：`floor_plan_confirmer`、`floor_plan_ok_sent`、`floor_plan_completed_date`、`floor_plan_stored_email`。

2. WHEN 保存ボタンが押された時、かつ上記4フィールドのうち1つ以上に値が入っており、かつ1つ以上が空欄（`''` または `null` または `undefined`）である場合、THE WorkTaskDetailModal SHALL 保存処理を中断し、ValidationWarningDialog を表示する。

3. THE ValidationWarningDialog SHALL 警告メッセージとして「間取図関連フィールドに未入力項目があります」と表示する。

4. THE ValidationWarningDialog SHALL 空欄になっているフィールド名の一覧を表示する（例：「未入力：間取図確認者、間取図完了日」）。

5. THE ValidationWarningDialog SHALL 「このまま保存する」ボタンを表示する。

6. WHEN 「このまま保存する」ボタンが押された時、THE WorkTaskDetailModal SHALL ValidationWarningDialog を閉じ、バリデーションをスキップして保存処理を実行する。

7. THE ValidationWarningDialog SHALL 「キャンセル」ボタンを表示する。

8. WHEN 「キャンセル」ボタンが押された時、THE WorkTaskDetailModal SHALL ValidationWarningDialog を閉じ、保存処理を実行しない。

9. WHEN 上記4フィールドが全て空欄である場合、THE WorkTaskDetailModal SHALL 要件2のバリデーションチェックをスキップする（全て空欄は正常状態）。

10. WHEN 上記4フィールドが全て入力済みである場合、THE WorkTaskDetailModal SHALL 要件2のバリデーションチェックをスキップする（全て入力済みは正常状態）。

---

### 要件3：複数バリデーション警告の順序制御

**ユーザーストーリー：** 担当者として、複数のバリデーション警告が同時に発生した場合でも、一度に1つずつ確認できるようにしたい。

#### 受け入れ基準

1. WHEN 保存ボタンが押された時、THE WorkTaskDetailModal SHALL 要件1のチェックを先に実行し、要件1の警告が発生した場合は要件2のチェックを後回しにする。

2. WHEN 要件1の「このまま保存する」が選択された後、かつ要件2の警告条件も満たしている場合、THE WorkTaskDetailModal SHALL 要件2の ValidationWarningDialog を続けて表示する。

3. WHEN 要件1の「キャンセル」が選択された場合、THE WorkTaskDetailModal SHALL 要件2のチェックを実行しない。

---

### 要件4：ValidationWarningDialog の視覚的強調

**ユーザーストーリー：** 担当者として、警告ダイアログが通常の確認ダイアログと明確に区別できるようにしたい。そうすることで、重要な警告を見落とさずに済む。

#### 受け入れ基準

1. THE ValidationWarningDialog SHALL 警告アイコン（⚠️ または MUI の `WarningAmber` アイコン）をダイアログタイトル部分に表示する。

2. THE ValidationWarningDialog SHALL タイトル背景色またはアイコン色をオレンジ系（`warning` カラー）で表示する。

3. THE ValidationWarningDialog SHALL 「このまま保存する」ボタンを通常の色（`primary` または `default`）で表示する。

4. THE ValidationWarningDialog SHALL 「キャンセル」ボタンを目立つ色（`error` または `warning`）で表示し、ユーザーが修正に戻ることを促す。

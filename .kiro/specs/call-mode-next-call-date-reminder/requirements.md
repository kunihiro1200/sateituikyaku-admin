# 要件定義書

## はじめに

本機能は、売主管理システムの通話モードページ（`/sellers/:id/call`）において、ユーザーが別ページへ遷移しようとした際に「次電日を変更しましたか？」という確認ポップアップを表示する機能です。

対象となる売主は以下の条件をすべて満たす場合に限ります：
1. 反響日付から3日以上経過している
2. 「状況（当社）」（`status`フィールド）が「追客中」という文字列を含む
3. 通話モードページで何らかの編集操作が行われた（電話・メール送信、コメント入力、フィールド値の変更等）
4. 次電日（`nextCallDate`）が変更されていない

既存の遷移ブロック機能（追客中かつ次電日が空の場合に遷移を完全ブロックする `navigationBlockDialog`）とは別の、注意喚起のみを目的とした確認ダイアログです。

---

## 用語集

- **CallModePage**: 通話モードページ。`/sellers/:id/call` に対応するReactコンポーネント（`frontend/frontend/src/pages/CallModePage.tsx`）
- **次電日（Next_Call_Date）**: 次回電話予定日。`seller.nextCallDate` フィールド（`editedNextCallDate` ステート）
- **反響日付（Inquiry_Date）**: 売主が問い合わせを行った日付。`seller.inquiryDate` フィールド
- **状況（当社）（Status）**: 売主の追客状況を示すフィールド。`seller.status` フィールド（`editedStatus` ステート）
- **編集フラグ（Page_Edited_Flag）**: 通話モードページで何らかの編集が行われたことを示すフラグ
- **確認ポップアップ（Reminder_Dialog）**: 「次電日は変更しましたか？」と注意喚起するダイアログ
- **NavigationBlockDialog**: 既存の遷移ブロックダイアログ（追客中かつ次電日が空の場合に遷移を完全ブロックする）
- **NavigationWarningDialog**: 既存の遷移警告ダイアログ（確度未入力・1番電話未入力の場合に警告する）

---

## 要件

### 要件1：編集フラグの追跡

**ユーザーストーリー：** 担当者として、通話モードページで何らかの操作を行った場合に、そのことがシステムに記録されることを望む。これにより、次電日の変更忘れを防ぐことができる。

#### 受け入れ基準

1. THE CallModePage SHALL 通話モードページが開かれた時点で、編集フラグ（Page_Edited_Flag）を `false` に初期化する
2. WHEN コメント欄の内容が変更された場合、THE CallModePage SHALL 編集フラグを `true` に設定する
3. WHEN 電話（不通ステータス）フィールドが変更された場合、THE CallModePage SHALL 編集フラグを `true` に設定する
4. WHEN メール送信が実行された場合、THE CallModePage SHALL 編集フラグを `true` に設定する
5. WHEN SMS送信が実行された場合、THE CallModePage SHALL 編集フラグを `true` に設定する
6. WHEN ステータス（状況（当社））フィールドが変更された場合、THE CallModePage SHALL 編集フラグを `true` に設定する
7. WHEN 確度フィールドが変更された場合、THE CallModePage SHALL 編集フラグを `true` に設定する
8. WHEN 物件情報フィールドが変更・保存された場合、THE CallModePage SHALL 編集フラグを `true` に設定する
9. WHEN 売主情報フィールドが変更・保存された場合、THE CallModePage SHALL 編集フラグを `true` に設定する
10. WHEN 訪問予約情報が変更・保存された場合、THE CallModePage SHALL 編集フラグを `true` に設定する
11. WHEN 追客ログ（通話メモ）が保存された場合、THE CallModePage SHALL 編集フラグを `true` に設定する
12. WHEN 別の売主IDに切り替わった場合（`id` パラメータが変更された場合）、THE CallModePage SHALL 編集フラグを `false` にリセットする

### 要件2：次電日変更確認ポップアップの表示条件

**ユーザーストーリー：** 担当者として、次電日の変更を忘れたまま別ページへ移動しようとした際に注意喚起を受けることを望む。これにより、追客漏れを防ぐことができる。

#### 受け入れ基準

1. WHEN ユーザーが別ページへ遷移しようとした場合、THE CallModePage SHALL 以下の全条件を評価する：
   - 反響日付（Inquiry_Date）から現在日時（JST）まで3日以上経過している
   - 状況（当社）（Status）が「追客中」という文字列を含む
   - 編集フラグ（Page_Edited_Flag）が `true` である
   - 次電日（Next_Call_Date）が変更されていない（`editedNextCallDate` が `savedNextCallDate` と同一である）
2. WHEN 上記4条件がすべて満たされた場合、THE CallModePage SHALL 確認ポップアップ（Reminder_Dialog）を表示する
3. WHEN 上記4条件のいずれか1つでも満たされない場合、THE CallModePage SHALL 確認ポップアップを表示せずに遷移を続行する
4. WHILE NavigationBlockDialog が表示される条件（追客中かつ次電日が空）を満たす場合、THE CallModePage SHALL 確認ポップアップよりも NavigationBlockDialog を優先して表示する
5. THE CallModePage SHALL 確認ポップアップの表示判定を、既存の NavigationWarningDialog（確度未入力・1番電話未入力の警告）の判定より前に行う

### 要件3：確認ポップアップのUI

**ユーザーストーリー：** 担当者として、次電日変更の確認ポップアップが分かりやすく表示されることを望む。

#### 受け入れ基準

1. THE Reminder_Dialog SHALL 「次電日は変更しましたか？」というメッセージを表示する
2. THE Reminder_Dialog SHALL 「次電日を変更する」ボタンを表示する
3. THE Reminder_Dialog SHALL 「このまま移動する」ボタンを表示する
4. WHEN ユーザーが「次電日を変更する」ボタンをクリックした場合、THE Reminder_Dialog SHALL ダイアログを閉じ、次電日フィールドへスクロール＆フォーカスする
5. WHEN ユーザーが「このまま移動する」ボタンをクリックした場合、THE Reminder_Dialog SHALL ダイアログを閉じ、元の遷移先へ移動する
6. WHEN ユーザーがダイアログ外をクリックした場合（backdrop click）、THE Reminder_Dialog SHALL 「次電日を変更する」ボタンと同じ動作をする（ダイアログを閉じて次電日フィールドへ誘導する）

### 要件4：遷移先の保持

**ユーザーストーリー：** 担当者として、確認ポップアップで「このまま移動する」を選択した際に、元々意図していた遷移先へ正しく移動できることを望む。

#### 受け入れ基準

1. THE CallModePage SHALL 確認ポップアップを表示する際に、元の遷移先（コールバック関数）を保持する
2. WHEN ユーザーが「このまま移動する」を選択した場合、THE CallModePage SHALL 保持していた遷移先コールバックを実行する
3. THE CallModePage SHALL サイドバーの別売主クリック、戻るボタン、ブラウザの戻るボタンのいずれの遷移操作に対しても、確認ポップアップを適用する

### 要件5：反響日付の経過日数計算

**ユーザーストーリー：** 担当者として、反響日付から3日以上経過した売主に対してのみ確認ポップアップが表示されることを望む。これにより、新規反響の直後は不要な確認を省略できる。

#### 受け入れ基準

1. THE CallModePage SHALL 反響日付からの経過日数をJST（日本標準時）基準で計算する
2. THE CallModePage SHALL 反響日付の翌日を1日目として数え、3日以上経過した場合に条件を満たすと判定する
3. IF 反響日付が設定されていない場合、THEN THE CallModePage SHALL 経過日数条件を満たさないものとして扱い、確認ポップアップを表示しない

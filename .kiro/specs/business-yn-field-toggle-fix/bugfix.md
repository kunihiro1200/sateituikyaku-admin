# Bugfix Requirements Document

## Introduction

業務依頼画面（WorkTaskDetailModal）のY/N選択フィールドにおいて、選択済みのボタン（YまたはN）を再度クリックしても値が空欄（未選択状態）に戻らないバグを修正する。

対象フィールドは `EditableYesNo` コンポーネントを使用している全フィールドで、具体的には以下が含まれる：
- CWの方へ依頼メール（サイト登録）
- CWの方へ依頼メール（間取り、区画図）
- CWの方へ依頼メール（2階以上）
- サイト登録確認OK送信
- 間取図確認OK送信
- 間取図格納済み連絡メール
- 保留
- その他 `EditableYesNo` を使用する全フィールド

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーがY/N選択フィールドで「Y」ボタンをクリックして選択済み状態にした後、再度「Y」ボタンをクリックする THEN システムは値を変更せず「Y」のまま保持し、未選択状態に戻らない

1.2 WHEN ユーザーがY/N選択フィールドで「N」ボタンをクリックして選択済み状態にした後、再度「N」ボタンをクリックする THEN システムは値を変更せず「N」のまま保持し、未選択状態に戻らない

### Expected Behavior (Correct)

2.1 WHEN ユーザーがY/N選択フィールドで「Y」ボタンをクリックして選択済み状態にした後、再度「Y」ボタンをクリックする THEN システムは SHALL フィールドの値を空欄（null または空文字）に設定し、ボタンが未選択状態（outlined スタイル）に戻る

2.2 WHEN ユーザーがY/N選択フィールドで「N」ボタンをクリックして選択済み状態にした後、再度「N」ボタンをクリックする THEN システムは SHALL フィールドの値を空欄（null または空文字）に設定し、ボタンが未選択状態（outlined スタイル）に戻る

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーがY/N選択フィールドで未選択状態から「Y」ボタンをクリックする THEN システムは SHALL CONTINUE TO フィールドの値を「Y」に設定し、「Y」ボタンが選択済み状態（contained スタイル）で表示される

3.2 WHEN ユーザーがY/N選択フィールドで未選択状態から「N」ボタンをクリックする THEN システムは SHALL CONTINUE TO フィールドの値を「N」に設定し、「N」ボタンが選択済み状態（contained スタイル）で表示される

3.3 WHEN ユーザーがY/N選択フィールドで「Y」が選択済みの状態から「N」ボタンをクリックする THEN システムは SHALL CONTINUE TO フィールドの値を「N」に切り替え、「N」ボタンが選択済み状態で表示される

3.4 WHEN ユーザーがY/N選択フィールドで「N」が選択済みの状態から「Y」ボタンをクリックする THEN システムは SHALL CONTINUE TO フィールドの値を「Y」に切り替え、「Y」ボタンが選択済み状態で表示される

3.5 WHEN ユーザーが保存ボタンをクリックする THEN システムは SHALL CONTINUE TO 変更されたY/Nフィールドの値（「Y」、「N」、または空欄）をAPIに送信して保存する

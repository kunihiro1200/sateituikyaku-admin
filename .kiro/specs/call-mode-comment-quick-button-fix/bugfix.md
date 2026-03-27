# Bugfix Requirements Document

## Introduction

通話モードページ（CallModePage）のコメント欄（RichTextCommentEditor）において、クイックボタンで太字テキストを挿入する際に2つのバグが存在する。

**バグ1**: 2度目以降のクイックボタン挿入がカーソル位置ではなく末尾に移動してしまう。  
**バグ2**: クイックボタンで太字テキストを挿入した後、続けてキーボードで入力すると太字になってしまう。

これらのバグにより、ユーザーがコメントを編集する際の操作性が著しく低下している。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN クイックボタンを1度目に押す THEN the system カーソル位置に正しく太字テキストを挿入する

1.2 WHEN クイックボタンを2度目以降に押す THEN the system カーソル位置ではなくテキストの末尾に太字テキストを挿入する

1.3 WHEN クイックボタンで太字テキストを挿入した後にキーボードで文字を入力する THEN the system 入力した文字が太字で表示される

### Expected Behavior (Correct)

2.1 WHEN クイックボタンを何度押しても THEN the system SHALL 保存されたカーソル位置に太字テキストを挿入する

2.2 WHEN カーソル位置が保存されていない状態でクイックボタンを押す THEN the system SHALL テキストの先頭に太字テキストを挿入する

2.3 WHEN クイックボタンで太字テキストを挿入した後にキーボードで文字を入力する THEN the system SHALL 通常の太さ（非太字）で文字を表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN エディタにフォーカスがある状態でクイックボタンを押す THEN the system SHALL CONTINUE TO カーソル位置にテキストを挿入する

3.2 WHEN ツールバーの太字ボタン（FormatBold）を押す THEN the system SHALL CONTINUE TO 選択テキストの太字切り替えを行う

3.3 WHEN ツールバーの赤字ボタン（FormatColorText）を押す THEN the system SHALL CONTINUE TO 選択テキストの赤字切り替えを行う

3.4 WHEN エディタに通常のキーボード入力を行う THEN the system SHALL CONTINUE TO 入力した文字をエディタに表示し onChange を呼び出す

3.5 WHEN エディタの内容が変更される THEN the system SHALL CONTINUE TO onChange コールバックで最新の HTML を通知する

# Bugfix Requirements Document

## Introduction

買主リストの新規登録画面（`NewBuyerPage.tsx`）において、内覧情報セクションの「内覧時間」フィールドが通常のテキスト入力（`type="text"`）になっており、時間入力フィールド（`<input type="time">`）として機能していない。

このバグにより、ユーザーは時間ピッカーUIを使用できず、手動でテキストを入力する必要がある。正しくは `type="time"` を指定することで、ブラウザ標準の時間入力UIが表示されるべきである。

対象ファイル: `frontend/frontend/src/pages/NewBuyerPage.tsx`（約1102行目）

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが買主新規登録画面の「内覧時間」フィールドを操作する THEN システムは通常のテキスト入力フィールドを表示し、時間ピッカーUIが表示されない

1.2 WHEN 「内覧時間」フィールドに値を入力する THEN システムは `type="text"` のテキストフィールドとして動作し、ブラウザの時間入力バリデーションが機能しない

### Expected Behavior (Correct)

2.1 WHEN ユーザーが買主新規登録画面の「内覧時間」フィールドを操作する THEN システムは SHALL `type="time"` の時間入力フィールドを表示し、ブラウザ標準の時間ピッカーUIを提供する

2.2 WHEN 「内覧時間」フィールドに値を入力する THEN システムは SHALL `type="time"` のフィールドとして動作し、HH:MM形式の時間入力バリデーションが機能する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが「内覧日」フィールドを操作する THEN システムは SHALL CONTINUE TO `type="date"` の日付入力フィールドとして正常に動作する

3.2 WHEN ユーザーが「内覧時間」フィールドに有効な時間（例: "14:00"）を入力して登録する THEN システムは SHALL CONTINUE TO その値を `viewing_time` フィールドとしてAPIに送信する

3.3 WHEN ユーザーが「内覧時間」フィールドを空のまま登録する THEN システムは SHALL CONTINUE TO `viewing_time: null` としてAPIに送信する

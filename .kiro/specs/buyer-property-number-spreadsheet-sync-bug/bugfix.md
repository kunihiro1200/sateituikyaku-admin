# Bugfix Requirements Document

## Introduction

買主詳細画面で物件番号を入力して物件詳細カードを表示した際、スプレッドシートへの即時保存が行われないバグ。
その後GASの同期が実行されると、スプレッドシート側の物件番号フィールドが空欄で上書きされてしまう。
買主番号7360で発生が確認されている。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主詳細画面で物件番号を入力し物件詳細カードが表示された THEN システムはスプレッドシートへの即時保存を行わない

1.2 WHEN スプレッドシートへの即時保存が行われていない状態でGASの同期が実行された THEN システムはスプレッドシートの物件番号フィールドを空欄で上書きする

### Expected Behavior (Correct)

2.1 WHEN 買主詳細画面で物件番号を入力し物件詳細カードが表示された THEN システムは物件番号をスプレッドシートに即時保存しなければならない（SHALL）

2.2 WHEN GASの同期が実行された THEN システムはスプレッドシートに保存済みの物件番号を保持しなければならない（SHALL）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 物件番号以外のフィールド（氏名、電話番号など）が更新された THEN システムは引き続きスプレッドシートへの即時保存を正常に行わなければならない（SHALL CONTINUE TO）

3.2 WHEN 物件番号が入力されていない買主に対してGASの同期が実行された THEN システムは引き続き他のフィールドを正常に同期しなければならない（SHALL CONTINUE TO）

3.3 WHEN 物件番号が正しく保存済みの買主に対してGASの同期が実行された THEN システムは引き続き物件番号を保持したまま同期しなければならない（SHALL CONTINUE TO）

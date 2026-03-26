# Bugfix Requirements Document

## Introduction

物件詳細画面（`PropertyListingDetailPage`）に2つの問題があります。

1. **遷移速度が遅い**: 物件一覧から案件をクリックして詳細画面に遷移するスピードが遅い。詳細ページ表示時に `fetchPropertyData`・`fetchBuyers`・`fetchWorkTaskData`・`getActiveEmployees` の4つのAPIが順次（逐次）呼び出されており、並列化されていないことが主因と考えられます。

2. **スクロール時のヘッダー固定**: 物件詳細画面を下にスクロールする際に「物件概要」バーが固定されず、スクロールと一緒に流れてしまう。現在の `Paper` コンポーネントに `position: sticky` が設定されていないことが原因です。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが物件一覧から案件をクリックして詳細画面に遷移する THEN システムは `fetchPropertyData`・`fetchBuyers`・`fetchWorkTaskData`・`getActiveEmployees` を逐次実行するため、全データが揃うまで時間がかかり遷移が遅く感じられる

1.2 WHEN ユーザーが物件詳細画面を下にスクロールする THEN システムは「物件概要」バー（`Paper` コンポーネント）をスクロールと一緒に流してしまい、画面上部から消える

### Expected Behavior (Correct)

2.1 WHEN ユーザーが物件一覧から案件をクリックして詳細画面に遷移する THEN システムは `fetchPropertyData`・`fetchBuyers`・`fetchWorkTaskData`・`getActiveEmployees` を `Promise.all` で並列実行し、主要データ（物件情報）を最優先で表示することで遷移を高速化する

2.2 WHEN ユーザーが物件詳細画面を下にスクロールする THEN システムは「物件概要」バーを `position: sticky` で画面上部に固定し、その下のコンテンツのみスクロールさせる

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 物件詳細データの取得が完了する THEN システムは引き続き物件情報・買主リスト・業務タスクデータを正しく表示する

3.2 WHEN ユーザーが「物件概要」バーの編集ボタンをクリックする THEN システムは引き続き編集モードに切り替わり、各フィールドを編集・保存できる

3.3 WHEN ユーザーが物件詳細画面の上部ナビゲーションバーを使用する THEN システムは引き続き既存の `position: sticky` ナビゲーションバーが正常に機能する

3.4 WHEN APIの一部が失敗する THEN システムは引き続き他のデータは表示し、エラーハンドリングが正常に動作する

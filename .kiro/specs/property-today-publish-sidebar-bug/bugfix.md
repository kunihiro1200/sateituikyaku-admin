# Bugfix Requirements Document

## Introduction

物件リストのサイドバーカテゴリー「本日公開予定」に、公開予定日が今日以前の物件が表示されないバグを修正する。

原因は2つのバグが重なっている：
1. フロントエンドが `/api/work-tasks` のレスポンス形式を誤って処理し、業務依頼データが常に空配列になる
2. バックエンドのSELECTクエリに `publish_scheduled_date` カラムが含まれておらず、APIレスポンスに公開予定日が含まれない

これにより、`calculatePropertyStatus()` が `workTaskMap` から公開予定日を取得できず、「本日公開予定」ステータスが一切返されない状態になっている。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN フロントエンドが `/api/work-tasks` のレスポンスを処理するとき THEN `Array.isArray(workTasksRes.data)` が `false` になり、`workTasksData` が常に空配列 `[]` になる

1.2 WHEN バックエンドが `work_tasks` テーブルをSELECTするとき THEN `publish_scheduled_date` カラムがSELECT句に含まれていないため、APIレスポンスに公開予定日が含まれない

1.3 WHEN `atbb_status` が「公開前」を含む物件の公開予定日が今日以前であるとき THEN `workTaskMap` が空のため「本日公開予定」ステータスが返されず、サイドバーに表示されない

### Expected Behavior (Correct)

2.1 WHEN フロントエンドが `/api/work-tasks` のレスポンスを処理するとき THEN `workTasksRes.data.data` が配列であることを確認し、業務依頼データを正しく取得する SHALL

2.2 WHEN バックエンドが `work_tasks` テーブルをSELECTするとき THEN `publish_scheduled_date` カラムをSELECT句に含め、APIレスポンスに公開予定日を含める SHALL

2.3 WHEN `atbb_status` が「公開前」を含む物件の公開予定日が今日以前であるとき THEN `calculatePropertyStatus()` が「本日公開予定」ステータスを返し、サイドバーに表示される SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 公開予定日が設定されていない物件を処理するとき THEN システムは SHALL CONTINUE TO 「本日公開予定」以外の適切なステータスを返す

3.2 WHEN `atbb_status` が「公開前」以外の物件を処理するとき THEN システムは SHALL CONTINUE TO 既存のステータス判定ロジック（未報告、未確認、公開中など）を正しく適用する

3.3 WHEN 業務依頼データの取得・表示に関係しない他のサイドバーカテゴリーを表示するとき THEN システムは SHALL CONTINUE TO 各カテゴリーの物件数を正しく表示する

3.4 WHEN `/api/work-tasks` エンドポイントが `{ data: [...], total, limit, offset }` 形式でレスポンスを返すとき THEN システムは SHALL CONTINUE TO このレスポンス形式を維持する（バックエンドのレスポンス形式は変更しない）

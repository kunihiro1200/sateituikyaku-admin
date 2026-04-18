# Bugfix Requirements Document

## Introduction

買主詳細画面の削除ボタンで買主をDBから削除した後、サイドバーカテゴリーの表示が即座に更新されないバグ。
削除後もしばらくサイドバーに削除済みの買主が残り続け、クリックすると「データなし」と表示される。
削除操作と同時にサイドバーのカウントおよびカテゴリー表示を即座に更新することで、ユーザーの混乱を防ぐ。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主詳細画面の削除ボタンで買主を削除した直後 THEN the system はサイドバーカテゴリーのカウントおよびリストを更新せず、削除済みの買主が引き続き表示される
1.2 WHEN サイドバーに残っている削除済みの買主をクリックした THEN the system は「データなし」と表示し、正常なデータを取得できない

### Expected Behavior (Correct)

2.1 WHEN 買主詳細画面の削除ボタンで買主を削除した直後 THEN the system SHALL サイドバーカテゴリーのカウントおよびリストを即座に更新し、削除済みの買主を表示しない
2.2 WHEN 買主が削除された THEN the system SHALL 該当買主が属していたサイドバーカテゴリーのカウントを即座に減算して反映する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 買主を削除せずに詳細画面を閲覧した THEN the system SHALL CONTINUE TO サイドバーカテゴリーの表示を変更せずに維持する
3.2 WHEN 買主の情報を編集・保存した（削除ではない） THEN the system SHALL CONTINUE TO 既存のサイドバー更新ロジックを通じてカテゴリーを正しく反映する
3.3 WHEN 削除されていない買主をサイドバーからクリックした THEN the system SHALL CONTINUE TO 該当買主の詳細画面を正常に表示する
3.4 WHEN 買主リストページを再読み込みした THEN the system SHALL CONTINUE TO 最新のDB状態を反映したサイドバーカテゴリーを表示する

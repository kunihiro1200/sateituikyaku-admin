# Bugfix Requirements Document

## Introduction

業務リストの【★図面確認】セクションにおいて、「CWの方へ依頼メール（2階以上）」フィールド（DBカラム: `cw_request_email_2f_above`）に値が入っている場合、間取図の単価が500円であるにもかかわらず、常に「間取図300円（CW）計⇒ {値}」と表示されてしまうバグを修正する。

AA13328のような案件で、CWへの依頼が2階以上（500円）の場合でも300円表示になるため、業務担当者が誤った情報を参照してしまう問題がある。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `cw_request_email_2f_above` に値が入っている案件の【★図面確認】セクションを表示する THEN the system は「間取図300円（CW）計⇒ {値}」と表示する（500円であるべきところを300円と表示する）

1.2 WHEN `useCwCounts()` フックが `cw_counts` テーブルからデータを取得する THEN the system は「間取図（300円）」と「サイト登録」のみを取得し、「間取図（500円）」を取得しない

1.3 WHEN GASの `syncCwCounts()` 関数が実行される THEN the system は「間取図（300円）」と「サイト登録」のみを同期対象とし、「間取図（500円）」をCWカウントシートから同期しない

### Expected Behavior (Correct)

2.1 WHEN `cw_request_email_2f_above` に値が入っている案件の【★図面確認】セクションを表示する THEN the system SHALL 「間取図500円（CW）計⇒ {値}」と表示する

2.2 WHEN `cw_request_email_2f_above` が空（null または空文字）の案件の【★図面確認】セクションを表示する THEN the system SHALL 従来通り「間取図300円（CW）計⇒ {値}」と表示する

2.3 WHEN `useCwCounts()` フックが `cw_counts` テーブルからデータを取得する THEN the system SHALL 「間取図（300円）」「間取図（500円）」「サイト登録」の3項目を取得する

2.4 WHEN GASの `syncCwCounts()` 関数が実行される THEN the system SHALL 「間取図（300円）」「間取図（500円）」「サイト登録」の3項目をCWカウントシートから同期する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `cw_request_email_2f_above` が空の案件を表示する THEN the system SHALL CONTINUE TO 「間取図300円（CW）計⇒ {値}」を表示する（既存の300円表示は維持される）

3.2 WHEN 【★図面確認】セクションの `cwCounts.floorPlan300` が null の場合 THEN the system SHALL CONTINUE TO 「-」を表示する

3.3 WHEN `syncCwCounts()` が「サイト登録」を同期する THEN the system SHALL CONTINUE TO 「サイト登録」の現在計を正常に同期する

3.4 WHEN 【サイト登録確認】セクションの `cwCounts.siteRegistration` を表示する THEN the system SHALL CONTINUE TO 「サイト登録（CW）計⇒ {値}」を正常に表示する

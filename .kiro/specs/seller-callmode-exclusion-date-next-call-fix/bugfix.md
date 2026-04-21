# Bugfix Requirements Document

## Introduction

通話モードページ（CallModePage）の「除外日にすること」ボタンを押した際に、次電日（次回電話予定日）が自動的に指定された除外日の日付に変わらなくなっているバグを修正する。

コミット `1ec3e8e5`（2026年4月15日）で「サイト=Hの場合に反響日+5日を次電日に設定する」機能が追加された際、条件分岐が変更され、以下の問題が発生した：

- `ExclusionDateCalculator` にサイト `H` のルールが定義されていないため、サイト=Hの売主は `exclusionDate` が常に空になる
- ボタンクリック時の条件分岐で `seller?.site === 'H' && seller?.inquiryDate` が真になると `else if (exclusionDate)` に到達しない
- `inquiryDate` が存在しない場合でも `exclusionDate` が空なら次電日は変わらない
- `calcInquiryDatePlusDays` が `toISOString()` を使用しているため、タイムゾーンずれで日付が1日前になる可能性がある

確認対象の売主番号: AA14000

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 売主のサイトが `H` であり `inquiryDate` が存在する状態で「除外日にすること」ボタンを押す THEN システムは `calcInquiryDatePlusDays` で反響日+5日を計算しようとするが、`toISOString()` のタイムゾーンずれにより日付が1日前になる場合がある

1.2 WHEN 売主のサイトが `H` であり `inquiryDate` が存在しない状態で「除外日にすること」ボタンを押す THEN システムは `exclusionDate` が空のため次電日を変更しない（何も起きない）

1.3 WHEN 売主のサイトが `H` 以外（Y, ウ, L, す, a 等）であり `exclusionDate` が空の状態で「除外日にすること」ボタンを押す THEN システムは `exclusionDate` が空のため次電日を変更しない（何も起きない）

1.4 WHEN 売主のサイトが `H` であり `ExclusionDateCalculator` にサイト `H` のルールが定義されていないため THEN システムは `exclusionDate` を常に空文字列として設定する

### Expected Behavior (Correct)

2.1 WHEN 売主のサイトが `H` であり `inquiryDate` が存在する状態で「除外日にすること」ボタンを押す THEN システムは SHALL 反響日+5日の日付（タイムゾーンずれなし）を次電日に設定する

2.2 WHEN 売主のサイトが `H` であり `inquiryDate` が存在しない状態で「除外日にすること」ボタンを押す THEN システムは SHALL `exclusionDate` が存在する場合はそれを次電日に設定し、存在しない場合は次電日を変更しない

2.3 WHEN 売主のサイトが `H` 以外であり `exclusionDate` が設定されている状態で「除外日にすること」ボタンを押す THEN システムは SHALL `exclusionDate` の値を次電日に設定する

2.4 WHEN `calcInquiryDatePlusDays` 関数で日付を計算する THEN システムは SHALL JST（日本時間）基準でタイムゾーンずれのない日付文字列（YYYY-MM-DD形式）を返す

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 売主のサイトが `H` 以外であり `exclusionDate` が設定されている状態で「除外日にすること」ボタンを押す THEN システムは SHALL CONTINUE TO `exclusionDate` の値を次電日に設定する（既存の正常動作を維持）

3.2 WHEN 「除外日にすること」ボタンを解除（同じボタンを再度クリック）する THEN システムは SHALL CONTINUE TO 次電日を変更しない

3.3 WHEN 査定方法が空欄の状態で「除外日にすること」ボタンを押す THEN システムは SHALL CONTINUE TO 査定方法を「不要」に自動設定する

3.4 WHEN 「ステータスを更新」ボタンを押す THEN システムは SHALL CONTINUE TO 変更された次電日をバックエンドに保存する

3.5 WHEN サイト=Hの売主で「除外日にすること」ボタンを押す THEN システムは SHALL CONTINUE TO 「（なりすまし）として除外してください」チップを表示する

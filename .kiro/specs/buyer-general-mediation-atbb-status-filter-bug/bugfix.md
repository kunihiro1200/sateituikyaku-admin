# バグ修正要件ドキュメント

## Introduction

買主リストページのサイドバーカテゴリー「一般媒介_内覧後売主連絡未」において、atbb_statusが"非公開"などの物件も含まれてしまっている問題を修正します。このカテゴリーには、atbb_statusが"一般・公開中"の物件のみが表示されるべきです。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主リストの「一般媒介_内覧後売主連絡未」カテゴリーを表示する THEN atbb_statusが"非公開"の物件も含まれて表示される

1.2 WHEN 買主リストの「一般媒介_内覧後売主連絡未」カテゴリーを表示する THEN atbb_statusが"一般・公開中"以外の物件も含まれて表示される

### Expected Behavior (Correct)

2.1 WHEN 買主リストの「一般媒介_内覧後売主連絡未」カテゴリーを表示する THEN atbb_statusが"一般・公開中"の物件のみが表示される

2.2 WHEN 買主リストの「一般媒介_内覧後売主連絡未」カテゴリーを表示する THEN atbb_statusが"非公開"などの物件は除外される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 買主リストの他のサイドバーカテゴリーを表示する THEN 既存のフィルタリングロジックが正常に動作し続ける

3.2 WHEN 買主リストの「一般媒介_内覧後売主連絡未」カテゴリーで、atbb_statusが"一般・公開中"かつ他の条件を満たす物件を表示する THEN 正しく表示され続ける

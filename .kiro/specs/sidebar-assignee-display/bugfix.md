# Bugfix Requirements Document

## Introduction

売主リストのサイドバーカテゴリーにおいて、「営担」（`visit_assignee`）に入力がある場合、担当者のイニシャルがサイドバーのカテゴリーラベルに正しく表示されないバグを修正する。

期待される動作は、営担が「Y」の場合、サイドバーに「担当（Y）」というメインカテゴリーを表示し、その配下に「当日TEL(Y)」をサブカテゴリーとして表示することである。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `visit_assignee` に値（例: "Y"）が入力されている売主が存在する THEN サイドバーに担当者イニシャルを含む「担当（Y）」カテゴリーが表示されない

1.2 WHEN `visit_assignee` に値が入力されており、かつ次電日が今日以前の売主が存在する THEN 「担当（Y）」のサブカテゴリーとして「当日TEL(Y)」が表示されない

1.3 WHEN 複数の担当者（例: "Y" と "I"）がいる場合 THEN 担当者ごとの個別エントリーが表示されない

### Expected Behavior (Correct)

2.1 WHEN `visit_assignee` に値（例: "Y"）が入力されている売主が存在する THEN サイドバーに「担当（Y）」というメインカテゴリーが表示される

2.2 WHEN `visit_assignee` に値が入力されており、かつ次電日が今日以前の売主が存在する THEN 「担当（Y）」のサブカテゴリーとして「当日TEL(Y)」が表示される

2.3 WHEN 複数の担当者（例: "Y" と "I"）がいる場合 THEN 担当者ごとに個別エントリーとして「担当（Y）」「担当（I）」がそれぞれ表示される

2.4 WHEN 「担当（Y）」のサブカテゴリーとして「当日TEL(Y)」が存在する場合 THEN 表示イメージは以下のようになる：
```
担当（Y）
  └ 当日TEL(Y)
担当（I）
  └ 当日TEL(I)
```

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `visit_assignee` が空欄の売主が当日TEL分の条件を満たす THEN システムは引き続き「③当日TEL分」カテゴリーに分類する

3.2 WHEN `visit_assignee` が空欄の売主が当日TEL（内容）の条件を満たす THEN システムは引き続き「④当日TEL（内容）」カテゴリーに分類する

3.3 WHEN サイドバーのカテゴリーをクリックする THEN システムは引き続き該当カテゴリーの売主一覧をフィルタリングして表示する

3.4 WHEN 未査定・査定（郵送）・当日TEL_未着手・Pinrich空欄の各カテゴリーの条件を満たす売主が存在する THEN システムは引き続きそれぞれのカテゴリーに正しく分類する

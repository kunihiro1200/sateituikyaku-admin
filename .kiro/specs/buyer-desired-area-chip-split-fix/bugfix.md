# Bugfix Requirements Document

## Introduction

買主リストの希望条件ページで、希望エリアの選択肢として「②中学校（滝尾、城東、原川）」を選択した際、エリア表示フィールドに1つのチップとして表示されるべきところが「②中学校（滝尾」「城東」「原川）」という3つの別々のチップに分割されて表示されるバグ。

エリア名に含まれる読点（、）または英語カンマ（,）でチップ生成時の文字列分割が行われており、括弧内のカンマも分割対象になってしまっていることが原因と推測される。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 希望エリアとして「②中学校（滝尾、城東、原川）」を選択する THEN the system エリア表示フィールドに「②中学校（滝尾」「城東」「原川）」という3つの別々のチップを表示する

1.2 WHEN エリア名に読点（、）またはカンマ（,）を含む選択肢を選択する THEN the system その文字を区切り文字として文字列を分割し、複数のチップを生成する

### Expected Behavior (Correct)

2.1 WHEN 希望エリアとして「②中学校（滝尾、城東、原川）」を選択する THEN the system SHALL エリア表示フィールドに「②中学校（滝尾、城東、原川）」という1つのチップとして表示する

2.2 WHEN エリア名に読点（、）またはカンマ（,）を含む選択肢を選択する THEN the system SHALL その文字を区切り文字として扱わず、選択肢全体を1つのチップとして表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 複数の希望エリアを選択する THEN the system SHALL CONTINUE TO 各エリアを個別のチップとして表示する

3.2 WHEN カンマや読点を含まない希望エリア（例：「①中学校（王子、碩田学園、大分西）」）を選択する THEN the system SHALL CONTINUE TO 1つのチップとして正しく表示する

3.3 WHEN 希望エリアのチェックボックスで選択・解除を行う THEN the system SHALL CONTINUE TO チップの追加・削除が正しく動作する

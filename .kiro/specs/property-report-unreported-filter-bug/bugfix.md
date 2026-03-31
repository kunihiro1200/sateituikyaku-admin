# Bugfix Requirements Document

## Introduction

物件リストの「報告」ページにおいて、報告日が設定されている物件（例：AA12636、報告日4/14）が「未報告」カテゴリーに誤って表示される問題を修正します。

根本原因は `frontend/frontend/src/utils/propertyListingStatusUtils.ts` の104-113行目の判定ロジックが逆になっていることです。現在のロジックは「報告日が設定されていて、かつ今日以前」→「未報告」と判定していますが、正しくは「報告日が未設定、または報告日が未来」→「未報告」と判定すべきです。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 報告日（report_date）が設定されていて、かつ報告日が今日以前である THEN システムは物件を「未報告」カテゴリーに表示する

1.2 WHEN 報告日が未設定（null）である THEN システムは物件を「未報告」カテゴリーに表示しない

### Expected Behavior (Correct)

2.1 WHEN 報告日（report_date）が未設定（null）である THEN システムは物件を「未報告」カテゴリーに表示する

2.2 WHEN 報告日が未来の日付である THEN システムは物件を「未報告」カテゴリーに表示する

2.3 WHEN 報告日が今日以前に設定されている THEN システムは物件を「未報告」カテゴリーに表示しない（報告済みとして扱う）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 報告日が今日以前に設定されている物件が「未報告」以外のカテゴリーに表示される場合 THEN システムはその表示を継続する

3.2 WHEN 報告担当者（report_assignee）が設定されている場合 THEN システムは「未報告{担当者名}」の形式でラベルを表示し続ける

3.3 WHEN 他のステータス判定ロジック（公開中、非公開など）が動作している場合 THEN システムはそれらのロジックを変更せずに動作し続ける

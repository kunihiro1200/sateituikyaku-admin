# 要件ドキュメント

## はじめに

売主リストの通話モードページ（`/sellers/:id/call`）において、コメント欄の隣に表示される「除外日に関する警告バナー」の表示ロジックを拡張する機能。

現在は「除外日にすること」ボタン（「除外日に不通であれば除外」「除外日になにもせず除外」）を押すと、赤枠・赤字・警告アイコン付きのバナーが常に表示される。

新機能として、「状況（当社）」フィールドの値に「除外」という文字が含まれる場合（例：「除外後追客中」「除外」など）は、既存の赤枠バナーを非表示にし、代わりに「状況（当社）」の値を赤字・赤枠なし・周囲と同じフォントサイズで表示する。

## 用語集

- **CallModePage**: 売主管理システムの通話モードページ（`/sellers/:id/call`）
- **ExclusionActionBanner**: 「除外日にすること」ボタン選択時に表示される赤枠・赤字・警告アイコン付きバナー
- **ExclusionStatusDisplay**: 「状況（当社）」に「除外」が含まれる場合に表示する赤字テキスト（赤枠なし）
- **exclusionAction**: 「除外日に不通であれば除外」または「除外日になにもせず除外」のいずれかの値を持つ状態変数
- **editedStatus**: 「状況（当社）」フィールドの現在値を保持する状態変数

## 要件

### 要件1：除外済み状態での既存バナー非表示

**ユーザーストーリー：** 担当者として、売主が既に除外済みの状態（「状況（当社）」に「除外」が含まれる）のときは、除外日アクションバナーを表示しないようにしたい。そうすることで、既に除外処理が完了していることを視覚的に明確に把握できる。

#### 受け入れ基準

1. WHEN `editedStatus` に「除外」という文字列が含まれる場合、THE CallModePage SHALL `exclusionAction` に値が設定されていても ExclusionActionBanner を表示しない
2. WHEN `editedStatus` に「除外」という文字列が含まれない場合、THE CallModePage SHALL 従来どおり `exclusionAction` の値に基づいて ExclusionActionBanner を表示する
3. THE CallModePage SHALL 「除外」の文字列判定に部分一致（`includes('除外')`）を使用する（例：「除外後追客中」「除外」「除外済み」など全て対象）

### 要件2：除外済み状態での代替テキスト表示

**ユーザーストーリー：** 担当者として、売主が除外済みの状態のときは、「状況（当社）」の値をコメント欄の隣に表示したい。そうすることで、現在の状況を一目で確認できる。

#### 受け入れ基準

1. WHEN `editedStatus` に「除外」という文字列が含まれる場合、THE CallModePage SHALL `editedStatus` の値をコメント欄の隣に表示する
2. THE ExclusionStatusDisplay SHALL 赤字（`color: 'error.main'`）で表示する
3. THE ExclusionStatusDisplay SHALL 赤枠なし（`border` プロパティなし）で表示する
4. THE ExclusionStatusDisplay SHALL 周囲のフォントと同じサイズ（`variant="body2"` 相当）で表示する
5. WHEN `editedStatus` に「除外」という文字列が含まれない場合、THE CallModePage SHALL ExclusionStatusDisplay を表示しない

### 要件3：表示の排他制御

**ユーザーストーリー：** 担当者として、ExclusionActionBanner と ExclusionStatusDisplay が同時に表示されないようにしたい。そうすることで、画面が混乱なく読みやすい状態を保てる。

#### 受け入れ基準

1. THE CallModePage SHALL ExclusionActionBanner と ExclusionStatusDisplay を同時に表示しない
2. WHEN `editedStatus` に「除外」が含まれる場合、THE CallModePage SHALL ExclusionStatusDisplay のみを表示する
3. WHEN `editedStatus` に「除外」が含まれない かつ `exclusionAction` に値がある場合、THE CallModePage SHALL ExclusionActionBanner のみを表示する
4. WHEN `editedStatus` に「除外」が含まれない かつ `exclusionAction` が空の場合、THE CallModePage SHALL どちらも表示しない

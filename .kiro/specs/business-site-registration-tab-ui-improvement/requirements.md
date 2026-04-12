# 要件定義書

## はじめに

本機能は、社内管理システム（sateituikyaku-admin）の業務詳細画面「サイト登録」タブに対して以下の3つのUI改善を行うものです。

1. **条件付き非表示**: 種別（`property_type`）が「土」以外の場合、特定の説明文と「道路寸法」フィールドを非表示にする
2. **フォントサイズ拡大**: 「【登録関係】」「【確認関係】」のラベルのフォントサイズを大きくする
3. **背景色による視覚的区別**: 各セクションに異なる背景色を付けて視覚的に区別しやすくする

対象ファイルは以下の通りです：
- フロントエンド: `frontend/frontend/src/components/WorkTaskDetailModal.tsx`

## 用語集

- **WorkTaskDetailModal**: 業務依頼リストの詳細モーダルコンポーネント（`WorkTaskDetailModal.tsx`）
- **SiteRegistrationSection**: WorkTaskDetailModal内のサイト登録タブを描画するコンポーネント
- **SectionHeader**: セクション見出しを表示するコンポーネント
- **RedNote**: 赤字の注意書きを表示するコンポーネント
- **property_type**: 種別に対応するDBカラム（例: 「土」「建物」など）
- **road_dimensions**: 「道路寸法」に対応するDBカラム
- **登録関係**: サイト登録タブの左側パネルのラベル（`【登録関係】`）
- **確認関係**: サイト登録タブの右側パネルのラベル（`【確認関係】`）
- **サイト登録依頼セクション**: `【サイト登録依頼】` ヘッダーを含むセクション
- **図面作成依頼セクション**: `【図面作成依頼】` ヘッダーを含むセクション
- **サイト登録確認セクション**: `【★サイト登録確認】` ヘッダーを含むセクション
- **図面確認セクション**: `【★図面確認】` ヘッダーを含むセクション
- **確認後処理セクション**: `【確認後処理】` ヘッダーを含むセクション

---

## 要件

### 要件1: 種別「土」以外の場合の条件付き非表示

**ユーザーストーリー:** 担当者として、種別が「土」以外の物件では不要な説明文と「道路寸法」フィールドを非表示にしたい。そうすることで、関係のない情報が表示されず、画面がすっきりして操作しやすくなる。

#### 受け入れ基準

1. WHEN `property_type` の値が「土」以外（または空）の場合、THE SiteRegistrationSection SHALL 「地積測量図や字図を格納→「リンク知っている人全員」の共有URLをスプシの「内覧前伝達事項」に貼り付ける」という説明文（RedNoteコンポーネント）を非表示にする
2. WHEN `property_type` の値が「土」以外（または空）の場合、THE SiteRegistrationSection SHALL 「道路寸法」フィールド（`road_dimensions`）を非表示にする
3. WHEN `property_type` の値が「土」の場合、THE SiteRegistrationSection SHALL 上記の説明文と「道路寸法」フィールドを表示する
4. THE SiteRegistrationSection SHALL `property_type` の値が変更された際に、リアルタイムで表示・非表示を切り替える

---

### 要件2: 「【登録関係】」「【確認関係】」のフォントサイズ拡大

**ユーザーストーリー:** 担当者として、「【登録関係】」「【確認関係】」のラベルを大きく表示したい。そうすることで、左右のパネルの区別が一目でわかり、操作ミスを減らせる。

#### 受け入れ基準

1. THE SiteRegistrationSection SHALL 「【登録関係】」ラベルのフォントサイズを現在の `subtitle2`（約14px）より大きいサイズ（`subtitle1` または `h6` 相当、16px以上）で表示する
2. THE SiteRegistrationSection SHALL 「【確認関係】」ラベルのフォントサイズを現在の `subtitle2`（約14px）より大きいサイズ（`subtitle1` または `h6` 相当、16px以上）で表示する
3. THE SiteRegistrationSection SHALL 「【登録関係】」ラベルの既存の色（`#1565c0`）と太字スタイルを維持する
4. THE SiteRegistrationSection SHALL 「【確認関係】」ラベルの既存の色（`#2e7d32`）と太字スタイルを維持する

---

### 要件3: セクションごとの背景色による視覚的区別

**ユーザーストーリー:** 担当者として、各セクションに異なる背景色を付けたい。そうすることで、どのセクションを操作しているかが視覚的に明確になり、作業効率が上がる。

#### 受け入れ基準

1. THE SiteRegistrationSection SHALL 「【サイト登録依頼】」を含むセクション（`SectionHeader label="【サイト登録依頼】"` から次のSectionHeaderまでの範囲）に背景色を適用する
2. THE SiteRegistrationSection SHALL 「【図面作成依頼】」を含むセクション（`SectionHeader label="【図面作成依頼】"` から次のSectionHeaderまでの範囲）に背景色を適用する
3. THE SiteRegistrationSection SHALL 「【★サイト登録確認】」セクション（`SectionHeader label="【★サイト登録確認】"` から次のSectionHeaderまでの範囲）に背景色を適用する
4. THE SiteRegistrationSection SHALL 「【★図面確認】」セクション（`SectionHeader label="【★図面確認】"` から次のSectionHeaderまでの範囲）に背景色を適用する
5. THE SiteRegistrationSection SHALL 「【確認後処理】」セクション（`SectionHeader label="【確認後処理】"` 以降の範囲）に背景色を適用する
6. THE SiteRegistrationSection SHALL 上記5つのセクションにそれぞれ異なる背景色を適用する（同じ色を使い回さない）
7. THE SiteRegistrationSection SHALL 背景色は薄い色調（透明度が高い、または淡いパステル系）を使用し、テキストの可読性を損なわない
8. THE SiteRegistrationSection SHALL 背景色の適用範囲はセクションヘッダーを含む全フィールドに及ぶ

---

## 実装上の注意事項

### 現在の実装状況

`WorkTaskDetailModal.tsx` の `SiteRegistrationSection` コンポーネントにおける現在の実装：

- 「地積測量図や字図を格納...」の説明文（RedNote）は現在 `property_type === '土'` の条件外に配置されており、常に表示されている
- 「道路寸法」フィールドは `【図面作成依頼】` セクション内に配置されており、常に表示されている
- 「【登録関係】」「【確認関係】」は `Typography variant="subtitle2"` で表示されている
- 各セクションには現在背景色が設定されていない

### 条件付き非表示の対象

要件1で非表示にする対象：
- `RedNote text={'地積測量図や字図を格納→「リンク知っている人全員」\nの共有URLをスプシの「内覧前伝達事項」に貼り付ける'}` コンポーネント
- `EditableField label="道路寸法" field="road_dimensions"` コンポーネント

### 背景色の推奨カラーパレット

各セクションに適用する背景色の例（実装時に調整可）：
- 【サイト登録依頼】: 薄い青系（例: `#e3f2fd`、`rgba(33, 150, 243, 0.08)`）
- 【図面作成依頼】: 薄い緑系（例: `#e8f5e9`、`rgba(76, 175, 80, 0.08)`）
- 【★サイト登録確認】: 薄い紫系（例: `#f3e5f5`、`rgba(156, 39, 176, 0.08)`）
- 【★図面確認】: 薄いオレンジ系（例: `#fff3e0`、`rgba(255, 152, 0, 0.08)`）
- 【確認後処理】: 薄いグレー系（例: `#fafafa`、`rgba(0, 0, 0, 0.04)`）

# 要件ドキュメント

## はじめに

業務リスト（WorkTasksPage）のサイドバーカテゴリーに対して、2つのUI改善を行う。

1. **グループ背景色の統一**: 同じカテゴリープレフィックスを持つ複数の締日エントリー（例：「サイト登録依頼してください 5/10」「サイト登録依頼してください 5/17」）を、視覚的に同一グループとして識別できるよう、グループ内で背景色を統一する。

2. **「サイト依頼済み納品待ち」への締日表示追加**: 現在、「サイト依頼済み納品待ち」カテゴリーには締日が表示されていないが、他のカテゴリーと同様に締日（`site_registration_deadline`）を表示する。

対象ファイル:
- `frontend/frontend/src/pages/WorkTasksPage.tsx`（サイドバーUI）
- `frontend/frontend/src/utils/workTaskStatusUtils.ts`（ステータス計算・カテゴリー定義）

## 用語集

- **WorkTasksPage**: 業務リストページ（`frontend/frontend/src/pages/WorkTasksPage.tsx`）
- **StatusCategory**: サイドバーに表示されるカテゴリーエントリー（`workTaskStatusUtils.ts`の`StatusCategory`型）
- **カテゴリープレフィックス**: ステータス文字列の先頭部分（例：「サイト登録依頼してください」「売買契約 依頼未」）
- **締日**: 各業務タスクの期限日（`site_registration_deadline`、`sales_contract_deadline`等）
- **グループ**: 同じカテゴリープレフィックスを持つ複数のStatusCategoryエントリーの集合
- **Sidebar**: WorkTasksPageの左側に表示されるカテゴリーリスト（MUI `List`コンポーネント）

---

## 要件

### 要件1: サイドバーカテゴリーのグループ背景色統一

**ユーザーストーリー:** 業務担当者として、同じカテゴリー（例：「サイト登録依頼してください」）に属する複数の締日エントリーが視覚的に同一グループとして識別できるようにしたい。そうすることで、どのエントリーが同じ業務種別に属するかを一目で把握できる。

#### 受け入れ基準

1. THE Sidebar SHALL グループ内の全エントリーに対して同一の背景色を適用する
2. WHEN 同じカテゴリープレフィックスを持つ複数のStatusCategoryエントリーが存在する場合、THE Sidebar SHALL それらのエントリーを同一グループとして扱い、同じ背景色を割り当てる
3. THE Sidebar SHALL 異なるカテゴリープレフィックスのグループに対して、視覚的に区別可能な異なる背景色を割り当てる
4. WHEN カテゴリープレフィックスが「サイト登録依頼してください」「売買契約 依頼未」「売買契約 入力待ち」「売買契約 製本待ち」「媒介作成_締日」「サイト依頼済み納品待ち」「サイト登録要確認」「売買契約　営業確認中」「決済完了チャット送信未」「入金確認未」「要台帳作成」「保留」のいずれかである場合、THE Sidebar SHALL そのプレフィックスに対応するグループ色を適用する
5. WHILE エントリーが選択状態（`Mui-selected`）である場合、THE Sidebar SHALL MUIのデフォルト選択スタイル（`action.selected`）を優先して表示する
6. THE Sidebar SHALL 「All」エントリーにはグループ背景色を適用しない（デフォルト背景色を維持する）
7. WHERE 締日が本日以前（`isDeadlinePast === true`）のエントリーが存在する場合、THE Sidebar SHALL グループ背景色に加えて、締日超過を示す視覚的な強調表示（例：テキスト色の変更）を適用する

### 要件2: 「サイト依頼済み納品待ち」カテゴリーへの締日表示追加

**ユーザーストーリー:** 業務担当者として、「サイト依頼済み納品待ち」カテゴリーにも締日の日付を表示してほしい。そうすることで、他のカテゴリーと同様に期限を一目で確認できる。

#### 受け入れ基準

1. WHEN `calculateTaskStatus`が「サイト依頼済み納品待ち」を返す場合、THE StatusCalculator SHALL `site_registration_deadline`の日付を`M/D`形式で末尾に付加したステータス文字列（例：「サイト依頼済み納品待ち 5/10」）を返す
2. WHEN `site_registration_deadline`が空または無効な日付である場合、THE StatusCalculator SHALL 日付なしで「サイト依頼済み納品待ち」のみを返す
3. THE Sidebar SHALL 「サイト依頼済み納品待ち」エントリーの`deadline`フィールドに`site_registration_deadline`から抽出した`M/D`形式の日付を設定する
4. WHEN 「サイト依頼済み納品待ち」の締日が本日以前である場合、THE Sidebar SHALL `isDeadlinePast`を`true`に設定する
5. THE Sidebar SHALL 「サイト依頼済み納品待ち」の締日が異なる複数のエントリーを、それぞれ独立したカテゴリーエントリーとして表示する（他の締日付きカテゴリーと同様の挙動）

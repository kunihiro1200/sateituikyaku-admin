# Requirements Document

## Introduction

買主詳細画面（BuyerDetailPage.tsx）および新規登録画面（NewBuyerPage.tsx）に、問合時の持家ヒアリングに関する3つのフィールドを追加する機能。スタッフが問合せ対応時に買主の持家状況をヒアリングし、査定提案の要否を判断するためのワークフローをUIで支援する。

対象フィールド：
- **問合時持家ヒアリング**（EG列 / `owned_home_hearing_inquiry`）
- **持家ヒアリング結果**（EH列 / `owned_home_hearing_result`）
- **要査定**（EJ列 / `valuation_required`）

これらのフィールドはスプレッドシートのEG・EH・EJ列に対応しており、既存のカラムマッピング（`buyer-column-mapping.json`）およびDBカラム定義（`buyers`テーブル）は既に存在している。

## Glossary

- **BuyerDetailPage**: 買主詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **NewBuyerPage**: 新規買主登録画面（`frontend/frontend/src/pages/NewBuyerPage.tsx`）
- **問合時持家ヒアリング**: 問合せ対応時に担当スタッフが持家ヒアリングを行ったかを記録するフィールド（EG列）
- **持家ヒアリング結果**: ヒアリングで確認した買主の住居状況（EH列）
- **要査定**: 持家（マンション）または持家（戸建）の場合に査定提案が必要かを記録するフィールド（EJ列）
- **通常スタッフ**: スタッフ管理シートで `通常=true` に設定されているスタッフ。イニシャルで識別される
- **ボタン選択UI**: `button-select-layout-rule.md` に定義されたレイアウト（横並び・均等幅）でボタンを並べる選択UI
- **インライン保存**: フィールド変更時に即座にDBおよびスプレッドシートへ同期する保存方式
- **GAS同期**: Google Apps Scriptによるスプレッドシート → DB の同期（既存の仕組み）
- **即時同期**: DB → スプレッドシートへの即時反映（既存の仕組み）

## Requirements

### Requirement 1: 問合時持家ヒアリングフィールドの追加

**User Story:** As a スタッフ, I want 問合せ対応時に持家ヒアリングを担当したスタッフを記録したい, so that 誰がヒアリングを行ったかを後から確認できる。

#### Acceptance Criteria

1. THE BuyerDetailPage SHALL 「問合せ内容」セクションに「問合時持家ヒアリング」フィールドを表示する
2. WHEN BuyerDetailPage が表示される, THE BuyerDetailPage SHALL `/api/employees/normal-initials` から取得した通常スタッフのイニシャル一覧をボタン選択UIで表示する
3. THE BuyerDetailPage SHALL `button-select-layout-rule.md` に定義されたレイアウト（ラベルとボタン群の横並び・均等幅・`flex: 1`）でボタンを表示する
4. WHEN スタッフが選択済みのボタンをクリックする, THE BuyerDetailPage SHALL 選択を解除して空文字を保存する（トグル動作）
5. WHEN スタッフがボタンを選択する, THE BuyerDetailPage SHALL `owned_home_hearing_inquiry` フィールドを即座にDBへ保存し、スプレッドシートEG列へ同期する
6. THE NewBuyerPage SHALL 「問合せ情報」セクションに「問合時持家ヒアリング」フィールドを同様のボタン選択UIで表示する
7. WHEN NewBuyerPage で新規登録が実行される, THE NewBuyerPage SHALL `owned_home_hearing_inquiry` の値を `POST /api/buyers` リクエストに含める

### Requirement 2: 持家ヒアリング結果フィールドの条件付き表示

**User Story:** As a スタッフ, I want 問合時持家ヒアリングに値が入力された場合のみ持家ヒアリング結果を入力したい, so that 不要なフィールドが表示されず画面がすっきりする。

#### Acceptance Criteria

1. WHEN `owned_home_hearing_inquiry` が空文字または未入力である, THE BuyerDetailPage SHALL 「持家ヒアリング結果」フィールドを非表示にする
2. WHEN `owned_home_hearing_inquiry` に値が入力されている, THE BuyerDetailPage SHALL 「持家ヒアリング結果」フィールドを表示する
3. THE BuyerDetailPage SHALL 「持家ヒアリング結果」フィールドを以下の4つの選択肢でボタン選択UIとして表示する：
   - `持家（マンション）`
   - `持家（戸建）`
   - `賃貸`
   - `他不明`
4. WHEN スタッフが「持家（マンション）」または「持家（戸建）」を選択する, THE BuyerDetailPage SHALL 選択ボタンの下に「机上査定を無料で行っていますがこの後メールで査定額差し上げましょうか？」というテキストを表示する
5. WHEN スタッフが「賃貸」または「他不明」を選択する, THE BuyerDetailPage SHALL 追加テキストを表示しない
6. WHEN スタッフがボタンを選択する, THE BuyerDetailPage SHALL `owned_home_hearing_result` フィールドを即座にDBへ保存し、スプレッドシートEH列へ同期する
7. THE NewBuyerPage SHALL 「問合せ情報」セクションに「持家ヒアリング結果」フィールドを同様の選択肢でボタン選択UIとして表示する（表示条件は問わない）
8. WHEN NewBuyerPage で新規登録が実行される, THE NewBuyerPage SHALL `owned_home_hearing_result` の値を `POST /api/buyers` リクエストに含める

### Requirement 3: 要査定フィールドの条件付き表示

**User Story:** As a スタッフ, I want 持家（マンション）または持家（戸建）が選択された場合のみ要査定フィールドを入力したい, so that 査定提案が必要な買主のみに対して要否を記録できる。

#### Acceptance Criteria

1. WHEN `owned_home_hearing_result` が「持家（マンション）」または「持家（戸建）」以外の値である, THE BuyerDetailPage SHALL 「要査定」フィールドを非表示にする
2. WHEN `owned_home_hearing_result` が「持家（マンション）」または「持家（戸建）」である, THE BuyerDetailPage SHALL 「要査定」フィールドを表示する
3. THE BuyerDetailPage SHALL 「要査定」フィールドを「要」「不要」の2つの選択肢でボタン選択UIとして表示する
4. WHEN スタッフがボタンを選択する, THE BuyerDetailPage SHALL `valuation_required` フィールドを即座にDBへ保存し、スプレッドシートEJ列へ同期する
5. THE NewBuyerPage SHALL 「問合せ情報」セクションに「要査定」フィールドを同様の選択肢でボタン選択UIとして表示する（表示条件は問わない）
6. WHEN NewBuyerPage で新規登録が実行される, THE NewBuyerPage SHALL `valuation_required` の値を `POST /api/buyers` リクエストに含める

### Requirement 4: スプレッドシートとDBの双方向同期

**User Story:** As a スタッフ, I want UIで入力した値がスプレッドシートに反映され、スプレッドシートで入力した値がUIに反映されてほしい, so that どちらの方法で入力しても一貫したデータを参照できる。

#### Acceptance Criteria

1. WHEN BuyerDetailPage でフィールドが保存される, THE BuyerDetailPage SHALL `buyerApi.update()` の `sync: true` オプションを使用してスプレッドシートEG・EH・EJ列へ即時同期する
2. WHEN GASの定期同期が実行される, THE System SHALL スプレッドシートのEG列（問合時持家ヒアリング）をDBの `owned_home_hearing_inquiry` カラムへ同期する
3. WHEN GASの定期同期が実行される, THE System SHALL スプレッドシートのEH列（持家ヒアリング結果）をDBの `owned_home_hearing_result` カラムへ同期する
4. WHEN GASの定期同期が実行される, THE System SHALL スプレッドシートのEJ列（要査定）をDBの `valuation_required` カラムへ同期する
5. THE System SHALL 既存の `buyer-column-mapping.json` に定義されたマッピング（`問合時持家ヒアリング` → `owned_home_hearing_inquiry`、`持家ヒアリング結果` → `owned_home_hearing_result`、`要査定` → `valuation_required`）を利用する

### Requirement 5: ボタン選択UIのレイアウト準拠

**User Story:** As a スタッフ, I want 新しいフィールドが既存のボタン選択UIと同じレイアウトで表示されてほしい, so that 画面の一貫性が保たれ操作しやすい。

#### Acceptance Criteria

1. THE BuyerDetailPage SHALL 3つの新規フィールドのボタン選択UIを `button-select-layout-rule.md` のルールに従って実装する（ラベルとボタン群の横並び、ボタン群コンテナに `flex: 1`、各ボタンに `flex: 1`、ラベルに `whiteSpace: 'nowrap'` + `flexShrink: 0`）
2. THE BuyerDetailPage SHALL 選択済みのボタンを `variant="contained"` で、未選択のボタンを `variant="outlined"` で表示する
3. THE BuyerDetailPage SHALL 選択済みのボタンのフォントウェイトを `bold` にする
4. IF 通常スタッフのイニシャル一覧の取得に失敗する, THEN THE BuyerDetailPage SHALL 問合時持家ヒアリングフィールドを空のボタン群として表示し、エラーをコンソールに記録する

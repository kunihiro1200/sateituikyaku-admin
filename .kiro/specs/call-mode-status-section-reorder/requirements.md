# Requirements Document

## Introduction

通話モードページにおいて、「状況（当社）」フィールドの値に応じて、ステータスセクションとコメントセクションの表示順序を動的に変更する機能を実装します。

## Glossary

- **System**: 通話モードページ（CallModePage）
- **Status_Section**: ステータスセクション（📊 ステータス）
- **Comment_Section**: コメントセクション（コメント入力・編集エリア）
- **Current_Status_Field**: 「状況（当社）」フィールド（editedStatus）
- **Target_Status_Values**: "一般媒介"、"専任媒介"、"他決"を含む状況値

## Requirements

### Requirement 1: ステータスセクションとコメントセクションの動的配置

**User Story:** As a 営業担当者, I want ステータスセクションとコメントセクションの表示順序が「状況（当社）」の値に応じて自動的に変更される, so that 重要な情報を優先的に確認できる

#### Acceptance Criteria

1. WHEN Current_Status_Field に "一般媒介" が含まれる, THE System SHALL Comment_Section の上に Status_Section を配置する
2. WHEN Current_Status_Field に "専任媒介" が含まれる, THE System SHALL Comment_Section の上に Status_Section を配置する
3. WHEN Current_Status_Field に "他決" が含まれる, THE System SHALL Comment_Section の上に Status_Section を配置する
4. WHEN Current_Status_Field が上記以外の値である, THE System SHALL Status_Section の上に Comment_Section を配置する（デフォルト順序）
5. WHEN Current_Status_Field の値が変更される, THE System SHALL 即座にセクションの表示順序を更新する

### Requirement 2: レイアウト変更の視覚的フィードバック

**User Story:** As a 営業担当者, I want レイアウトが変更されたことを視覚的に認識できる, so that 混乱せずに操作を続けられる

#### Acceptance Criteria

1. WHEN セクションの表示順序が変更される, THE System SHALL スムーズなアニメーション効果を適用する
2. THE System SHALL 各セクションの見出しとスタイルを維持する
3. THE System SHALL レイアウト変更後もスクロール位置を適切に調整する

### Requirement 3: 既存機能の保持

**User Story:** As a 営業担当者, I want レイアウト変更機能が追加されても既存の機能が正常に動作する, so that 業務に支障が出ない

#### Acceptance Criteria

1. THE System SHALL コメント保存機能を正常に動作させる
2. THE System SHALL ステータス保存機能を正常に動作させる
3. THE System SHALL 不通フィールドの保存機能を正常に動作させる
4. THE System SHALL 1番電話フィールドの保存機能を正常に動作させる
5. THE System SHALL 全ての入力フィールドの状態を正しく管理する

### Requirement 4: レスポンシブ対応

**User Story:** As a 営業担当者, I want モバイル端末でもレイアウト変更機能が正常に動作する, so that 外出先でも効率的に作業できる

#### Acceptance Criteria

1. WHEN デバイスがモバイル端末である, THE System SHALL アコーディオン形式でセクションを表示する
2. WHEN デバイスがモバイル端末である, THE System SHALL セクションの表示順序を「状況（当社）」の値に応じて変更する
3. THE System SHALL モバイル端末でもスムーズなアニメーション効果を適用する

### Requirement 5: パフォーマンス

**User Story:** As a 営業担当者, I want レイアウト変更が即座に反映される, so that ストレスなく作業できる

#### Acceptance Criteria

1. WHEN Current_Status_Field の値が変更される, THE System SHALL 100ミリ秒以内にレイアウトを更新する
2. THE System SHALL レイアウト変更時にページ全体の再レンダリングを避ける
3. THE System SHALL useMemoを使用して不要な再計算を防ぐ

## 対象となる「状況（当社）」の値

以下の値が含まれる場合、ステータスセクションをコメントセクションの上に配置します：

1. "一般媒介"
2. "専任媒介"
3. "他決→追客"
4. "他決→追客不要"
5. "他決→専任"
6. "他決→一般"
7. "リースバック（専任）"
8. "専任→他社専任"
9. "一般→他決"

## デフォルトの表示順序

上記以外の値の場合、以下の順序で表示します（現在の実装）：

1. コメントセクション
2. 不通フィールド
3. 1番電話フィールド
4. 査定理由フィールド
5. ステータスセクション

## 変更後の表示順序（対象ステータスの場合）

1. ステータスセクション
2. コメントセクション
3. 不通フィールド
4. 1番電話フィールド
5. 査定理由フィールド

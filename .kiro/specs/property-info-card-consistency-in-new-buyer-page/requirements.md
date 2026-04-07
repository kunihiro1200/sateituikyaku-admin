# Requirements Document

## Introduction

買主新規作成ページ（NewBuyerPage）の物件情報表示を、買主詳細ページ（BuyerDetailPage）と同じ形式に統一する機能です。現在、NewBuyerPageでは独自の物件情報表示を実装していますが、BuyerDetailPageで使用されている`PropertyInfoCard`コンポーネントに置き換えることで、表示の一貫性を保ち、ステータス（atbb_status）と配信日（distribution_date）を表示できるようにします。

## Glossary

- **NewBuyerPage**: 買主新規作成ページ（`frontend/frontend/src/pages/NewBuyerPage.tsx`）
- **BuyerDetailPage**: 買主詳細ページ（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **PropertyInfoCard**: 物件情報を表示する共通コンポーネント（`frontend/frontend/src/components/PropertyInfoCard.tsx`）
- **atbb_status**: 物件のステータス（「専任・公開中」「一般・公開中」等）
- **distribution_date**: 配信日
- **property_number**: 物件番号

## Requirements

### Requirement 1: PropertyInfoCardコンポーネントの統合

**User Story:** As a ユーザー, I want NewBuyerPageの物件情報表示がBuyerDetailPageと同じ形式になること, so that 一貫性のあるUIで物件情報を確認できる

#### Acceptance Criteria

1. WHEN NewBuyerPageで物件番号が入力されている, THE NewBuyerPage SHALL PropertyInfoCardコンポーネントを使用して物件情報を表示する
2. WHEN PropertyInfoCardが表示される, THE PropertyInfoCard SHALL atbb_statusフィールドを表示する
3. WHEN PropertyInfoCardが表示される, THE PropertyInfoCard SHALL distribution_dateフィールドを表示する
4. WHEN 物件番号が空の場合, THE NewBuyerPage SHALL 物件情報カードを表示しない
5. WHEN 物件情報の取得に失敗した場合, THE PropertyInfoCard SHALL エラーメッセージを表示する

### Requirement 2: 既存の物件情報表示の削除

**User Story:** As a 開発者, I want NewBuyerPageの独自実装された物件情報表示を削除すること, so that コードの重複を避け、メンテナンス性を向上させる

#### Acceptance Criteria

1. WHEN PropertyInfoCardコンポーネントが統合される, THE NewBuyerPage SHALL 独自実装された物件情報表示コードを削除する
2. WHEN 独自実装が削除される, THE NewBuyerPage SHALL PropertyInfo interfaceを削除する
3. WHEN 独自実装が削除される, THE NewBuyerPage SHALL fetchPropertyInfo関数を削除する
4. WHEN 独自実装が削除される, THE NewBuyerPage SHALL propertyInfo stateを削除する
5. WHEN 独自実装が削除される, THE NewBuyerPage SHALL loadingProperty stateを削除する

### Requirement 3: レイアウトの維持

**User Story:** As a ユーザー, I want NewBuyerPageの既存のレイアウトが維持されること, so that 使い慣れた画面構成で作業を続けられる

#### Acceptance Criteria

1. WHEN PropertyInfoCardが統合される, THE NewBuyerPage SHALL 物件情報カードを左側（Grid item xs={12} md={5}）に配置する
2. WHEN PropertyInfoCardが統合される, THE NewBuyerPage SHALL 買主入力フォームを右側（Grid item xs={12} md={7}）に配置する
3. WHEN PropertyInfoCardが統合される, THE NewBuyerPage SHALL 物件詳細リンクボタンをPropertyInfoCard内に表示する
4. WHEN PropertyInfoCardが統合される, THE NewBuyerPage SHALL 買付状況バッジをPropertyInfoCard内に表示する
5. WHEN PropertyInfoCardが統合される, THE NewBuyerPage SHALL sticky positioningを維持する

### Requirement 4: 物件番号入力フィールドの統合

**User Story:** As a ユーザー, I want 物件番号入力フィールドがPropertyInfoCardの外に配置されること, so that 物件番号を変更しやすい

#### Acceptance Criteria

1. WHEN PropertyInfoCardが統合される, THE NewBuyerPage SHALL 物件番号入力フィールドをPropertyInfoCardの上部に配置する
2. WHEN 物件番号が入力される, THE NewBuyerPage SHALL PropertyInfoCardに物件番号を渡す
3. WHEN 物件番号が変更される, THE PropertyInfoCard SHALL 新しい物件情報を取得して表示する
4. WHEN 物件番号が空になる, THE NewBuyerPage SHALL PropertyInfoCardを非表示にする

### Requirement 5: 閉じるボタンの非表示

**User Story:** As a ユーザー, I want NewBuyerPageのPropertyInfoCardに閉じるボタンが表示されないこと, so that 誤って物件情報を閉じることを防ぐ

#### Acceptance Criteria

1. WHEN PropertyInfoCardがNewBuyerPageで使用される, THE PropertyInfoCard SHALL showCloseButton propをfalseに設定する
2. WHEN showCloseButtonがfalseの場合, THE PropertyInfoCard SHALL 閉じるボタンを表示しない
3. WHEN PropertyInfoCardがBuyerDetailPageで使用される, THE PropertyInfoCard SHALL showCloseButton propをtrueに設定する（既存の動作を維持）

### Requirement 6: 後方互換性の維持

**User Story:** As a 開発者, I want PropertyInfoCardコンポーネントの既存の動作が維持されること, so that BuyerDetailPageや他のページに影響を与えない

#### Acceptance Criteria

1. WHEN PropertyInfoCardが変更される, THE PropertyInfoCard SHALL BuyerDetailPageでの表示が変わらない
2. WHEN PropertyInfoCardが変更される, THE PropertyInfoCard SHALL 既存のpropsインターフェースを維持する
3. WHEN PropertyInfoCardが変更される, THE PropertyInfoCard SHALL 既存の機能（物件詳細リンク、コピー機能等）を維持する

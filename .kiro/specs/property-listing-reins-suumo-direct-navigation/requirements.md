# Requirements Document

## Introduction

物件リストページのサイドバーで「レインズ登録＋SUUMO登録」カテゴリの案件をクリックした際、通常の物件詳細ページではなく、直接「レインズ登録・サイト入力」ページに遷移する機能です。この機能により、レインズ登録作業の効率が向上し、作業者は余計なクリックを省略できます。

## Glossary

- **物件リストページ**: 物件の一覧を表示するページ（`/property-listings`）
- **サイドバーカテゴリ**: 物件リストページの左側に表示されるステータスフィルター
- **レインズ登録＋SUUMO登録**: サイドバーカテゴリの1つで、レインズ登録とSUUMO登録が必要な物件を表示するカテゴリ
- **物件詳細ページ**: 物件の詳細情報を表示・編集するページ（`/property-listings/:propertyNumber`）
- **レインズ登録・サイト入力ページ**: レインズ証明書メール送信やサイト入力状況を管理するページ（`/property-listings/:propertyNumber/reins-registration`）
- **PropertyListingsPage**: 物件リストページのReactコンポーネント（`frontend/frontend/src/pages/PropertyListingsPage.tsx`）
- **handleRowClick**: 物件リストの行をクリックした際に実行される関数

## Requirements

### Requirement 1: 「レインズ登録＋SUUMO登録」カテゴリ選択時の直接遷移

**User Story:** レインズ登録作業者として、「レインズ登録＋SUUMO登録」カテゴリの案件をクリックしたら、直接「レインズ登録・サイト入力」ページに遷移したい。これにより、物件詳細ページを経由せずに作業を開始できる。

#### Acceptance Criteria

1. WHEN サイドバーで「レインズ登録＋SUUMO登録」カテゴリが選択されている状態で物件をクリックした場合、THE System SHALL `/property-listings/:propertyNumber/reins-registration` に直接遷移する

2. WHEN サイドバーで「レインズ登録＋SUUMO登録」以外のカテゴリが選択されている状態で物件をクリックした場合、THE System SHALL 従来通り `/property-listings/:propertyNumber` に遷移する

3. WHEN サイドバーでカテゴリが選択されていない状態（「全て」または検索のみ）で物件をクリックした場合、THE System SHALL 従来通り `/property-listings/:propertyNumber` に遷移する

4. WHEN 「レインズ登録＋SUUMO登録」カテゴリから直接遷移した場合、THE System SHALL 物件リストページの状態（ページ番号、検索クエリ、選択中のカテゴリ）を保持する

5. WHEN 「レインズ登録・サイト入力」ページから「物件リストに戻る」ボタンをクリックした場合、THE System SHALL 保持された状態で物件リストページに戻る

### Requirement 2: 既存の「未報告」カテゴリの動作を維持

**User Story:** システム管理者として、既存の「未報告」カテゴリの直接遷移機能が正常に動作し続けることを確認したい。これにより、新機能が既存機能に影響を与えないことを保証できる。

#### Acceptance Criteria

1. WHEN サイドバーで「未報告」カテゴリが選択されている状態で物件をクリックした場合、THE System SHALL 従来通り `/property-listings/:propertyNumber/report` に直接遷移する

2. WHEN 「未報告」カテゴリと「レインズ登録＋SUUMO登録」カテゴリの両方が存在する場合、THE System SHALL それぞれ独立して正しい遷移先に遷移する

### Requirement 3: モバイル環境での動作

**User Story:** モバイルユーザーとして、「レインズ登録＋SUUMO登録」カテゴリの案件をタップしたら、デスクトップと同様に直接「レインズ登録・サイト入力」ページに遷移したい。

#### Acceptance Criteria

1. WHEN モバイル環境でサイドバーアコーディオンから「レインズ登録＋SUUMO登録」カテゴリを選択し、物件カードをタップした場合、THE System SHALL `/property-listings/:propertyNumber/reins-registration` に直接遷移する

2. WHEN モバイル環境で「レインズ登録・サイト入力」ページから戻る場合、THE System SHALL デスクトップと同様に物件リストページの状態を保持する

### Requirement 4: ログ出力とデバッグ

**User Story:** 開発者として、遷移ロジックが正しく動作していることをログで確認したい。これにより、問題が発生した際に迅速にデバッグできる。

#### Acceptance Criteria

1. WHEN 物件をクリックした場合、THE System SHALL コンソールに遷移先のパスをログ出力する

2. WHEN 「レインズ登録＋SUUMO登録」カテゴリが選択されている場合、THE System SHALL コンソールに「レインズ登録ページへ直接遷移」というメッセージをログ出力する

3. WHEN 「未報告」カテゴリが選択されている場合、THE System SHALL コンソールに「報告ページへ直接遷移」というメッセージをログ出力する

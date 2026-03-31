# Requirements Document

## Introduction

物件リスト詳細画面（PropertyListingDetailPage）のUIを改善し、ユーザビリティを向上させる機能です。具体的には、不要な「物件詳細」ラベルを削除し、物件番号を物件概要の右側に配置してクリック1回でコピーできるようにします。

## Glossary

- **PropertyListingDetailPage**: 物件リスト詳細画面（`/property-listings/:propertyNumber`）
- **物件番号**: 物件を一意に識別する番号（例: AA13501）
- **物件概要セクション**: 物件の基本情報（所在地、売買価格、営業担当）を表示するセクション
- **PropertyHeaderInfo**: 物件概要セクションを表示するコンポーネント

## Requirements

### Requirement 1: 「物件詳細」ラベルの削除

**User Story:** As a ユーザー, I want 「物件詳細」というラベルを削除したい, so that 画面がすっきりして見やすくなる

#### Acceptance Criteria

1. THE PropertyListingDetailPage SHALL 「物件詳細 - {物件番号}」というテキストを表示しない
2. THE PropertyListingDetailPage SHALL 物件番号のみを表示する（「物件詳細 -」の部分を削除）
3. WHEN ユーザーが物件リスト詳細画面を開く, THE PropertyListingDetailPage SHALL 「物件詳細」というラベルなしで物件番号を表示する

### Requirement 2: 物件番号の配置変更とコピー機能

**User Story:** As a ユーザー, I want 物件番号を物件概要の右側に配置し、クリック1回でコピーできるようにしたい, so that 物件番号を簡単にコピーして他の場所に貼り付けられる

#### Acceptance Criteria

1. THE PropertyHeaderInfo SHALL 物件番号を物件概要セクションの右側に表示する
2. WHEN ユーザーが物件番号をクリックする, THE PropertyHeaderInfo SHALL 物件番号をクリップボードにコピーする
3. WHEN 物件番号がコピーされる, THE PropertyHeaderInfo SHALL 「コピーしました」というフィードバックを表示する
4. THE PropertyHeaderInfo SHALL 物件番号にコピーアイコンを表示する
5. WHEN ユーザーが物件番号にマウスオーバーする, THE PropertyHeaderInfo SHALL 「物件番号をコピー」というツールチップを表示する
6. WHEN 物件番号がコピーされた後, THE PropertyHeaderInfo SHALL チェックアイコンを表示する（2秒間）
7. WHEN 2秒経過する, THE PropertyHeaderInfo SHALL コピーアイコンに戻る

### Requirement 3: レスポンシブ対応

**User Story:** As a ユーザー, I want モバイル端末でも物件番号を簡単にコピーできるようにしたい, so that スマートフォンでも快適に操作できる

#### Acceptance Criteria

1. WHEN ユーザーがモバイル端末で物件リスト詳細画面を開く, THE PropertyHeaderInfo SHALL 物件番号を適切なサイズで表示する
2. WHEN ユーザーがモバイル端末で物件番号をタップする, THE PropertyHeaderInfo SHALL 物件番号をクリップボードにコピーする
3. THE PropertyHeaderInfo SHALL モバイル端末でもコピーアイコンとツールチップを表示する

### Requirement 4: アクセシビリティ対応

**User Story:** As a スクリーンリーダーを使用するユーザー, I want 物件番号のコピー機能を音声で理解できるようにしたい, so that 視覚障害があっても物件番号をコピーできる

#### Acceptance Criteria

1. THE PropertyHeaderInfo SHALL 物件番号のコピーボタンに`aria-label="物件番号をコピー"`属性を設定する
2. WHEN 物件番号がコピーされる, THE PropertyHeaderInfo SHALL スクリーンリーダーに「物件番号をコピーしました」と通知する
3. THE PropertyHeaderInfo SHALL キーボード操作（Enterキー）で物件番号をコピーできるようにする

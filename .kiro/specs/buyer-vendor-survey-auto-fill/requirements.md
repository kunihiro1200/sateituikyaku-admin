# 要件ドキュメント

## はじめに

買主詳細画面において、「業者向けアンケート」（`vendor_survey`）フィールドに値が入力された場合、「３回架電確認済み」（`three_calls_confirmed`）フィールドを自動的に"他"にセットする機能を追加する。

業者問合せの場合、通常の架電フローが不要なため、業者向けアンケートへの入力をトリガーとして架電確認フィールドを適切な値に自動設定することで、入力漏れを防ぎ業務効率を向上させる。

## 用語集

- **BuyerDetailPage**: 買主詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **vendor_survey**: 「業者向けアンケート」フィールド（DBカラム名）
- **three_calls_confirmed**: 「３回架電確認済み」フィールド（DBカラム名）
- **sectionChangedFields**: セクション内の変更フィールドを管理するstate
- **handleFieldChange**: フィールド変更を検知するハンドラー関数

## 要件

### 要件1: 業者向けアンケート入力時の自動入力

**ユーザーストーリー:** 担当者として、業者向けアンケートに値を入力したとき、３回架電確認済みが自動的に"他"にセットされることで、手動入力の手間を省きたい。

#### 受け入れ基準

1. WHEN `vendor_survey` フィールドに空でない値が入力された場合、THE BuyerDetailPage SHALL `three_calls_confirmed` フィールドの値を"他"に自動セットする
2. WHEN `vendor_survey` フィールドが空文字またはクリアされた場合、THE BuyerDetailPage SHALL `three_calls_confirmed` フィールドの自動セットを行わない（既存値を維持する）
3. WHEN `vendor_survey` への入力により `three_calls_confirmed` が自動セットされた場合、THE BuyerDetailPage SHALL 自動セットされた値を保存対象の変更フィールド（`sectionChangedFields`）に含める
4. WHEN `three_calls_confirmed` がすでに値を持っている場合でも、THE BuyerDetailPage SHALL `vendor_survey` に値が入力されたとき `three_calls_confirmed` を"他"に上書きする

### 要件2: 自動入力の画面反映

**ユーザーストーリー:** 担当者として、自動入力された値が画面上でも即座に反映されることで、入力状態を確認できるようにしたい。

#### 受け入れ基準

1. WHEN `vendor_survey` への入力により `three_calls_confirmed` が自動セットされた場合、THE BuyerDetailPage SHALL 画面上の `three_calls_confirmed` フィールドに"他"を即座に表示する
2. WHEN `three_calls_confirmed` が自動セットされた場合、THE BuyerDetailPage SHALL セクションの保存ボタンをアクティブ（dirty状態）にする

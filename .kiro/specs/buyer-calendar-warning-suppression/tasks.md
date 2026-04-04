# Implementation Plan: buyer-calendar-warning-suppression

## Overview

買主内覧結果ページにおいて、`notification_sender`フィールドの入力状態に基づいてカレンダー登録警告を抑制する機能を実装します。`needsCalendar`ロジックに1行の条件を追加するだけのシンプルな修正です。

## Tasks

- [x] 1. needsCalendarロジックの修正
  - `frontend/frontend/src/pages/BuyerViewingResultPage.tsx`のlines 243-248を修正
  - `&& !buyer?.notification_sender`条件を追加
  - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.2, 5.3_

- [ ] 2. 動作確認
  - [ ] 2.1 買主7282（notification_senderあり）で警告が出ないことを確認
    - 内覧結果ページを開く
    - 別のページに遷移しようとする
    - 警告ダイアログが表示されないことを確認
    - _Requirements: 1.1, 2.3, 3.2_
  
  - [ ] 2.2 買主7283（notification_senderなし）で警告が出ることを確認
    - 内覧結果ページを開く
    - 内覧日・時間・後続担当が設定されていることを確認
    - 別のページに遷移しようとする
    - 警告ダイアログが表示されることを確認
    - _Requirements: 4.1_
  
  - [ ] 2.3 ページリロード後の動作確認
    - 買主7282のページをリロード
    - 別のページに遷移しようとする
    - 警告ダイアログが表示されないことを確認
    - _Requirements: 3.1, 3.2, 3.3_

## Notes

- 修正箇所は1箇所のみ（1行の追加）
- 既存ロジックへの影響なし
- データベースマイグレーション不要（`notification_sender`カラムは既に存在）
- デプロイ後、即座に動作確認可能

# Implementation Plan: property-listing-reins-suumo-direct-navigation

## Overview

物件リストページで「レインズ登録＋SUUMO登録」カテゴリが選択されている状態で物件をクリックした際、直接「レインズ登録・サイト入力」ページに遷移する機能を実装します。既存の「未報告」カテゴリの直接遷移機能と同様のパターンを採用し、一貫性のあるユーザー体験を提供します。

## Tasks

- [x] 1. PropertyListingsPageの遷移ロジックを修正
  - `handleRowClick()` メソッドに「レインズ登録＋SUUMO登録」カテゴリの判定を追加
  - `sessionStorage`への状態保存を全ての遷移パターンで共通化（最初に実行）
  - 遷移先の優先順位: 「未報告」→「レインズ登録＋SUUMO登録」→その他
  - ログ出力を追加（デバッグ用）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 3.1, 4.1, 4.2_

- [ ]* 1.1 Write property test for navigation path correctness
  - **Property 1: カテゴリ別遷移先の正確性**
  - **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 3.1**
  - fast-checkを使用して、物件番号とサイドバーステータスの組み合わせで遷移先が正しいことを検証
  - 最低100回実行

- [ ]* 1.2 Write property test for state preservation round-trip
  - **Property 2: 状態保持のラウンドトリップ**
  - **Validates: Requirements 1.4, 1.5, 3.2**
  - fast-checkを使用して、sessionStorageへの保存と復元が正しく動作することを検証
  - 最低100回実行

- [ ]* 1.3 Write unit tests for handleRowClick method
  - 「レインズ登録＋SUUMO登録」カテゴリでの遷移テスト
  - 「未報告」カテゴリでの遷移テスト（回帰テスト）
  - その他のカテゴリでの遷移テスト
  - カテゴリ未選択時の遷移テスト
  - sessionStorageへの状態保存テスト
  - ログ出力の確認テスト
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 3.1, 4.1, 4.2, 4.3_

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- タスク1は既存の`handleRowClick()`メソッドの修正のみで完結します
- 新しいコンポーネントやルートの追加は不要です（既に存在）
- 「未報告」カテゴリの既存機能を維持しながら、新しいカテゴリの遷移ロジックを追加します
- タスクに`*`が付いているものはオプションで、スキップ可能です

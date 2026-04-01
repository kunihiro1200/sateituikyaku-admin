# 実装計画：通話モードページのステータスセクション配置変更機能

## Overview

通話モードページにおいて、「状況（当社）」フィールドの値に応じて、ステータスセクション（📊 ステータス）とコメントセクション（コメント入力・編集エリア）の表示順序を動的に変更する機能を実装します。

## Tasks

- [x] 1. useMemoの実装
  - `shouldShowStatusFirst` useMemoを実装
  - 対象ステータス値のリスト（9つ）を定義
  - `seller?.status` と `editedStatus` を依存配列に含める
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. デスクトップ版のレンダリングロジック実装
  - [x] 2.1 右側カラムのセクション順序を条件分岐で実装
    - `shouldShowStatusFirst` が `true` の場合：ステータスセクション → コメントセクション
    - `shouldShowStatusFirst` が `false` の場合：コメントセクション → ステータスセクション
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2_
  
  - [ ]* 2.2 Property 1のプロパティベーステストを実装
    - **Property 1: ステータス値に応じた表示順序の決定**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
    - fast-checkを使用して任意の文字列で100回テスト
    - 対象ステータスを含む場合は `shouldShowStatusFirst === true`
    - それ以外の場合は `shouldShowStatusFirst === false`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3. モバイル版のレンダリングロジック実装
  - [x] 3.1 アコーディオン形式のセクション順序を条件分岐で実装
    - `shouldShowStatusFirst` が `true` の場合：ステータスアコーディオン → コメントアコーディオン
    - `shouldShowStatusFirst` が `false` の場合：コメントアコーディオン → ステータスアコーディオン
    - _Requirements: 4.1, 4.2_
  
  - [ ]* 3.2 Property 5のプロパティベーステストを実装
    - **Property 5: モバイル端末での表示順序変更**
    - **Validates: Requirements 4.1, 4.2**
    - モバイル判定（`useMediaQuery`）とステータス値の組み合わせをテスト
    - _Requirements: 4.1, 4.2_

- [x] 4. Checkpoint - 基本実装の確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. 単体テストの実装
  - [ ] 5.1 対象ステータス値の判定テストを実装
    - "一般媒介" → `shouldShowStatusFirst === true`
    - "専任媒介" → `shouldShowStatusFirst === true`
    - "他決→追客" → `shouldShowStatusFirst === true`
    - "追客中" → `shouldShowStatusFirst === false`
    - 空文字列 → `shouldShowStatusFirst === false`
    - undefined → `shouldShowStatusFirst === false`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [ ]* 5.2 部分一致の判定テストを実装
    - "他決→追客不要" → `shouldShowStatusFirst === true`
    - "専任媒介（訪問後）" → `shouldShowStatusFirst === true`
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [ ]* 5.3 モバイル判定テストを実装
    - `isMobile === true` かつ対象ステータス → アコーディオンの順序が正しい
    - `isMobile === false` かつ対象ステータス → Gridの順序が正しい
    - _Requirements: 4.1, 4.2_
  
  - [ ]* 5.4 既存機能の動作確認テストを実装
    - コメント保存APIが正常に呼び出される
    - ステータス保存APIが正常に呼び出される
    - _Requirements: 3.1, 3.2_

- [ ] 6. プロパティベーステストの実装
  - [ ]* 6.1 Property 2のプロパティベーステストを実装
    - **Property 2: ステータス変更時の即座の更新**
    - **Validates: Requirements 1.5**
    - 変更前と変更後のステータス値で再計算が正しく行われることを検証
    - _Requirements: 1.5_
  
  - [ ]* 6.2 Property 4のプロパティベーステストを実装
    - **Property 4: 既存機能の正常動作**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
    - 表示順序に関係なく保存機能が正常に動作することを検証
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- タスク5と6（テスト関連）は `*` マークが付いており、オプションとして扱われます
- 各タスクは具体的な要件番号を参照しており、トレーサビリティを確保しています
- Checkpointタスクで段階的に検証を行い、問題があれば早期に発見できます
- プロパティベーステストは fast-check ライブラリを使用し、最低100回の反復実行を行います
- 実装言語はTypeScriptです（設計書に基づく）

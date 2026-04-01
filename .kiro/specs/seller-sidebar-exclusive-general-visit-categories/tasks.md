# Implementation Plan: 売主サイドバー専任・一般・訪問後他決カテゴリー追加

## Overview

売主リストページのサイドバーに、専任媒介・一般媒介・訪問後他決の3つの新しいステータスカテゴリーを追加します。既存のサイドバーアーキテクチャを活用し、`seller_sidebar_counts`キャッシュテーブルを使用してパフォーマンスを最適化します。

## Tasks

- [x] 1. フロントエンドの型定義とフィルタリング関数を実装
  - [x] 1.1 StatusCategory型とCategoryCounts型を拡張
    - `frontend/frontend/src/utils/sellerStatusFilters.ts`に`exclusive`、`general`、`visitOtherDecision`を追加
    - `CategoryCounts`インターフェースに3つの新しいカウントフィールドを追加
    - _Requirements: 1.1, 2.1, 3.1_
  
  - [x] 1.2 専任カテゴリーのフィルタリング関数を実装
    - `isExclusive()`関数を実装（専任他決打合せ、次電日、状況の条件チェック）
    - 日付比較に`isTodayOrBefore()`ヘルパー関数を使用
    - _Requirements: 1.2_
  
  - [x] 1.3 一般カテゴリーのフィルタリング関数を実装
    - `isGeneral()`関数を実装（専任他決打合せ、次電日、状況、契約年月の条件チェック）
    - 契約年月の日付正規化と比較ロジックを実装
    - _Requirements: 2.2_
  
  - [x] 1.4 訪問後他決カテゴリーのフィルタリング関数を実装
    - `isVisitOtherDecision()`関数を実装（専任他決打合せ、次電日、状況、営担の条件チェック）
    - 営担の空文字列と「外す」の除外ロジックを実装
    - _Requirements: 3.2_
  
  - [ ]* 1.5 フィルタリング関数の単体テストを作成
    - `frontend/frontend/src/utils/__tests__/sellerStatusFilters.test.ts`に各関数のテストを追加
    - 専任・一般・訪問後他決の判定ロジックをテスト
    - エッジケース（空文字列、null、日付境界値）をテスト
    - _Requirements: 1.2, 2.2, 3.2_

- [x] 2. サイドバーUIコンポーネントを更新
  - [x] 2.1 カテゴリー表示名と色を追加
    - `frontend/frontend/src/components/SellerStatusSidebar.tsx`の`getCategoryLabel()`に3つのケースを追加
    - `getCategoryColor()`に専任（緑#2e7d32）、一般（青#1565c0）、訪問後他決（オレンジ#ff9800）を追加
    - _Requirements: 1.5, 2.5, 3.5, 4.2_
  
  - [x] 2.2 サイドバーに新しいカテゴリーボタンを追加
    - `renderAllCategories()`に3つの新しいカテゴリーボタンを追加
    - 担当者別カテゴリーの後に区切り線を入れて配置
    - 件数が0件の場合は非表示にするロジックを実装
    - _Requirements: 1.1, 1.3, 2.1, 2.3, 3.1, 3.3, 4.2, 6.5_
  
  - [x] 2.3 カテゴリー展開リスト表示を実装
    - 各カテゴリーのクリックハンドラーを実装
    - 展開リストに売主番号、売主名、状況、物件住所、次電日を表示
    - 最大高さ400pxでスクロール可能にする
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ]* 2.4 サイドバーUIの統合テストを作成
    - `frontend/frontend/src/components/__tests__/SellerStatusSidebar.integration.test.tsx`を作成
    - カテゴリー表示、件数表示、色表示をテスト
    - カテゴリークリックと展開リスト表示をテスト
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.3, 2.4, 2.5, 3.1, 3.3, 3.4, 3.5_

- [x] 3. バックエンドAPIを拡張
  - [x] 3.1 getSidebarCounts()メソッドを拡張
    - `backend/src/services/SellerService.supabase.ts`の`getSidebarCounts()`に3つの新しいカウントフィールドを追加
    - `seller_sidebar_counts`テーブルから`exclusive`、`general`、`visitOtherDecision`カテゴリーを取得
    - _Requirements: 8.1, 8.2_
  
  - [x] 3.2 getSidebarCountsFallback()メソッドを拡張
    - 専任カテゴリーのクエリを実装（専任他決打合せ、次電日、状況の条件）
    - 一般カテゴリーのクエリを実装（専任他決打合せ、次電日、状況、契約年月の条件）
    - 訪問後他決カテゴリーのクエリを実装（専任他決打合せ、次電日、状況、営担の条件）
    - キャッシュに保存（60秒TTL）
    - _Requirements: 8.2, 8.3, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
  
  - [x] 3.3 listSellers()メソッドのstatusCategory拡張
    - `listSellers()`メソッドに`exclusive`、`general`、`visitOtherDecision`のケースを追加
    - 各カテゴリーの条件に基づいてSupabaseクエリを構築
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ]* 3.4 バックエンドAPIの単体テストを作成
    - `backend/src/services/__tests__/SellerService.sidebar-counts.test.ts`を作成
    - `getSidebarCounts()`、`getSidebarCountsFallback()`、`listSellers()`のテストを実装
    - 各カテゴリーの条件を満たす売主のみがカウント・フィルタリングされることを確認
    - _Requirements: 1.2, 2.2, 3.2, 5.1, 5.2, 5.3, 8.2_

- [x] 4. Checkpoint - 基本機能の動作確認
  - フロントエンドとバックエンドの統合テストを実行
  - サイドバーに3つの新しいカテゴリーが表示されることを確認
  - 各カテゴリーの件数が正しく表示されることを確認
  - カテゴリークリックでフィルタリングが動作することを確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. データベースとGAS対応
  - [x] 5.1 seller_sidebar_countsテーブルに新規レコードを追加
    - `seller_sidebar_counts`テーブルに`exclusive`、`general`、`visitOtherDecision`のレコードを追加
    - 初期値は0に設定
    - _Requirements: 8.1_
  
  - [x] 5.2 GASのsyncSellerList関数を更新
    - 専任カテゴリーのカウント計算ロジックを追加
    - 一般カテゴリーのカウント計算ロジックを追加
    - 訪問後他決カテゴリーのカウント計算ロジックを追加
    - `seller_sidebar_counts`テーブルに結果を保存
    - _Requirements: 6.4, 8.2_
  
  - [ ]* 5.3 データベースインデックスを作成（オプション）
    - 専任カテゴリー用インデックスを作成
    - 一般カテゴリー用インデックスを作成
    - 訪問後他決カテゴリー用インデックスを作成
    - _Requirements: 8.3, 10.2_

- [ ]* 6. プロパティベーステストを実装
  - [ ]* 6.1 Property 1: 専任カテゴリー分類の正確性
    - **Property 1: 専任カテゴリー分類の正確性**
    - **Validates: Requirements 1.2**
    - `frontend/frontend/src/utils/__tests__/sellerStatusFilters.property.test.ts`を作成
    - `isExclusive()`関数のプロパティテストを実装
  
  - [ ]* 6.2 Property 2: 一般カテゴリー分類の正確性
    - **Property 2: 一般カテゴリー分類の正確性**
    - **Validates: Requirements 2.2**
    - `isGeneral()`関数のプロパティテストを実装
  
  - [ ]* 6.3 Property 3: 訪問後他決カテゴリー分類の正確性
    - **Property 3: 訪問後他決カテゴリー分類の正確性**
    - **Validates: Requirements 3.2**
    - `isVisitOtherDecision()`関数のプロパティテストを実装
  
  - [ ]* 6.4 Property 4: カテゴリー件数の正確性
    - **Property 4: カテゴリー件数の正確性**
    - **Validates: Requirements 1.3, 2.3, 3.3**
    - `getCategoryCounts()`関数のプロパティテストを実装
  
  - [ ]* 6.5 Property 5: フィルタリングの正確性
    - **Property 5: フィルタリングの正確性**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
    - `filterSellersByCategory()`関数のプロパティテストを実装

- [ ] 7. エラーハンドリングとパフォーマンス最適化
  - [ ] 7.1 フロントエンドのエラーハンドリングを実装
    - `/api/sellers/sidebar-counts`のAPIエラーハンドリングを追加
    - カテゴリー件数取得失敗時のフォールバック処理を実装
    - エラーメッセージの表示を追加
    - _Requirements: 8.4_
  
  - [ ] 7.2 バックエンドのエラーハンドリングを実装
    - `getSidebarCounts()`のデータベースクエリエラーハンドリングを追加
    - キャッシュテーブルが空の場合のフォールバック処理を確認
    - 日付比較エラーのハンドリングを実装
    - _Requirements: 8.4, 9.6_
  
  - [ ] 7.3 パフォーマンス最適化を実装
    - カテゴリーカウント計算の並列実行を確認
    - キャッシュの活用を確認（60秒TTL）
    - レスポンスタイムを測定（目標: 500ms以内）
    - _Requirements: 8.3, 8.5, 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 8. Final checkpoint - 統合テストと動作確認
  - 全てのカテゴリーが正しく表示されることを確認
  - 件数が正確に計算されることを確認
  - フィルタリングが正しく動作することを確認
  - パフォーマンス要件を満たしていることを確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- タスクに`*`が付いているものはオプションで、スキップ可能です
- 各タスクは要件番号を参照しており、トレーサビリティを確保しています
- Checkpointタスクで段階的に動作確認を行います
- プロパティベーステストは包括的な正確性を検証します
- GASの更新（タスク5.2）は手動で行う必要があります

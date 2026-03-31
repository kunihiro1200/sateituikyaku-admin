# Implementation Plan: 物件リスト詳細画面のUI改善機能

## Overview

物件リスト詳細画面のUIを改善し、「物件詳細」ラベルを削除して物件番号のコピー機能を追加します。PropertyHeaderInfoコンポーネントに物件番号表示とコピー機能を実装し、PropertyListingDetailPageから不要なラベルを削除します。

## Tasks

- [x] 1. PropertyListingDetailPageから「物件詳細」ラベルを削除
  - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`の983行目付近の「物件詳細 - {data.property_number}」を削除
  - 物件番号のみを表示するように変更
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. PropertyHeaderInfoコンポーネントに物件番号のコピー機能を追加
  - [x] 2.1 PropertyHeaderInfoのPropsに`propertyNumber`を追加
    - `PropertyHeaderInfoProps`インターフェースに`propertyNumber: string`を追加
    - _Requirements: 2.1_
  
  - [x] 2.2 物件番号表示とコピー機能のUI実装
    - Material-UIの`IconButton`、`Tooltip`、`ContentCopyIcon`、`CheckIcon`をインポート
    - `copied`状態を管理（`useState<boolean>(false)`）
    - `handleCopy`関数を実装（`navigator.clipboard.writeText`を使用）
    - `handleKeyDown`関数を実装（EnterキーとSpaceキーでコピー）
    - 物件番号を物件概要セクションの右側に配置
    - コピーアイコンボタンを追加（`aria-label="物件番号をコピー"`）
    - ツールチップを追加（「物件番号をコピー」）
    - コピー成功時にチェックアイコンを2秒間表示
    - スクリーンリーダー用のaria-live領域を追加（`role="status"`、`aria-live="polite"`）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 4.1, 4.2, 4.3_
  
  - [ ]* 2.3 PropertyHeaderInfoのユニットテストを実装
    - 「物件詳細」ラベルが表示されないことを確認
    - コピーアイコンの初期表示を確認
    - `aria-label`属性の設定を確認
    - _Requirements: 1.1, 2.4, 4.1_

- [x] 3. ReinsRegistrationPageでPropertyHeaderInfoに物件番号を渡す
  - `frontend/frontend/src/pages/ReinsRegistrationPage.tsx`の`PropertyHeaderInfo`コンポーネントに`propertyNumber={data?.property_number ?? ''}`を追加
  - _Requirements: 2.1_

- [ ]* 4. プロパティベーステストの実装
  - [ ]* 4.1 Property 1のテスト実装（クリップボードへのコピー）
    - **Property 1: クリップボードへのコピー**
    - **Validates: Requirements 2.2**
    - fast-checkで任意の物件番号を生成
    - コピーボタンをクリック後、クリップボードの内容を確認
    - 最低100回の反復で実行
  
  - [ ]* 4.2 Property 2のテスト実装（コピー成功フィードバックの表示）
    - **Property 2: コピー成功フィードバックの表示**
    - **Validates: Requirements 2.3**
    - コピー後に「コピーしました」が表示されることを確認
  
  - [ ]* 4.3 Property 3のテスト実装（ツールチップの表示）
    - **Property 3: ツールチップの表示**
    - **Validates: Requirements 2.5**
    - マウスオーバー時に「物件番号をコピー」が表示されることを確認
  
  - [ ]* 4.4 Property 4のテスト実装（コピー成功アイコンの表示）
    - **Property 4: コピー成功アイコンの表示**
    - **Validates: Requirements 2.6**
    - コピー後にチェックアイコンが表示されることを確認
  
  - [ ]* 4.5 Property 5のテスト実装（アイコンの復元）
    - **Property 5: アイコンの復元**
    - **Validates: Requirements 2.7**
    - 2秒経過後に元のコピーアイコンに戻ることを確認
  
  - [ ]* 4.6 Property 6のテスト実装（スクリーンリーダーへの通知）
    - **Property 6: スクリーンリーダーへの通知**
    - **Validates: Requirements 4.2**
    - aria-live領域に「物件番号をコピーしました」が表示されることを確認
  
  - [ ]* 4.7 Property 7のテスト実装（キーボード操作でのコピー）
    - **Property 7: キーボード操作でのコピー**
    - **Validates: Requirements 4.3**
    - Enterキーでコピーが実行されることを確認

- [x] 5. Checkpoint - 動作確認
  - ローカル環境（`http://localhost:5173`）で動作確認
  - 「物件詳細」ラベルが削除されていることを確認
  - 物件番号のコピー機能が正常に動作することを確認
  - モバイル端末でも正常に動作することを確認
  - 全てのテストが通過することを確認
  - ユーザーに質問があれば確認

- [x] 6. デプロイ
  - 変更をコミット（`git add .`、`git commit -m "feat: 物件リスト詳細画面のUI改善（物件番号コピー機能追加）"`）
  - mainブランチにプッシュ（`git push origin main`）
  - Vercelで自動デプロイされることを確認
  - 本番環境（`https://sateituikyaku-admin-frontend.vercel.app`）で動作確認
  - _Requirements: 全て_

## Notes

- タスク4（プロパティベーステスト）は`*`マークで任意としています
- 各タスクは要件ドキュメントの特定の要件に対応しています
- PropertyHeaderInfoは既にReinsRegistrationPageで使用されているため、互換性を保つ必要があります
- クリップボードAPIはHTTPSまたはlocalhostでのみ動作します
- モバイル端末でもタップでコピー機能が動作することを確認してください

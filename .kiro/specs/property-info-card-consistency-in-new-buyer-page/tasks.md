# Implementation Plan: PropertyInfoCard統合による買主新規作成ページの一貫性向上

## Overview

買主新規作成ページ（NewBuyerPage）の物件情報表示を、買主詳細ページ（BuyerDetailPage）と同じ`PropertyInfoCard`コンポーネントに統一します。これにより、約506行（94%）のコードを削減し、表示の一貫性を保ち、atbb_statusとdistribution_dateを表示できるようにします。

## Tasks

- [ ] 1. PropertyInfoCardコンポーネントのインポートと配置
  - NewBuyerPageに`PropertyInfoCard`をインポート
  - 物件番号入力フィールドを`PropertyInfoCard`の外に配置
  - `PropertyInfoCard`を条件付きでレンダリング（物件番号が入力されている場合のみ）
  - `showCloseButton={false}`を設定
  - sticky positioningを維持（`position: 'sticky', top: 16`）
  - _Requirements: 1.1, 1.4, 3.1, 3.2, 3.5, 4.1, 4.2, 5.1_

- [ ] 2. 独自実装の物件情報表示コードの削除
  - [ ] 2.1 独自の物件情報表示UIコードを削除（約500行）
    - `loadingProperty`時の`CircularProgress`表示を削除
    - `propertyInfo`が存在する場合の物件情報表示コードを削除
    - 物件情報が見つからない場合のメッセージ表示を削除
    - _Requirements: 2.1_
  
  - [ ] 2.2 不要なstate、interface、関数を削除
    - `PropertyInfo` interfaceを削除
    - `propertyInfo` stateを削除
    - `loadingProperty` stateを削除
    - `fetchPropertyInfo`関数を削除
    - `useEffect`内の`fetchPropertyInfo`呼び出しを削除
    - 物件番号入力フィールドの`onChange`内の`fetchPropertyInfo`呼び出しを削除
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [ ] 3. 物件番号が空の場合のメッセージ表示を追加
  - 物件番号が空の場合に「物件番号を入力すると物件情報が表示されます」メッセージを表示
  - `Paper`コンポーネントでラップ
  - _Requirements: 1.4, 4.4_

- [ ] 4. Checkpoint - 動作確認とテスト
  - ローカル環境で動作確認
  - 物件番号を入力してPropertyInfoCardが表示されることを確認
  - atbb_statusとdistribution_dateが表示されることを確認
  - 物件番号を削除してPropertyInfoCardが非表示になることを確認
  - 閉じるボタンが表示されないことを確認
  - sticky positioningが正しく動作することを確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. BuyerDetailPageでの後方互換性確認
  - BuyerDetailPageでPropertyInfoCardが正しく表示されることを確認
  - 閉じるボタンが表示されることを確認（`showCloseButton`のデフォルト値が`true`）
  - 既存の機能（物件詳細リンク、コピー機能等）が正常に動作することを確認
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 6. Final checkpoint - デプロイ前の最終確認
  - getDiagnosticsでエラーがないか確認
  - モバイル表示を確認（Grid item xs={12} md={5}とxs={12} md={7}のレイアウト）
  - エラーハンドリングを確認（存在しない物件番号、ネットワークエラー）
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- 実装により約506行（94%）のコードを削減
- PropertyInfoCardは既に`showCloseButton` propを実装済み
- 物件情報の取得とエラーハンドリングはPropertyInfoCard内部で処理
- BuyerDetailPageや他のページに影響を与えない設計
- 優先順位に従い、PropertyInfoCardの統合 → 独自実装の削除 → テスト → デプロイの順で実装

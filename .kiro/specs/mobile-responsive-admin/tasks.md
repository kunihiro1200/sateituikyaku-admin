# 実装計画：管理画面モバイルレスポンシブ対応

## 概要

React + TypeScript + Material UI で構築された管理画面に、`useMediaQuery` を使ったモバイル向けレイアウトを追加する。バックエンドへの変更は不要で、フロントエンドのみの変更となる。デスクトップ表示は一切変更しない。

## タスク

- [x] 1. PageNavigation コンポーネントのモバイル対応
  - `frontend/frontend/src/components/PageNavigation.tsx` を修正する
  - `useTheme` + `useMediaQuery(theme.breakpoints.down('sm'))` で `isMobile` を取得する
  - `isMobile=true` の場合、ハンバーガーアイコン（`MenuIcon`）+ `Drawer` を表示する
  - `Drawer` 内のナビゲーション項目は縦並び、各項目の `minHeight: 44px` を設定する
  - `isMobile=false` の場合、既存の横並びボタン群をそのまま表示する
  - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 1.1 PageNavigation のプロパティテストを書く
    - **Property 4: タップターゲットサイズの保証**
    - **Validates: Requirements 7.2**

- [x] 2. 売主リストページ（SellersPage）のモバイル対応
  - `frontend/frontend/src/pages/SellersPage.tsx` を修正する
  - `isMobile=true` の場合、`SellerStatusSidebar` を `Accordion` でラップしてページ上部に表示する
  - `isMobile=true` の場合、`TableContainer` を非表示にし、売主カードリストを表示する
  - 売主カードには売主番号・名前・物件住所・ステータス・次電日を表示する
  - カードの `minHeight: 44px`、テキストの最小フォントサイズ `14px` を設定する
  - カードタップ時は既存の `navigate` ハンドラを呼び出す
  - 検索バーを `fullWidth` で表示する
  - `overflow-x: hidden` をモバイルレイアウトのルートコンテナに適用する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 8.1, 8.3, 8.4_

  - [ ]* 2.1 売主リストのプロパティテストを書く（Property 1）
    - **Property 1: リストページのテーブル/カード表示切り替え**
    - **Validates: Requirements 1.2, 1.5**

  - [ ]* 2.2 売主カードの必須項目プロパティテストを書く（Property 2）
    - **Property 2: 売主カードに必須項目が含まれる**
    - **Validates: Requirements 1.3**

- [x] 3. チェックポイント
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

- [x] 4. 買主リストページ（BuyersPage）のモバイル対応
  - `frontend/frontend/src/pages/BuyersPage.tsx` を修正する
  - `isMobile=true` の場合、`BuyerStatusSidebar` を `Accordion` でラップしてページ上部に表示する
  - `isMobile=true` の場合、`TableContainer` を非表示にし、買主カードリストを表示する
  - 買主カードには買主番号・名前・希望エリア・ステータス・次電日を表示する
  - カードタップ時は既存の `navigate` ハンドラを呼び出す
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.3, 8.4_

  - [ ]* 4.1 買主リストのプロパティテストを書く（Property 1）
    - **Property 1: リストページのテーブル/カード表示切り替え**
    - **Validates: Requirements 4.2, 4.5**

  - [ ]* 4.2 買主カードの必須項目プロパティテストを書く（Property 3）
    - **Property 3: 買主カードに必須項目が含まれる**
    - **Validates: Requirements 4.3**

- [x] 5. 物件リストページ（PropertyListingsPage）のモバイル対応
  - `frontend/frontend/src/pages/PropertyListingsPage.tsx` を修正する
  - `isMobile=true` の場合、`TableContainer` を非表示にし、物件カードリストを表示する
  - 物件カードには物件番号・物件住所・種別・価格・ステータスを表示する
  - カードタップ時は既存の `handleRowClick` を呼び出す
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.1, 8.3, 8.4_

  - [ ]* 5.1 物件リストのプロパティテストを書く（Property 1）
    - **Property 1: リストページのテーブル/カード表示切り替え**
    - **Validates: Requirements 6.1, 6.4**

- [x] 6. チェックポイント
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

- [x] 7. 売主詳細ページ（SellerDetailPage）のモバイル対応
  - `frontend/frontend/src/pages/SellerDetailPage.tsx` を修正する
  - `isMobile=true` の場合、全 `Grid item` を `xs={12}` の1カラムに変更する
  - 各セクション（査定情報・管理情報・物件情報など）を `Accordion` で折りたたみ可能にする
  - 「戻る」「保存」ボタンを画面下部の固定フッター（`position: fixed; bottom: 0`）に移動する
  - コンテンツエリアに `paddingBottom` を追加してフッターに隠れないようにする
  - 入力フィールドの `minHeight: 44px` を設定する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2_

  - [ ]* 7.1 売主詳細ページのタップターゲットプロパティテストを書く（Property 4）
    - **Property 4: タップターゲットサイズの保証**
    - **Validates: Requirements 2.2, 8.1**

- [x] 8. 買主詳細ページ（BuyerDetailPage）のモバイル対応
  - `frontend/frontend/src/pages/BuyerDetailPage.tsx` を修正する
  - `isMobile=true` の場合、全セクションを縦1カラムレイアウトで表示する
  - 入力フィールドの `minHeight: 44px` を設定する
  - 「戻る」ボタンを画面上部に常時表示する
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 8.1_

- [x] 9. 通話モードページ（CallModePage）のモバイル対応
  - `frontend/frontend/src/pages/CallModePage.tsx` を修正する
  - `isMobile=true` の場合、売主基本情報（名前・電話番号・物件住所）を固定ヘッダーに表示する
  - 電話・SMSボタンを固定フッターに配置する（`minHeight: 56px`）
  - コメント入力エリアを `fullWidth` で表示する
  - `SellerStatusSidebar` を非表示にする（`data-testid="seller-status-sidebar"` を付与する）
  - 各情報セクションを `Accordion` で折りたたみ可能にする
  - コンテンツエリアに固定ヘッダー・フッター分の `padding` を追加する
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.1_

  - [ ]* 9.1 通話モードのサイドバー非表示プロパティテストを書く（Property 5）
    - **Property 5: 通話モードのサイドバー非表示**
    - **Validates: Requirements 3.4**

- [x] 10. 横スクロール・フォントサイズのプロパティテストを書く
  - `frontend/frontend/src/__tests__/mobile-responsive-admin.property.test.tsx` を作成する
  - `fast-check` を使用して各プロパティを実装する（最低100回イテレーション）

  - [ ]* 10.1 横スクロールが発生しないプロパティテストを書く（Property 7）
    - **Property 7: 横スクロールが発生しない**
    - **Validates: Requirements 8.4**

  - [ ]* 10.2 テキスト最小フォントサイズのプロパティテストを書く（Property 6）
    - **Property 6: テキスト最小フォントサイズ**
    - **Validates: Requirements 8.3**

- [x] 11. 最終チェックポイント
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

## Notes

- タスクに `*` が付いているものはオプションであり、MVP向けにスキップ可能
- 各タスクは既存のイベントハンドラ・状態管理を共有する（重複実装なし）
- `isMobile` フラグによる条件分岐で、デスクトップ表示は完全に既存コードを維持する
- プロパティテストには `fast-check` ライブラリを使用する

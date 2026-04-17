# 実装計画: buyer-pinrich-500man-registration

## 概要

買主詳細画面（BuyerDetailPage）にPinrich500万以上登録フィールドを追加する実装計画。
DBマイグレーション → バックエンド → フロントエンド（サイドバー → 詳細画面）の順で実装し、各ステップで動作確認を行う。

## タスク

- [x] 1. DBマイグレーション: `pinrich_500man_registration` カラム追加
  - `buyers` テーブルに `pinrich_500man_registration TEXT` カラムを追加するSQLを作成・実行する
  - `ALTER TABLE buyers ADD COLUMN pinrich_500man_registration TEXT;`
  - _Requirements: 6.1_

- [x] 2. バックエンド: BuyerService にサイドバーカウント計算を追加
  - [x] 2.1 `getSidebarCountsFallback` の `result` オブジェクトに `pinrich500manUnregistered: 0` を追加する
    - `backend/src/services/BuyerService.ts` を編集
    - _Requirements: 4.1, 7.1_

  - [x] 2.2 `pinrich500manUnregistered` カウント計算ロジックを実装する
    - 条件: `email` が空でない AND `inquiry_property_price <= 5000000` AND (`pinrich_500man_registration` が `'未'` または null/空)
    - 既存の `pinrichUnregistered` カウント計算の直後に追加する
    - _Requirements: 4.1, 7.2_

  - [x] 2.3 `getSidebarCounts`（DBキャッシュ読み込み）に `pinrich500manUnregistered` の読み込み処理を追加する
    - `row.category === 'pinrich500manUnregistered'` の分岐を追加
    - _Requirements: 4.1_

  - [x] 2.4 `saveSidebarCounts`（DBキャッシュ保存）に `pinrich500manUnregistered` の保存処理を追加する
    - `rows.push(...)` に `pinrich500manUnregistered` エントリを追加
    - _Requirements: 4.1_

  - [ ]* 2.5 Property 4: カウント計算の正確性のプロパティテストを書く
    - **Property 4: カウント計算の正確性**
    - `calculatePinrich500manUnregisteredCount` 関数を対象に `fast-check` でテストを実装
    - 任意の買主データリストに対して、カウント結果が期待値と一致することを検証
    - **Validates: Requirements 4.1**

- [ ] 3. チェックポイント - バックエンドのテストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 4. フロントエンド: BuyerStatusSidebar に `pinrich500manUnregistered` カテゴリを追加
  - [x] 4.1 `CategoryCounts` インターフェースに `pinrich500manUnregistered?: number` を追加する
    - `frontend/frontend/src/components/BuyerStatusSidebar.tsx` を編集
    - _Requirements: 4.1_

  - [x] 4.2 `getCategoryColor` 関数に `pinrich500manUnregistered` のケースを追加する
    - 色: `#d32f2f`（赤）
    - _Requirements: 4.2_

  - [x] 4.3 `getCategoryLabel` 関数に `pinrich500manUnregistered` のケースを追加する
    - ラベル: `'Pinrich500万以上登録未'`
    - _Requirements: 4.1_

  - [x] 4.4 `newCategories` 配列に `'pinrich500manUnregistered'` を追加する
    - `'pinrichUnregistered'` の直後に追加
    - _Requirements: 4.1, 4.3_

- [x] 5. フロントエンド: BuyersPage に `categoryKeyToDisplayName` マッピングを追加
  - `frontend/frontend/src/pages/BuyersPage.tsx` を編集
  - `'pinrich500manUnregistered': 'Pinrich500万以上登録未'` を追加する
  - _Requirements: 4.1_

- [x] 6. フロントエンド: BuyerDetailPage に500万以上登録フィールドを実装
  - [x] 6.1 `isPinrich500manVisible` ヘルパー関数を実装する
    - `frontend/frontend/src/pages/BuyerDetailPage.tsx` を編集
    - 条件: `buyer.email` が空でない AND `linkedProperties[0]?.price <= 5000000`
    - `price` が `undefined` / `null` の場合は `false` を返す
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 6.2 Property 1: 表示条件の正確性のプロパティテストを書く
    - **Property 1: 表示条件の正確性**
    - `isPinrich500manVisible` 関数を対象に `fast-check` でテストを実装
    - email と price の任意の組み合わせに対して、期待される表示条件と一致することを検証
    - 境界値（price = 5,000,000 と 5,000,001）を含む
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [x] 6.3 `SAVE_BUTTON_FIELDS` に `'pinrich_500man_registration'` を追加する
    - _Requirements: 6.1_

  - [x] 6.4 `BUYER_FIELD_SECTIONS` に `pinrich_500man_registration` と `pinrich_500man_link` フィールド定義を追加する
    - `pinrich_link` フィールドの直後に追加
    - `{ key: 'pinrich_500man_registration', label: '500万以上登録', inlineEditable: true, fieldType: 'buttonSelect' }`
    - `{ key: 'pinrich_500man_link', label: 'Pinrich500万以上登録方法', inlineEditable: true, fieldType: 'pinrich500manLink' }`
    - _Requirements: 1.4, 2.1, 2.5_

  - [x] 6.5 `updatePinrich500manSidebarCount` ヘルパー関数を実装する
    - 「未」→「済」でカウント減算、「済」→「未」でカウント加算
    - `pageDataCache` の `categoryCounts.pinrich500manUnregistered` を更新する
    - `pageDataCache` が利用できない場合は既存の `refetchTrigger` パターンを使用する
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 6.6 `pinrich_500man_registration` フィールドのレンダリング処理を実装する
    - `isPinrich500manVisible` が `false` の場合は `null` を返す
    - デフォルト値: `buyer?.pinrich_500man_registration || '未'`
    - 「済」「未」の ButtonSelect UI を実装
    - ボタンクリック時に `setBuyer`、`handleFieldChange`、`updatePinrich500manSidebarCount` を呼び出す
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3_

  - [ ]* 6.7 Property 2: デフォルト値の正確性のプロパティテストを書く
    - **Property 2: デフォルト値の正確性**
    - `null`、`undefined`、空文字列に対して表示値が `'未'` になることを検証
    - **Validates: Requirements 2.2**

  - [x] 6.8 `pinrich_500man_link` フィールドのレンダリング処理を実装する
    - `isPinrich500manVisible` が `false` の場合は `null` を返す
    - リンク先: `https://docs.google.com/spreadsheets/d/14gi7bEM1jLgMGA5iOes69DbcLkcRox2vZdKiUy-4_VU/edit?usp=sharing`
    - `target="_blank"` と `rel="noopener noreferrer"` を付与
    - ラベル: `'Pinrich500万以上登録方法'`（LaunchIcon付き）
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 6.9 Property 5: リンク表示の連動性のプロパティテストを書く
    - **Property 5: リンク表示の連動性**
    - `isPinrich500manVisible` の結果とリンク表示状態が常に一致することを検証
    - **Validates: Requirements 3.1, 3.4**

  - [x] 6.10 保存失敗時のエラーハンドリングを実装する
    - 既存の `handleSectionSave` のエラーハンドリングパターンに従う
    - エラー時に `pinrich_500man_registration` を保存前の値に戻す
    - _Requirements: 6.3_

- [ ] 7. チェックポイント - フロントエンドのテストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 8. フロントエンド: メールアドレス・問合せ物件価格変更時の表示条件再評価
  - `email` または `linkedProperties[0]?.price` が変更された際に `isPinrich500manVisible` が再評価されることを確認する
  - React の state/props 変更による再レンダリングで自動的に再評価されることを確認し、必要に応じて `useEffect` や `useMemo` を追加する
  - _Requirements: 1.5_

- [ ] 9. GAS: `updateBuyerSidebarCounts_()` に `pinrich500manUnregistered` カウント計算を追加
  - GASファイルの `updateBuyerSidebarCounts_()` 関数に `Pinrich500万以上登録未` カテゴリのカウント計算を追加する
  - 条件: `●メアド` が空でない AND `問合せ物件価格 <= 5000000` AND (`500万以上登録` が `'未'` または空白)
  - 計算結果を `buyer_sidebar_counts` テーブルに保存する
  - _Requirements: 7.1, 7.2_

- [ ] 10. GAS: `syncBuyerList()` 実行後に `updateBuyerSidebarCounts_()` が呼ばれることを確認
  - `syncBuyerList()` の末尾で `updateBuyerSidebarCounts_()` が呼び出されていることを確認し、なければ追加する
  - _Requirements: 7.3_

- [ ] 11. GAS: `syncBuyerList()` で `pinrich_500man_registration` フィールドの双方向同期を実装
  - スプレッドシートの対応カラムと `buyers.pinrich_500man_registration` の双方向同期を追加する
  - _Requirements: 6.2_

- [ ]* 12. Property 3: サイドバーカウントのラウンドトリップのプロパティテストを書く
  - **Property 3: サイドバーカウントのラウンドトリップ**
  - 表示条件を満たす買主に対して「未」→「済」→「未」と切り替えた場合、`pinrich500manUnregistered` カウントが元の値に戻ることを検証
  - **Validates: Requirements 5.1, 5.2**

- [ ] 13. 最終チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVP実装では省略可能
- 各タスクは対応する要件番号を参照しているため、トレーサビリティを確保
- チェックポイントで段階的に動作確認を行う
- プロパティテストには `fast-check` ライブラリを使用（TypeScriptプロジェクト）
- `pageDataCache` へのアクセス方法は既存の `pinrichUnregistered` の実装パターンを参照すること

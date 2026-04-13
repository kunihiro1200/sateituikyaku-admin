# 実装計画: 買付情報セクション編集機能

## 概要

`PropertyListingDetailPage` の「買付情報」セクションに `EditableSection` コンポーネントパターンを適用し、全6フィールドをインライン編集可能にする。既存の他セクション（価格情報・内覧情報など）と同一パターンで実装する。

## タスク

- [x] 1. `isOfferEditMode` state とハンドラの追加
  - `PropertyListingDetailPage.tsx` に `const [isOfferEditMode, setIsOfferEditMode] = useState(false);` を追加する
  - `handleSaveOffer` 非同期関数を実装する（`editedData` が空または `propertyNumber` が未定義の場合はスキップ）
  - `handleCancelOffer` 関数を実装する（`editedData` リセット + `isOfferEditMode = false`）
  - 既存の `handleSaveViewingInfo` などと同一パターンに従うこと
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 8.1, 8.2, 8.3, 8.4_

- [x] 2. 買付情報セクションの EditableSection 化
  - [x] 2.1 買付情報セクションを `EditableSection` コンポーネントでラップする
    - `title="買付情報"`、`isEditMode={isOfferEditMode}`、`onEditToggle`・`onSave`・`onCancel` を接続する
    - 既存の表示専用 JSX を `EditableSection` の `children` に移動する
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 9.1_

  - [x] 2.2 「買付日」フィールドの編集コントロール実装
    - 編集モード: `type="date"` の `TextField`（`value={editedData.offer_date ?? propertyData.offer_date ?? ''}`）
    - 非編集モード: 読み取り専用テキスト（値が空の場合は「-」）
    - `onChange` で `handleFieldChange('offer_date', value)` を呼び出す
    - _Requirements: 2.1, 2.2, 2.3, 9.2_

  - [x] 2.3 「買付」フィールドの Select 実装
    - 編集モード: `Select` コンポーネント（選択肢: 一般片手・専任片手・専任両手・一般両手・一般他決 の5択）
    - 非編集モード: 読み取り専用テキスト（値が空の場合は「-」）
    - `onChange` で `handleFieldChange('offer_status', value)` を呼び出す
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 9.2_

  - [x] 2.4 「状況」フィールドの Select 実装
    - 編集モード: `Select` コンポーネント（19択: 専任両手・専任片手・一般両手・一般片手・一般他決・他社物件片手・自社買取（リースバック）・非公開→公開・一般媒介解除・専任解除・売止め・国広収益・自社買取（転売）・買取紹介（片手）・買取紹介（両手）・契約書作成済み・自社売主（元リースバック）・自社売主（元転売目的）・専任→一般媒介）
    - 非編集モード: 読み取り専用テキスト（値が空の場合は「-」）
    - `onChange` で `handleFieldChange('status', value)` を呼び出す
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 9.2_

  - [x] 2.5 「金額」「会社名」「買付コメント」フィールドの実装
    - 「金額」: 編集モードは `TextField`、`handleFieldChange('offer_amount', value)`
    - 「会社名」: 編集モードは `TextField`、`handleFieldChange('company_name', value)`
    - 「買付コメント」: 編集モードは `multiline` `TextField`、`handleFieldChange('offer_comment', value)`
    - 各フィールド: 非編集モードは読み取り専用テキスト（値が空の場合は「-」）
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 9.2_

- [x] 3. チェックポイント - 動作確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 4. テストファイルの作成
  - [x] 4.1 ユニットテスト・例ベーステストを実装する
    - テストファイル: `frontend/frontend/src/pages/__tests__/PropertyListingDetailPage.purchase-info.test.tsx`
    - 非編集モードで編集ボタンが表示されること（要件 1.1）
    - 編集ボタンクリック後に全フィールドが入力コントロールに切り替わること（要件 1.2）
    - 編集モードで保存・キャンセルボタンが表示されること（要件 1.3）
    - キャンセルクリック後に `editedData` がリセットされ `isOfferEditMode` が false になること（要件 1.4）
    - 「買付」フィールドの選択肢が5択であること（要件 3.2）
    - 「状況」フィールドの選択肢が19択であること（要件 4.2）
    - 保存ボタンクリック時に PUT API が呼ばれること（要件 8.1）
    - 保存成功後にスナックバーが表示され編集モードが終了すること（要件 8.2）
    - 保存失敗時にエラースナックバーが表示され編集モードが維持されること（要件 8.3）
    - `editedData` が空の場合に保存処理がスキップされること（要件 8.4）
    - 全フィールドが空の場合に各フィールドに「-」が表示されること（要件 9.2）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.2, 4.2, 8.1, 8.2, 8.3, 8.4, 9.2_

  - [ ]* 4.2 Property 1 のプロパティベーステストを実装する
    - **Property 1: フィールド変更の editedData 反映**
    - fast-check を使用し、6フィールド（offer_date・offer_status・status・offer_amount・company_name・offer_comment）と任意の文字列値に対して `handleFieldChange` 呼び出し後に `editedData[field] === value` であることを検証する
    - **Validates: Requirements 2.2, 3.3, 4.3, 5.2, 6.2, 7.2**

  - [ ]* 4.3 Property 2 のプロパティベーステストを実装する
    - **Property 2: セクション常時表示**
    - fast-check を使用し、`offer_date`・`offer_status`・`offer_amount` が null/undefined/空文字列を含む任意の値の組み合わせでレンダリングした場合に買付情報セクションが常に存在することを検証する
    - **Validates: Requirements 9.1**

- [x] 5. 最終チェックポイント - 全テスト通過確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 備考

- `*` が付いたタスクはオプションであり、MVP を優先する場合はスキップ可能
- 各タスクは対応する要件番号を参照しており、トレーサビリティを確保している
- プロパティテストは Vitest + fast-check で実装する
- テストファイルの配置先: `frontend/frontend/src/pages/__tests__/PropertyListingDetailPage.purchase-info.test.tsx`

# 実装計画: 問合時持家ヒアリング機能

## 概要

買主詳細画面（BuyerDetailPage.tsx）および新規買主登録画面（NewBuyerPage.tsx）に、問合時持家ヒアリングワークフローを支援する3フィールドを追加する。DBカラムおよびカラムマッピングは既存のため、フロントエンドUIとバックエンドAPIレスポンスの更新が主な実装対象。

## タスク

- [x] 1. DBカラムおよびカラムマッピングの確認
  - [x] 1.1 `buyers` テーブルに `owned_home_hearing_inquiry`・`owned_home_hearing_result`・`valuation_required` カラムが存在するか確認する
    - `backend/src/services/BuyerService.ts` または既存マイグレーションファイルを参照して確認
    - 存在しない場合はマイグレーションSQLを作成して追加する
    - _Requirements: 1.5, 2.6, 3.4_
  - [x] 1.2 `backend/src/config/buyer-column-mapping.json` に3フィールドのマッピングが定義されているか確認する
    - `spreadsheetToDatabaseExtended` セクションに `問合時持家ヒアリング`・`持家ヒアリング結果`・`要査定` のマッピングが存在するか確認
    - 存在しない場合は追加する
    - _Requirements: 4.5_

- [x] 2. BuyerDetailPage.tsx の更新
  - [x] 2.1 `BUYER_FIELD_SECTIONS` の「問合せ内容」セクションに3フィールドを追加する
    - 既存の `owned_home_hearing` フィールドの直後に以下を追加：
      - `{ key: 'owned_home_hearing_inquiry', label: '問合時持家ヒアリング', inlineEditable: true, fieldType: 'staffSelect' }`
      - `{ key: 'owned_home_hearing_result', label: '持家ヒアリング結果', inlineEditable: true, fieldType: 'homeHearingResult' }`
      - `{ key: 'valuation_required', label: '要査定', inlineEditable: true, fieldType: 'valuationRequired' }`
    - _Requirements: 1.1, 2.1, 3.1_
  - [x] 2.2 `owned_home_hearing_inquiry` フィールドのカスタムレンダリングを実装する
    - `broker_inquiry` フィールドと同様のパターンで `field.key === 'owned_home_hearing_inquiry'` の分岐を追加
    - `normalInitials` の各イニシャルをボタンとして表示（`button-select-layout-rule.md` のレイアウト準拠）
    - 選択済みボタンをクリックすると空文字を保存するトグル動作を実装
    - `handleInlineFieldSave(field.key, newValue)` を `sync: true` で呼び出す
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 5.1, 5.2, 5.3_
  - [ ]* 2.3 Property 1（トグル動作）のプロパティテストを書く
    - **Property 1: 問合時持家ヒアリングのトグル動作**
    - **Validates: Requirements 1.4**
  - [x] 2.4 `owned_home_hearing_result` フィールドのカスタムレンダリングを実装する
    - `owned_home_hearing_inquiry` が空文字・null・undefined の場合は `null` を返して非表示にする
    - 4択ボタン（`持家（マンション）`・`持家（戸建）`・`賃貸`・`他不明`）を `button-select-layout-rule.md` のレイアウトで表示
    - `owned_home_hearing_result` が「持家（マンション）」または「持家（戸建）」の場合、ボタン群の下に追加テキストを表示する
    - `handleInlineFieldSave(field.key, newValue)` を `sync: true` で呼び出す
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.2, 5.3_
  - [ ]* 2.5 Property 2（持家ヒアリング結果の条件付き表示）のプロパティテストを書く
    - **Property 2: 持家ヒアリング結果の条件付き表示**
    - **Validates: Requirements 2.1, 2.2**
  - [ ]* 2.6 Property 4（持家選択時の追加テキスト表示）のプロパティテストを書く
    - **Property 4: 持家選択時の追加テキスト表示**
    - **Validates: Requirements 2.4, 2.5**
  - [x] 2.7 `valuation_required` フィールドのカスタムレンダリングを実装する
    - `owned_home_hearing_result` が「持家（マンション）」または「持家（戸建）」以外の場合は `null` を返して非表示にする
    - 2択ボタン（`要`・`不要`）を `button-select-layout-rule.md` のレイアウトで表示
    - `handleInlineFieldSave(field.key, newValue)` を `sync: true` で呼び出す
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3_
  - [ ]* 2.8 Property 3（要査定の条件付き表示）のプロパティテストを書く
    - **Property 3: 要査定の条件付き表示**
    - **Validates: Requirements 3.1, 3.2**

- [ ] 3. チェックポイント — 全テストがパスすることを確認する
  - 全テストがパスすることを確認し、疑問点があればユーザーに確認する。

- [x] 4. NewBuyerPage.tsx の更新
  - [x] 4.1 3フィールドの state を追加する
    - `const [ownedHomeHearingInquiry, setOwnedHomeHearingInquiry] = useState('');`
    - `const [ownedHomeHearingResult, setOwnedHomeHearingResult] = useState('');`
    - `const [valuationRequired, setValuationRequired] = useState('');`
    - _Requirements: 1.6, 2.7, 3.5_
  - [x] 4.2 「問合せ情報」セクションに3フィールドのボタン選択UIを追加する
    - 既存の `ownedHomeHearing` フィールドの後に追加（条件付き表示なし・常時表示）
    - `問合時持家ヒアリング`：`normalInitials` を使ったイニシャル選択ボタン（`button-select-layout-rule.md` 準拠）
    - `持家ヒアリング結果`：4択ボタン（`持家（マンション）`・`持家（戸建）`・`賃貸`・`他不明`）
    - `要査定`：2択ボタン（`要`・`不要`）
    - _Requirements: 1.6, 2.7, 3.5, 5.1, 5.2, 5.3_
  - [x] 4.3 `handleSubmit` の `buyerData` に3フィールドを追加する
    - `owned_home_hearing_inquiry: ownedHomeHearingInquiry || null`
    - `owned_home_hearing_result: ownedHomeHearingResult || null`
    - `valuation_required: valuationRequired || null`
    - _Requirements: 1.7, 2.8, 3.6_
  - [ ]* 4.4 Property 6（新規登録時のフィールド送信）のプロパティテストを書く
    - **Property 6: 新規登録時のフィールド送信**
    - **Validates: Requirements 1.7, 2.8, 3.6**

- [x] 5. バックエンドAPIの確認・更新
  - [x] 5.1 `POST /api/buyers` で3フィールドを受け取れるか確認する
    - `backend/src/routes/buyers.ts` の `router.post('/')` ハンドラーが `req.body` をそのまま `buyerService.create()` に渡しているか確認
    - 動的フィールドマッピングが実装されていれば追加実装不要
    - _Requirements: 1.7, 2.8, 3.6_
  - [x] 5.2 `BuyerService` の `decryptBuyer` メソッドに3フィールドを追加する
    - `backend/src/services/BuyerService.ts` の `decryptBuyer`（または同等のメソッド）に以下を追加：
      - `ownedHomeHearingInquiry: buyer.owned_home_hearing_inquiry`
      - `ownedHomeHearingResult: buyer.owned_home_hearing_result`
      - `valuationRequired: buyer.valuation_required`
    - APIレスポンスに3フィールドが含まれることを確認する
    - _Requirements: 1.5, 2.6, 3.4, 4.1_
  - [ ]* 5.3 Property 5（インライン保存時の sync: true オプション）のプロパティテストを書く
    - **Property 5: インライン保存時の sync: true オプション**
    - **Validates: Requirements 1.5, 2.6, 3.4, 4.1**

- [x] 6. 最終チェックポイント — 全テストがパスすることを確認する
  - 全テストがパスすることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVPとして省略可能
- プロパティテストには **fast-check** を使用する（TypeScript/JavaScript向け）
- 各プロパティテストは最低100回のイテレーションで実行する
- `button-select-layout-rule.md` のレイアウトルール（ラベルとボタン群の横並び・`flex: 1`・均等幅）を必ず遵守する
- `owned_home_hearing_inquiry` が空になっても `owned_home_hearing_result` と `valuation_required` のDB値はそのまま保持する（UIの表示制御のみ）
- DBカラムおよびカラムマッピングが既存の場合、Task 1 は確認のみで完了

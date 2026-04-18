# 実装計画: seller-registration-ui-enhancement

## 概要

`NewSellerPage.tsx` のUI改善を段階的に実装する。
各セクションへの背景色付与、訪問査定取得者フィールドの追加、次電日フィールドの強調表示の3点を対象とする。

## タスク

- [x] 1. 各セクションの Paper コンポーネントに背景色を適用する
  - `NewSellerPage.tsx` の各 `Paper` コンポーネントの `sx` プロパティに `backgroundColor` を追加する
  - 対象セクション: 基本情報(`#e3f2fd`)、反響情報(`#f3e5f5`)、物件情報(`#e8f5e9`)、コメント(`#fff8e1`)、ステータス情報(`#fce4ec`)、査定情報(`#e0f7fa`)、追客情報(`#fff3e0`)、訪問査定情報(`#f1f8e9`)
  - 各セクション内の `TextField` に `InputProps={{ style: { backgroundColor: '#ffffff' } }}` を追加してコントラストを確保する
  - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 1.1 セクション背景色の単体テストを書く
    - 各 `Paper` コンポーネントに正しい `backgroundColor` が設定されているかスナップショットテストで確認する
    - `TextField` の `InputProps.style.backgroundColor` が `#ffffff` であることを確認する
    - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. 訪問査定取得者フィールドを追加する
  - [x] 2.1 `visitAcquirer` state を追加する
    - `const [visitAcquirer, setVisitAcquirer] = useState('');` を既存の `visitAssignee` state の直後に追加する
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 訪問査定情報セクションに Select フィールドを追加する
    - `visitAssignee`（営担）フィールドの直後、`visitNotes`（訪問時注意点）の前に `Grid item` を追加する
    - `FormControl` + `InputLabel` + `Select` コンポーネントで社員リストからドロップダウン選択できるようにする
    - `employees` リストをマッピングして `MenuItem` を生成する（既存の `visitAssignee` フィールドと同様のパターン）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.3 フォーム送信ペイロードに visitAcquirer を追加する
    - `handleSubmit` 内の `data` オブジェクトに `visitAcquirer: visitAcquirer || undefined,` を追加する
    - 配置位置: `visitAssignee` の直後
    - _Requirements: 2.4_

  - [ ]* 2.4 visitAcquirer ラウンドトリップのプロパティテストを書く
    - **Property 1: visitAcquirer のフォーム送信ラウンドトリップ**
    - **Validates: Requirements 2.4**
    - `fast-check` を使用し、`employees` リスト内の任意の社員を選択してフォーム送信した際、APIリクエストの `visitAcquirer` が選択した社員のイニシャルと一致することを検証する

- [x] 3. チェックポイント - ここまでのテストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [ ] 4. 次電日フィールドに強調スタイルを適用する
  - [x] 4.1 次電日フィールドの Grid item に強調背景色を適用する
    - `nextCallDate` フィールドの `Grid item` に `sx={{ backgroundColor: '#fff9c4', borderRadius: 1, p: 1 }}` を追加する
    - _Requirements: 3.1_

  - [x] 4.2 次電日フィールドのラベルスタイルと警告枠線を適用する
    - `TextField` に `InputLabelProps={{ shrink: true, style: { fontWeight: 'bold', color: '#d32f2f' } }}` を設定する
    - `color={!nextCallDate ? 'warning' : undefined}` を設定する
    - `focused={!nextCallDate ? true : undefined}` を設定する
    - `InputProps={{ style: { backgroundColor: '#ffffff' } }}` を設定する
    - _Requirements: 3.2, 3.3, 3.4_

  - [ ]* 4.3 次電日未入力時の警告スタイルのプロパティテストを書く
    - **Property 2: 次電日未入力時の警告スタイル適用**
    - **Validates: Requirements 3.3**
    - `fast-check` を使用し、任意の `nextCallDate` 値（空文字列または日付文字列）に対して、空の場合は `color='warning'` が適用され、空でない場合は適用されないことを検証する

- [x] 5. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP実装では省略可能
- 各タスクは対応する要件番号を参照している
- 日本語を含むファイルの編集は Pythonスクリプト経由で行い、UTF-8エンコーディングを維持すること
- `visitAcquirer` のバックエンド対応（DBカラム追加）は本タスクの対象外

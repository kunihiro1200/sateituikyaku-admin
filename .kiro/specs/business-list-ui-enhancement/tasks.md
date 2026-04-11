# 実装計画: 業務リストUI複数改善

## 概要

`WorkTaskDetailModal.tsx` と `backend/src/routes/employees.ts` に対して、8つのUI改善を段階的に実装する。
バックエンドのフィルタ修正 → 動的イニシャル取得フック → 各フィールド改善の順で進める。

## タスク

- [x] 1. バックエンド: `/api/employees/normal-initials` のフィルタ条件修正
  - `backend/src/routes/employees.ts` の `normal-initials` エンドポイントで `.eq('is_active', true)` を `.eq('is_normal', true)` に変更する
  - _要件: 5.1_

  - [ ]* 1.1 `is_normal` フィルタリングのプロパティテストを作成する
    - **Property 2: is_normal フィルタリングの正確性**
    - `is_normal=true` のスタッフのみが返され、`is_normal=false` または `null` のスタッフが含まれないことを検証
    - fast-check を使用して100回実行
    - **Validates: 要件 5.1**

- [x] 2. フロントエンド: `useNormalInitials` フックの実装
  - `WorkTaskDetailModal.tsx` 内に `useNormalInitials()` カスタムフックを追加する
  - モーダル起動時に `/api/employees/normal-initials` を呼び出してイニシャル一覧を取得する
  - API成功時かつ配列が空でない場合のみ `setInitials` を呼び出す（`res.data.initials?.length > 0` の条件チェック）
  - API失敗時または空配列時は `ASSIGNEE_OPTIONS` をフォールバックとして維持する
  - _要件: 5.2, 5.3, 5.4, 8.1_

  - [ ]* 2.1 `useNormalInitials` フックのユニットテストを作成する
    - モーダル起動時に `/api/employees/normal-initials` が呼び出されることを確認
    - APIエラー時に `ASSIGNEE_OPTIONS` がフォールバックとして使用されることを確認
    - _要件: 5.2, 5.4_

- [x] 3. フロントエンド: 全スタッフ選択フィールドへの動的イニシャル適用
  - `useNormalInitials()` が返すイニシャル配列を以下の全フィールドの `options` に渡す：
    - `sales_assignee`（営業担当）
    - `mediation_creator`（媒介作成者）
    - `employee_contract_creation`（社員が契約書作成）
    - `site_registration_requester`（サイト登録依頼者）- ハードコードから動的取得に変更
    - `floor_plan_confirmer`（間取図確認者）- ハードコードから動的取得に変更
  - _要件: 8.2, 8.3_

  - [ ]* 3.1 動的イニシャルの全フィールド適用プロパティテストを作成する
    - **Property 3: 動的イニシャルの全フィールド適用**
    - `useNormalInitials()` が返す配列が全スタッフ選択フィールドの `options` と等しいことを検証
    - fast-check を使用して100回実行
    - **Validates: 要件 8.2, 5.3**

- [ ] 4. チェックポイント - テストがすべて通ることを確認する
  - テストがすべて通ることを確認し、疑問点があればユーザーに確認する。

- [x] 5. フロントエンド: 字図・地積測量図URLフィールドのボタン選択化
  - `cadastral_map_url` フィールドを `EditableField type="url"` から `EditableButtonSelect options={['URL入力済み', '未']}` に変更する
  - 種別が「土」の場合のみ表示される既存の条件分岐を維持する
  - 現在の `cadastral_map_url` の値に応じて対応するボタンをハイライト表示する
  - _要件: 1.1, 1.2, 1.3_

  - [ ]* 5.1 ボタン選択値とハイライトのプロパティテストを作成する
    - **Property 1: ボタン選択値とハイライトの一致**
    - 選択値のボタンが `contained`、それ以外が `outlined` でレンダリングされることを検証
    - fast-check を使用して100回実行
    - **Validates: 要件 1.3**

- [x] 6. フロントエンド: 読み取り専用フィールドの実装
  - `cadastral_map_sales_input`（地積測量図・字図（営業入力））を `EditableField` から `ReadOnlyDisplayField` に変更する
  - `site_registration_requestor`（サイト登録依頼コメント）を `TextField multiline` から `ReadOnlyDisplayField` に変更する（複数行対応のため改行を表示）
  - _要件: 2.1, 2.2, 3.1, 3.2_

  - [ ]* 6.1 読み取り専用フィールドのユニットテストを作成する
    - `cadastral_map_sales_input` が `ReadOnlyDisplayField` として表示されることを確認
    - `site_registration_requestor` が `ReadOnlyDisplayField` として表示されることを確認
    - _要件: 2.1, 3.1_

- [x] 7. フロントエンド: パノラマフィールドのボタン選択化
  - `panorama` フィールドを `EditableField type="text"` から `EditableButtonSelect options={['あり']}` に変更する
  - 現在の `panorama` の値が「あり」の場合にボタンをハイライト表示する
  - _要件: 4.1, 4.2, 4.3_

  - [ ]* 7.1 パノラマフィールドのユニットテストを作成する
    - パノラマフィールドが `EditableButtonSelect options={['あり']}` として表示されることを確認
    - _要件: 4.1_

- [x] 8. フロントエンド: 間取図修正回数フィールドへの説明書き追加
  - `floor_plan_revision_count` フィールドの `EditableButtonSelect` の直後に赤字テキストを追加する
  - テキスト内容: 「ここでの修正とは、当社のミスによる修正のことです。CWの方のミスによる修正はカウントNGです！！」
  - 赤字表示には既存の `RedNote` コンポーネントまたは `Typography color="error"` を使用する
  - _要件: 6.1, 6.2_

  - [ ]* 8.1 説明書きのユニットテストを作成する
    - 間取図修正回数フィールドの下に赤字テキストが表示されることを確認
    - _要件: 6.1, 6.2_

- [x] 9. フロントエンド: メール配信フィールドの表示修正
  - 「確認後処理」セクションの `ReadOnlyDisplayField label="メール配信"` の `value` を `getValue('email_distribution') || null` に修正する
  - `email_distribution` が空の場合は空文字または「-」を表示する
  - _要件: 7.1, 7.2, 7.3_

  - [ ]* 9.1 メール配信フィールドのユニットテストを作成する
    - 「確認後処理」の「メール配信」に `email_distribution` の値が表示されることを確認
    - `email_distribution` が空の場合に空文字または「-」が表示されることを確認
    - _要件: 7.1, 7.2_

- [ ] 10. 最終チェックポイント - テストがすべて通ることを確認する
  - テストがすべて通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは要件番号で追跡可能
- バックエンド変更（タスク1）を先に実施することで、フロントエンドの動的取得（タスク2〜3）が正しく動作する
- プロパティテストには fast-check を使用し、各テストは最低100回実行する

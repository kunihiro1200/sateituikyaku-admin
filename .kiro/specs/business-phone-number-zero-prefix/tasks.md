# タスクリスト：業務電話番号先頭「0」自動補完

## タスク一覧

- [x] 1. PhoneNormalizerユーティリティの作成（フロントエンド）
  - [x] 1.1 `frontend/frontend/src/utils/phoneNormalizer.ts` を新規作成し `normalizePhoneNumber` 関数を実装する
  - [x] 1.2 `normalizePhoneNumber` のユニットテストを作成する（空文字・null・undefined・先頭0あり・先頭0なし・ハイフンあり・括弧ありの各ケース）
  - [x] 1.3 `normalizePhoneNumber` のプロパティベーステストを作成する（fast-checkを使用、Property 1・Property 2）

- [x] 2. PhoneNormalizerユーティリティの作成（バックエンド）
  - [x] 2.1 `backend/src/utils/phoneNormalizer.ts` を新規作成し `normalizePhoneNumber` 関数を実装する（フロントエンドと同一ロジック）
  - [x] 2.2 `normalizePhoneNumber` のユニットテストを作成する

- [x] 3. WorkTaskColumnMapperへの補完ロジック追加
  - [x] 3.1 `backend/src/services/WorkTaskColumnMapper.ts` に `normalizePhoneNumber` をインポートする
  - [x] 3.2 `mapToDatabase` メソッド内で `seller_contact_tel` / `buyer_contact_tel` カラムに `normalizePhoneNumber` を適用する
  - [x] 3.3 `WorkTaskColumnMapper.mapToDatabase` のプロパティベーステストを作成する（Property 3）
  - [x] 3.4 他カラムの変換動作が変わらないことを確認するユニットテストを追加する

- [x] 4. WorkTaskDetailModalへの補完ロジック追加（保存時）
  - [x] 4.1 `frontend/frontend/src/components/WorkTaskDetailModal.tsx` に `normalizePhoneNumber` をインポートする
  - [x] 4.2 `executeSave` 内で `editedData` の `seller_contact_tel` / `buyer_contact_tel` に `normalizePhoneNumber` を適用してから `api.put` に渡す

- [x] 5. WorkTaskDetailModalへの補完ロジック追加（表示時）
  - [x] 5.1 `getValue` 関数内で `seller_contact_tel` / `buyer_contact_tel` フィールドに対して `normalizePhoneNumber` を適用する
  - [x] 5.2 表示時補完のプロパティベーステストを作成する（Property 4）

- [ ] 6. 動作確認
  - [ ] 6.1 フロントエンドで先頭「0」なし電話番号を入力・保存し、DBに「0」補完済みで保存されることを確認する
  - [ ] 6.2 DBに先頭「0」なしで保存済みの値が表示時に補完されることを確認する
  - [ ] 6.3 スプレッドシート同期後に `seller_contact_tel` / `buyer_contact_tel` が補完済みであることを確認する
  - [ ] 6.4 空値・null の場合に「0」が付加されないことを確認する
  - [ ] 6.5 売主TEL・買主TEL以外のフィールドの動作に影響がないことを確認する

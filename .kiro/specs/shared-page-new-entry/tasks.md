# 実装計画: 共有ページ新規作成フォーム（shared-page-new-entry）

## 概要

既存の `NewSellerPage.tsx` / `NewBuyerPage.tsx` と同じパターンで、
`/shared-items/new` ルートに対応する新規作成ページとフォームコンポーネントを実装します。
バックエンドにはファイルアップロード用エンドポイントを追加します。

## タスク

- [x] 1. バックエンド: ファイルアップロードエンドポイントの追加
  - [x] 1.1 `backend/src/routes/sharedItems.ts` に `POST /api/shared-items/upload` エンドポイントを追加する
    - `multer` または `busboy` でmultipart/form-dataを受け取る
    - Supabase Storageの `shared-items` バケットにファイルをアップロードする
    - アップロード後の公開URLを `{ url: string }` 形式で返す
    - `type: 'pdf' | 'image'` パラメータでサブフォルダを分ける
    - _要件: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 1.2 アップロードエンドポイントのユニットテストを書く
    - 正常系: PDFファイルのアップロードでURLが返ること
    - 正常系: 画像ファイルのアップロードでURLが返ること
    - 異常系: ファイルなしでリクエストした場合に400エラーが返ること
    - _要件: 8.1, 8.2, 8.3, 8.4_

- [x] 2. フロントエンド: ユーティリティ関数の実装
  - [x] 2.1 `frontend/frontend/src/__tests__/sharedItemFormUtils.test.ts` を新規作成し、以下のユーティリティ関数を実装・テストする
    - `calculateNextId(entries: { id: number }[]): number` — 最大ID + 1を返す
    - `toggleStaff(selected: string[], staff: string): string[]` — スタッフ選択のトグル
    - `validateUrl(url: string): { isValid: boolean }` — URLバリデーション
    - _要件: 2.1, 7.2, 7.3, 9.2_

  - [ ]* 2.2 Property 1: ID採番の単調増加（fast-check）
    - **Property 1: ID採番の単調増加**
    - 任意のエントリーリストに対して `calculateNextId` が最大ID + 1を返すことを検証する
    - **Validates: 要件 2.1**

  - [ ]* 2.3 Property 2: スタッフ選択のトグル動作（fast-check）
    - **Property 2: スタッフ選択のトグル動作**
    - 任意のスタッフに対して2回クリックすると元の状態に戻ることを検証する（ラウンドトリップ）
    - **Validates: 要件 7.2, 7.3**

  - [ ]* 2.4 Property 3: 複数スタッフの独立した選択状態（fast-check）
    - **Property 3: 複数スタッフの独立した選択状態**
    - 複数スタッフを順番に選択したとき、各スタッフの選択状態が互いに独立して維持されることを検証する
    - **Validates: 要件 7.4**

  - [ ]* 2.5 Property 4: URLバリデーションの網羅性（fast-check）
    - **Property 4: URLバリデーションの網羅性**
    - `http://` または `https://` で始まらない任意の非空文字列に対して `validateUrl` がエラーを返すことを検証する
    - **Validates: 要件 9.2**

- [ ] 3. チェックポイント — ユーティリティ関数とバックエンドの確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 4. フロントエンド: `NewSharedItemForm.tsx` の実装
  - [x] 4.1 `frontend/frontend/src/components/NewSharedItemForm.tsx` を新規作成する
    - `NewSharedItemFormProps`（`onSaved`, `onCancel`）を受け取るコンポーネントを定義する
    - フォームマウント時に `GET /api/shared-items` でIDの最大値を取得し、次のIDを自動入力する
    - フォームマウント時に `GET /api/shared-items/staff` でスタッフ一覧を取得する
    - 今日の日付（YYYY/MM/DD形式）と認証ストアのスタッフ名を自動入力する
    - ID・日付・入力者フィールドを `readOnly` で表示する
    - _要件: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.2 共有場・項目ドロップダウンとテキストフィールドを実装する
    - `SHARING_LOCATIONS`（6件）と `CATEGORIES`（12件）のドロップダウンを実装する
    - タイトル・内容・打ち合わせ内容のテキストエリアを実装する
    - _要件: 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 5.3_

  - [x] 4.3 日付ピッカー・スタッフ選択ボタン・URLフィールドを実装する
    - 共有日・確認日の日付ピッカーを実装する（YYYY/MM/DD形式）
    - 通常スタッフのイニシャルボタン（複数選択可）を実装する
    - URLテキストフィールドを実装する
    - _要件: 6.1, 6.2, 7.1, 7.2, 7.3, 7.4, 9.1_

  - [x] 4.4 ファイル添付UI（PDF・画像）を実装する
    - PDFファイル選択UI（最大4件、PDF形式のみ）を実装する
    - 画像ファイル選択UI（最大4件、JPEG/PNG/GIF/WEBP）を実装する
    - 選択済みファイル名の一覧表示と削除ボタンを実装する
    - _要件: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 4.5 バリデーションと保存処理を実装する
    - 保存ボタンクリック時に必須フィールド（共有場・項目・タイトル）とURL形式・日付形式を検証する
    - バリデーション通過後、ファイルを `POST /api/shared-items/upload` でアップロードしてURLを取得する
    - アップロード済みURLを含むデータを `POST /api/shared-items` で送信する
    - 保存処理中は保存ボタンを `disabled` にする
    - 保存完了後に `onSaved()` を呼び出す
    - エラー時はエラーメッセージを表示してフォームを閉じない
    - _要件: 3.3, 4.3, 5.4, 6.3, 9.2, 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 4.6 `NewSharedItemForm` のユニットテストを書く
    - フォーム展開時に全フィールドが表示されること（要件 1.2）
    - キャンセルボタンで `onCancel` が呼ばれること（要件 1.3）
    - 今日の日付がYYYY/MM/DD形式で自動入力されること（要件 2.2）
    - ID・日付・入力者フィールドが `readOnly` であること（要件 2.4）
    - 共有場ドロップダウンに6つの選択肢があること（要件 3.1）
    - 項目ドロップダウンに12の選択肢があること（要件 4.1）
    - 必須フィールド未入力で保存するとエラーが表示されること（要件 3.3, 4.3, 5.4）
    - 保存処理中に保存ボタンが `disabled` であること（要件 10.5）
    - APIエラー時にエラーメッセージが表示されフォームが開いたままであること（要件 10.4）
    - _要件: 1.2, 1.3, 2.2, 2.4, 3.1, 3.3, 4.1, 4.3, 5.4, 10.4, 10.5_

- [x] 5. フロントエンド: `NewSharedItemPage.tsx` の実装と App.tsx へのルート追加
  - [x] 5.1 `frontend/frontend/src/pages/NewSharedItemPage.tsx` を新規作成する
    - `NewSharedItemForm` をレンダリングする薄いラッパーページを実装する
    - `onSaved` で `/shared-items` へナビゲートする
    - `onCancel` で `/shared-items` へナビゲートする
    - _要件: 1.1, 10.3_

  - [x] 5.2 `frontend/frontend/src/App.tsx` に `/shared-items/new` ルートを追加する
    - `NewSharedItemPage` をインポートし、`/shared-items/new` ルートを `ProtectedRoute` でラップして追加する
    - 既存の `/shared-items/:id` ルートより前に配置する（ルート順序の衝突を防ぐ）
    - _要件: 1.1_

- [x] 6. 最終チェックポイント — 全テストの確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 備考

- `*` が付いたタスクはオプションであり、MVPとして省略可能
- 各タスクは前のタスクの成果物を前提として積み上げる構造になっている
- プロパティテストは `fast-check` を使用し、最低100回のイテレーションで実行する
- テスト実行: `cd frontend/frontend && npx vitest --run`

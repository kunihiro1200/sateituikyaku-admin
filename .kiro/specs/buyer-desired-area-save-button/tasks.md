# 実装計画: buyer-desired-area-save-button

## 概要

`BuyerDesiredConditionsPage.tsx` に明示的な「保存」ボタンを追加する。
フィールド変更を `pendingChanges` に蓄積し、ボタン押下時に一括保存する。
バックエンドは変更なし。

## タスク

- [x] 1. 状態管理の追加（pendingChanges / hasChanges / isSaving）
  - `pendingChanges: Record<string, any>` state を追加
  - `hasChanges: boolean` state を追加
  - `isSaving: boolean` state を追加
  - `handleFieldChange(fieldName, newValue)` 関数を追加（pendingChanges に蓄積）
  - _要件: 1.2, 4.1_

  - [ ]* 1.1 Property 1 のプロパティテストを作成
    - **Property 1: フィールド変更後の hasChanges フラグ**
    - **Validates: Requirements 1.2**
    - fast-check を使用し、任意のフィールド名・値で `handleFieldChange` 呼び出し後に `hasChanges === true` になることを検証

- [x] 2. desired_area の onClose 自動保存を廃止し handleFieldChange に置き換え
  - `Select` の `onClose` ハンドラーから `handleInlineFieldSave` 呼び出しを削除
  - 代わりに `handleFieldChange('desired_area', selectedAreasRef.current.join('|'))` を呼び出す
  - チップ削除（`onDelete`）も同様に `handleFieldChange` に変更
  - `pendingAreasRef` は不要になるため削除
  - _要件: 1.1, 2.1_

- [x] 3. 保存ボタン UI の実装
  - `SaveIcon` を `@mui/icons-material` からインポート
  - ヘッダー右側に保存ボタンを配置
  - `hasChanges` が true のとき `color="warning"`、false のとき `color="primary"`
  - `isSaving || !hasChanges` のとき `disabled`
  - 保存中は `CircularProgress size={16}` + 「保存中...」、通常時は `SaveIcon` + 「保存」
  - _要件: 1.1, 1.2, 1.3, 4.1_

- [x] 4. handleSaveAll 関数の実装
  - `pendingChanges` が空の場合は早期リターン
  - `isSaving = true` にセット
  - 配信メール「要」時の必須バリデーション（`checkDistributionRequiredFields` を全フィールドに適用）
  - `buyerApi.update(buyer_number!, pendingChanges, { sync: true })` を呼び出す
  - 成功時: `setBuyer(result.buyer)`, `setPendingChanges({})`, `setHasChanges(false)`
  - `syncStatus` に応じたスナックバーメッセージ表示（synced / pending / failed）
  - 失敗時: エラースナックバー表示、`pendingChanges` はリセットしない
  - `finally` で `isSaving = false`
  - _要件: 1.4, 1.5, 2.1, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2_

  - [ ]* 4.1 Property 2 のプロパティテストを作成
    - **Property 2: 保存中のボタン無効化と完了後の再有効化**
    - **Validates: Requirements 1.3, 4.1, 4.2**
    - `isSaving` が保存中に true、完了後（成功・失敗問わず）に false になることを検証

  - [ ]* 4.2 Property 4 のプロパティテストを作成
    - **Property 4: 保存成功後の pendingChanges リセット**
    - **Validates: Requirements 1.4, 4.2**
    - 保存成功後に `hasChanges === false` かつ `pendingChanges` が空オブジェクトになることを検証

  - [ ]* 4.3 Property 5 のプロパティテストを作成
    - **Property 5: syncStatus に応じたスナックバーメッセージ**
    - **Validates: Requirements 3.2, 3.3, 3.4**
    - `syncStatus` が `'synced'`/`'pending'`/`'failed'` のそれぞれで対応するメッセージが表示されることを検証

- [x] 5. InlineEditableField の onSave を handleFieldChange に統合
  - `desired_area` 以外のフィールドの `InlineEditableField` の `onSave` コールバックを変更
  - `handleInlineFieldSave` の代わりに `handleFieldChange` を呼び出す
  - 既存の即時保存動作を廃止し、保存ボタン経由に統一
  - _要件: 1.1, 2.1_

- [ ] 6. チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 7. Pythonスクリプトで UTF-8 保存してデプロイ
  - `fix_desired_area_save_button.py` を作成し、変更済みの `BuyerDesiredConditionsPage.tsx` を UTF-8 で書き込む
  - `python fix_desired_area_save_button.py` を実行
  - `git add . && git commit -m "feat: add save button to BuyerDesiredConditionsPage" && git push origin main` でデプロイ
  - _要件: 1.1〜4.2 全て_

  - [ ]* 7.1 Property 3 のプロパティテストを作成
    - **Property 3: 保存後のラウンドトリップ**
    - **Validates: Requirements 2.2, 2.4**
    - 保存後に API から再取得した値が保存した値と一致することを検証（統合テスト）

## 備考

- `*` 付きのサブタスクはオプション（スキップ可能）
- 各タスクは前のタスクの成果物を前提とする
- 日本語を含むファイルの編集は必ず Python スクリプト経由で UTF-8 保存すること
- デプロイは `git add . && git commit -m "..." && git push origin main` で行う

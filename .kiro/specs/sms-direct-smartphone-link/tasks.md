# Implementation Tasks

## Task 1: handleSmsTemplateSelect関数の修正

**説明**: テンプレート選択後に確認ダイアログをスキップし、即座にSMSアプリを開くように修正

**ファイル**: `frontend/frontend/src/pages/CallModePage.tsx`

**変更内容**:
1. 関数を`async`に変更
2. 電話番号の存在チェックを追加
3. 確認ダイアログの表示処理を削除
4. 活動履歴の記録を非同期で実行
5. 担当フィールドの自動セットを非同期で実行
6. SMSアプリを即座に開く処理を追加
7. 成功メッセージの表示を追加
8. 活動履歴の再読み込みをバックグラウンドで実行

**Correctness Properties**: Property 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13

---

## Task 2: handleConfirmSend関数の修正

**説明**: SMS送信部分を削除（Email送信は引き続き確認ダイアログを使用）

**ファイル**: `frontend/frontend/src/pages/CallModePage.tsx`

**変更内容**:
1. `type === 'sms'` の分岐を削除
2. Email送信の処理は維持

**Correctness Properties**: Property 5

---

## Task 3: Unit Testsの実装

**説明**: 特定の例、エッジケース、エラー条件を検証するUnit Testsを実装

**ファイル**: `frontend/frontend/src/pages/__tests__/CallModePage.sms.test.tsx`

**テストケース**:
1. テンプレート選択後に即座にSMSアプリが開くことを確認
2. 電話番号が空の場合にエラーメッセージが表示されることを確認
3. メッセージが670文字を超える場合にエラーメッセージが表示されることを確認
4. テンプレート生成が失敗した場合にエラーメッセージが表示されることを確認
5. 活動履歴の記録が失敗してもSMS送信が継続されることを確認
6. 担当フィールドの更新が失敗してもSMS送信が継続されることを確認
7. 活動履歴が正しい形式で記録されることを確認
8. 担当フィールドが正しく更新されることを確認

**Correctness Properties**: All Properties (1-13)

---

## Task 4: Property Testsの実装

**説明**: 全ての入力に対して普遍的なプロパティを検証するProperty Testsを実装

**ファイル**: `frontend/frontend/src/pages/__tests__/CallModePage.sms.property.test.tsx`

**テストケース**:
1. Property 1: 全てのテンプレートで確認ダイアログが表示されずSMSアプリが開く
2. Property 2: 全てのテンプレートでメッセージ内容が正しくSMSアプリに渡される
3. Property 3: 全ての売主データで電話番号が正しくSMSアプリに渡される
4. Property 4: 全てのテンプレートで活動履歴が正しい形式で記録される
5. Property 6: 電話番号が空の場合に必ずエラーが表示される
6. Property 8: メッセージが670文字を超える場合に必ずエラーが表示される
7. Property 10-12: 全てのテンプレートで担当フィールドが正しく更新される

**Configuration**:
- 最小100回の反復実行
- fast-checkライブラリを使用
- タグ形式: **Feature: sms-direct-smartphone-link, Property {number}: {property_text}**

**Correctness Properties**: Property 1, 2, 3, 4, 6, 8, 10, 11, 12

---

## Task 5: 手動テスト

**説明**: 実機とブラウザで動作確認を実施

**テスト項目**:
1. **実機テスト**: 実際のスマートフォンでSMSアプリが正しく開くことを確認
   - iOS（Safari）
   - Android（Chrome）
2. **ブラウザテスト**: デスクトップブラウザで動作確認
   - Chrome
   - Safari
   - Edge
3. **ユーザビリティテスト**: 営業担当者による実際の使用感の確認
   - テンプレート選択からSMS送信までの操作がスムーズか
   - エラーメッセージが分かりやすいか
   - 活動履歴が正しく記録されているか

**Correctness Properties**: All Properties (1-13)

---

## Task 6: ドキュメント更新

**説明**: 変更内容をドキュメントに反映

**更新対象**:
1. **README.md**: SMS送信機能の使い方を更新
2. **CHANGELOG.md**: 変更履歴を追加

**内容**:
- 確認ダイアログがスキップされることを明記
- エラーケースの説明を追加
- 既存機能（担当フィールド自動セット、活動履歴記録）が維持されることを明記

---

## 実装順序

1. Task 1: handleSmsTemplateSelect関数の修正（最優先）
2. Task 2: handleConfirmSend関数の修正
3. Task 3: Unit Testsの実装
4. Task 4: Property Testsの実装
5. Task 5: 手動テスト
6. Task 6: ドキュメント更新

---

## 完了条件

- [ ] Task 1が完了し、テンプレート選択後に即座にSMSアプリが開く
- [ ] Task 2が完了し、確認ダイアログのSMS部分が削除されている
- [ ] Task 3が完了し、全てのUnit Testsがパスする
- [ ] Task 4が完了し、全てのProperty Testsがパスする
- [ ] Task 5が完了し、実機とブラウザで動作確認が完了
- [ ] Task 6が完了し、ドキュメントが更新されている
- [ ] 全てのCorrectness Properties（1-13）が検証されている

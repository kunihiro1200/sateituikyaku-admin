# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - SMS本文の時刻・住所フォーマットバグ
  - **重要**: このプロパティベーステストは修正を実装する**前**に作成すること
  - **目標**: バグが存在することを示すカウンターサンプルを発見する
  - **CRITICAL**: このテストは未修正コードで**FAIL**することが期待される — 失敗がバグの存在を証明する
  - **修正を試みないこと**: テストが失敗しても、コードを修正しようとしないこと
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
    - `viewing_time = "Sat Dec 30 1899 16:00:00 GMT+0900 (Japan Standard Time)"` を使用
    - `address = "Oita, Beppu, Akibacho, 7−24"`, `display_address = "大分県別府市秋葉町7-24"` を使用
  - テスト内容（デザインの Bug Condition より）:
    - `generatePreDaySmsBody` に Dateオブジェクト文字列の `viewing_time` を渡す
    - SMS本文に `GMT` や `Standard Time` が含まれることを確認（`isBugCondition_Time` が true）
    - `display_address` が存在するのに `address`（英語）が使われることを確認（`isBugCondition_Address` が true）
  - テストアサーション（デザインの Expected Behavior より）:
    - SMS本文に `HH:MM` 形式の時刻（例: `16:00`）が含まれること
    - SMS本文に `GMT` や `Standard Time` が含まれないこと
    - SMS本文に `display_address` の日本語住所が含まれること
    - SMS本文に英語住所（`Oita`, `Beppu`）が含まれないこと
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが**FAIL**する（これが正しい — バグの存在を証明する）
  - 発見したカウンターサンプルを記録して根本原因を理解する
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. 保全プロパティテストを作成する（修正実装前）
  - **Property 2: Preservation** - 既存の正常動作の保全
  - **重要**: 観察優先メソドロジーに従うこと
  - **観察**: 未修正コードでバグ条件に該当しない入力の動作を観察・記録する
    - `viewing_time = "14:30"` を渡す → SMS本文に `14:30` が含まれることを確認
    - `viewing_time = null` を渡す → SMS本文の時刻部分が空文字列になることを確認
    - `display_address = null`, `address = "大分県別府市秋葉町7-24"` → `address` が使用されることを確認
    - 内覧日が木曜日 → SMS本文が「明後日の〇月〇日」で始まることを確認
    - 内覧日が木曜日以外 → SMS本文が「明日の〇月〇日」で始まることを確認
  - プロパティベーステストを作成（デザインの Preservation Requirements より）:
    - `viewing_time` が既に `HH:MM` 形式の場合、修正前後で同じSMS本文が生成されること
    - `viewing_time` が空またはnullの場合、時刻部分が空文字列のままであること
    - `display_address` が空またはnullで `address` に日本語住所がある場合、`address` が使用されること
    - 木曜判定ロジックが変わらないこと
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが**PASS**する（ベースライン動作を確認）
  - テストを作成し、実行し、PASSを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. 内覧前日SMSバグの修正

  - [x] 3.1 Fix 1: 時刻フォーマット正規化処理を実装する
    - `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` の `generatePreDaySmsBody` 関数（約120行目）を修正
    - `const timeStr = buyer.viewing_time || '';` を以下のロジックに置き換える:
      ```typescript
      const rawTime = buyer.viewing_time || '';
      let timeStr = '';
      if (rawTime) {
        if (/^\d{1,2}:\d{2}$/.test(rawTime)) {
          timeStr = rawTime;
        } else {
          const dateObj = new Date(rawTime);
          if (!isNaN(dateObj.getTime())) {
            const hours = dateObj.getHours().toString().padStart(2, '0');
            const minutes = dateObj.getMinutes().toString().padStart(2, '0');
            timeStr = `${hours}:${minutes}`;
          }
        }
      }
      ```
    - _Bug_Condition: isBugCondition_Time(viewing_time) — viewing_time が /^\d{1,2}:\d{2}$/ にマッチしない場合_
    - _Expected_Behavior: SMS本文の時刻が HH:MM 形式に正規化され、GMT や Standard Time が含まれない_
    - _Preservation: viewing_time が既に HH:MM 形式の場合はそのまま使用、null/空の場合は空文字列のまま_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [x] 3.2 Fix 2: 住所取得優先順位を変更する
    - `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` のSMS生成箇所（約903行目）を修正
    - `const address = property?.property_address || property?.address || '';` を以下に置き換える:
      ```typescript
      const address = property?.display_address || property?.property_address || property?.address || '';
      ```
    - _Bug_Condition: isBugCondition_Address(property) — display_address が日本語で address が英語の場合_
    - _Expected_Behavior: display_address が存在する場合は display_address を優先して使用する_
    - _Preservation: display_address が空またはnullの場合は property_address → address の順にフォールバック_
    - _Requirements: 2.3, 2.4, 3.5_

  - [x] 3.3 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - SMS本文の時刻・住所フォーマット正規化
    - **重要**: タスク1で作成した**同じテスト**を再実行する — 新しいテストを作成しないこと
    - タスク1のテストはExpected Behaviorをエンコードしている
    - このテストがPASSすることで、期待される動作が満たされていることを確認する
    - バグ条件の探索テスト（タスク1）を実行する
    - **期待される結果**: テストが**PASS**する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 既存動作の保全
    - **重要**: タスク2で作成した**同じテスト**を再実行する — 新しいテストを作成しないこと
    - 保全プロパティテスト（タスク2）を実行する
    - **期待される結果**: テストが**PASS**する（リグレッションがないことを確認）
    - 修正後も全テストがPASSすることを確認する

- [x] 4. チェックポイント — 全テストのPASSを確認する
  - 全テスト（バグ条件テスト・保全テスト）がPASSすることを確認する
  - 疑問点があればユーザーに確認する

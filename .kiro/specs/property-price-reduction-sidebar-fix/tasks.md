# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 値下げ予約日削除後のサイドバー即時更新なし
  - **重要**: このテストは未修正コードで必ず FAIL する - 失敗がバグの存在を証明する
  - **修正を試みないこと** - テストが失敗しても、コードやテストを修正しない
  - **注意**: このテストは期待動作をエンコードしている - 修正後にパスすることで修正を検証する
  - **目的**: バグが存在することを示すカウンターサンプルを収集する
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - `handleSavePrice` 実行後に `propertyPriceReductionUpdated` イベントが発火されないことを確認
  - `price_reduction_scheduled_date` を null に変更して保存した後、`allListings` の該当物件の `price_reduction_scheduled_date` が即座に null になっていないことを確認（Bug Condition: `isBugCondition(X)` が true の場合）
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが FAIL する（これが正しい - バグの存在を証明する）
  - 発見されたカウンターサンプルを記録して根本原因を理解する（例: 「保存後も `allListings` の `price_reduction_scheduled_date` が古い値のまま」）
  - タスク完了条件: テストが作成され、実行され、失敗が記録されたとき
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - 既存動作の保持（confirmation更新・他フィールド保存）
  - **重要**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`isBugCondition` が false の場合）の動作を観察する
  - 観察1: `confirmation` フィールドを更新すると `propertyConfirmationUpdated` イベントが発火し、`allListings` が即座に更新される
  - 観察2: `price_reduction_scheduled_date` を変更しない保存操作では `propertyPriceReductionUpdated` イベントが発火しない
  - 観察3: 価格情報以外のフィールドを保存しても他のサイドバーカテゴリーのカウントが変わらない
  - 観察した動作パターンを保持するプロパティベーステストを作成する（Preservation Requirements より）
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが PASS する（これがベースライン動作を確認する）
  - タスク完了条件: テストが作成され、実行され、未修正コードでパスしていることが確認されたとき
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [-] 3. 値下げ予約日削除後のサイドバー即時更新バグを修正する

  - [x] 3.1 `PropertyListingDetailPage.tsx` の `handleSavePrice` にイベント発火を追加する
    - `api.put()` 成功後、`editedData` に `price_reduction_scheduled_date` が含まれている場合に `propertyPriceReductionUpdated` カスタムイベントを発火する
    - `await fetchPropertyData()` の前に発火することで `PropertyListingsPage` が即座に更新される
    - 発火タイミング: `propertyConfirmationUpdated` イベントと同様のパターンに従う
    - ```typescript
      if (editedData.price_reduction_scheduled_date !== undefined) {
        window.dispatchEvent(new CustomEvent('propertyPriceReductionUpdated', {
          detail: {
            propertyNumber,
            priceReductionScheduledDate: editedData.price_reduction_scheduled_date
          }
        }));
      }
      ```
    - _Bug_Condition: `isBugCondition(X)` where `X.price_reduction_scheduled_date` が null に変更された AND `allListings` がまだ即時更新されていない_
    - _Expected_Behavior: 保存後に `allListings` 内の該当物件の `price_reduction_scheduled_date` が null になり、`calculatePropertyStatus()` が `price_reduction_due` を返さなくなること_
    - _Preservation: `confirmation` フィールドの更新など既存の他フィールドの動作が変わらないこと_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 `PropertyListingsPage.tsx` に `propertyPriceReductionUpdated` イベントリスナーを追加する
    - `propertyConfirmationUpdated` のリスナーと同様のパターンで新規 `useEffect` フックを追加する
    - イベント受信時に `setAllListings` で対象物件の `price_reduction_scheduled_date` を更新する
    - `pageDataCache.invalidate(CACHE_KEYS.PROPERTY_LISTINGS)` を呼び出してキャッシュを無効化する
    - クリーンアップ関数でイベントリスナーを削除する
    - ```typescript
      useEffect(() => {
        const handlePriceReductionUpdate = (event: CustomEvent) => {
          const { propertyNumber, priceReductionScheduledDate } = event.detail;
          setAllListings(prevListings =>
            prevListings.map(listing =>
              listing.property_number === propertyNumber
                ? { ...listing, price_reduction_scheduled_date: priceReductionScheduledDate }
                : listing
            )
          );
          pageDataCache.invalidate(CACHE_KEYS.PROPERTY_LISTINGS);
        };
        window.addEventListener('propertyPriceReductionUpdated', handlePriceReductionUpdate as EventListener);
        return () => {
          window.removeEventListener('propertyPriceReductionUpdated', handlePriceReductionUpdate as EventListener);
        };
      }, []);
      ```
    - _Bug_Condition: `isBugCondition(X)` where `PropertyListingsPage` の `allListings` が即時更新されていない_
    - _Expected_Behavior: イベント受信後に `allListings` が即座に更新され、`calculatePropertyStatus()` が `price_reduction_due` を返さなくなること_
    - _Preservation: 他の物件の `allListings` エントリが変更されないこと_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [x] 3.3 バグ条件の探索テストが現在パスすることを確認する
    - **Property 1: Expected Behavior** - 値下げ予約日削除後のサイドバー即時更新
    - **重要**: タスク1と同じテストを再実行する - 新しいテストを作成しない
    - タスク1のテストは期待動作をエンコードしている
    - このテストがパスすると、期待動作が満たされていることを確認する
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 保全テストが引き続きパスすることを確認する
    - **Property 2: Preservation** - 既存動作の保持
    - **重要**: タスク2と同じテストを再実行する - 新しいテストを作成しない
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認する）
    - 修正後も全テストがパスすることを確認する（リグレッションなし）

- [x] 4. チェックポイント - 全テストがパスすることを確認する
  - 全テストがパスすることを確認する。疑問が生じた場合はユーザーに確認する。

# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - FIプレフィックス売主の住所に「大分県」が誤付加されるバグ
  - **CRITICAL**: このテストは修正前のコードで必ず FAIL する — 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターエグザンプルを発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
    - FIプレフィックスの売主ID（例: `FI17`）と「大分県」を含まない福岡県内の住所を使用
    - `geocodeAddress('福岡市中央区天神1-1-1')` を呼び出し、内部で「大分県」が付加されることを確認
    - `geocodeAddress('北九州市小倉北区魚町1-1-1')` でも同様に確認
  - テストは `backend/src/services/GeocodingService.ts` の `geocodeAddress()` メソッドをモックして実行
  - Bug Condition（design.mdより）: `input.sellerPrefix NOT IN ['AA'] AND NOT input.address.includes('大分県') AND geocodeAddress() ADDS '大分県' to input.address`
  - Expected Behavior（design.mdより）: FIプレフィックスの場合、「大分県」を付加せず元の住所のままジオコーディングを実行する
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 発見されたカウンターエグザンプルを記録してルート原因を理解する
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1_

- [x] 2. 保持プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - AAプレフィックス売主への「大分県」自動付加動作の保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 修正前のコードでAAプレフィックスの動作を観察する:
    - `geocodeAddress('大分市府内町1-1-1')` → 「大分県大分市府内町1-1-1」として処理されることを確認
    - `geocodeAddress('別府市北浜1-1-1')` → 「大分県別府市北浜1-1-1」として処理されることを確認
    - `geocodeAddress('大分県大分市府内町1-1-1')` → 重複付加されないことを確認
  - 観察した動作に基づいてプロパティベーステストを作成する:
    - AAプレフィックスの売主IDと「大分県」を含まない住所の組み合わせで、「大分県」が付加されることを検証
    - 既に都道府県名を含む住所では重複付加されないことを検証
  - Preservation Requirements（design.mdより）: AAプレフィックスの売主への「大分県」自動付加、既に都道府県が含まれる住所への重複付加防止
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（これがベースライン動作を確認する）
  - テストを作成し、実行し、修正前コードでPASSを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2_

- [x] 3. FIプレフィックス売主の「大分県」誤付加バグを修正する

  - [x] 3.1 GeocodingService.ts の geocodeAddress() メソッドを修正する
    - `geocodeAddress(address: string, sellerPrefix?: string): Promise<Coordinates | null>` にシグネチャを変更
    - 「大分県」自動付加の条件を変更する:
      - 変更前: `if (!address.includes('大分県'))`
      - 変更後: `if (!address.includes('大分県') && (!sellerPrefix || sellerPrefix === 'AA'))`
    - デバッグログに `sellerPrefix` 情報を追加する
    - 後方互換性を維持する（`sellerPrefix` 未指定時は従来通り「大分県」を付加）
    - _Bug_Condition: `input.sellerPrefix NOT IN ['AA'] AND NOT input.address.includes('大分県')` の場合に「大分県」が誤付加される_
    - _Expected_Behavior: FIプレフィックスの場合は「大分県」を付加せず、AAプレフィックスまたは未指定の場合のみ「大分県」を付加する_
    - _Preservation: AAプレフィックスの売主への「大分県」自動付加は変更しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [x] 3.2 呼び出し元（SellerService等）で sellerPrefix を渡すように修正する
    - `backend/src/services/SellerService.supabase.ts` で `geocodeAddress()` を呼び出している箇所を特定する
    - 売主IDからプレフィックスを抽出して渡す: `sellerId.substring(0, 2).toUpperCase()`
    - 例: `geocodeAddress(address, seller.id.substring(0, 2).toUpperCase())`
    - 他に `geocodeAddress()` を呼び出している箇所があれば同様に修正する
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - FIプレフィックス売主の住所に「大分県」が付加されない
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 保持テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - AAプレフィックス売主への「大分県」自動付加動作の保持
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク2の保持プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. 影響を受けたFI売主の座標を再ジオコーディングするスクリプトを作成・実行する
  - FIプレフィックスの売主で、誤った座標（大分県内の座標）が保存されている売主を特定するSQLクエリを作成する
  - 対象売主の住所を正しい住所で再ジオコーディングするスクリプトを作成する
    - `backend/src/scripts/` または `backend/` 配下にスクリプトを配置する
    - 修正後の `geocodeAddress()` を使用して正しい座標を取得する
    - `sellers` テーブルの `latitude`、`longitude` カラムを更新する
  - スクリプトを実行してFI17など影響を受けた売主の座標を修正する
  - 修正後の座標が福岡県内の正しい位置を示していることを確認する
  - _Requirements: 2.2, 2.3_

- [x] 5. チェックポイント — 全テストが PASS することを確認する
  - 全ユニットテストを実行して PASS することを確認する
  - 全プロパティベーステストを実行して PASS することを確認する
  - FI17の通話モードページで物件位置ピンが福岡県内の正しい場所に表示されることを確認する
  - AAプレフィックスの売主の通話モードページで物件位置ピンが引き続き正しく表示されることを確認する
  - 疑問点があればユーザーに確認する

# 物件リストサイドバーの古いステータス表示バグ修正タスク

## Phase 1: 探索的テスト（Bug Exploration）

### 1.1 バグ条件の確認テストを作成

**目的**: AA12497とAA12459がバグ条件を満たすことを確認

**ファイル**: `backend/src/__tests__/property-listing-sidebar-stale-status-bug-exploration.test.ts`

**内容**:
- AA12497とAA12459の`sidebar_status`が「レインズ登録＋SUUMO登録」であることを確認
- AA12497とAA12459の`suumo_url`が空ではないことを確認
- バグ条件`C(X)`を満たすことをアサート

**期待結果**: テストが成功（バグが存在することを確認）

---

### 1.2 calculateSidebarStatusの動作確認テストを作成

**目的**: `calculateSidebarStatus()`がSUUMO URLを正しくチェックしているか確認

**ファイル**: `backend/src/__tests__/property-listing-sidebar-stale-status-bug-exploration.test.ts`

**内容**:
- SUUMO URLが登録されている物件データを作成
- `calculateSidebarStatus()`を呼び出し
- 「レインズ登録＋SUUMO登録」以外のステータスが返されることを確認

**期待結果**: テストが失敗する可能性（現在の実装がSUUMO URLを正しくチェックしていない場合）

---

### 1.3 探索的テストを実行

**コマンド**: `npm test property-listing-sidebar-stale-status-bug-exploration`

**期待結果**: テストが成功または失敗し、バグの存在と根本原因を確認

---

## Phase 2: 修正実装

### 2.1 calculateSidebarStatusメソッドを修正

**ファイル**: `backend/src/services/PropertyListingSyncService.ts`

**変更内容**:
1. SUUMO URL判定を厳密化
   - `!suumoUrl` → `!suumoUrl || suumoUrl.trim() === ''`
2. ログ出力を追加
   - SUUMO URLが登録されている場合、デバッグログを出力

**修正箇所**:
```typescript
// ⑥ SUUMO / レインズ登録必要
if (atbbStatus === '一般・公開中' || atbbStatus === '専任・公開中') {
  const scheduledDate = this.lookupGyomuList(propertyNumber, gyomuListData, '公開予定日');
  const suumoUrl = row['Suumo URL'];
  const suumoRegistration = row['Suumo登録'];

  // 🚨 修正: SUUMO URLが空であることを厳密にチェック
  const isSuumoUrlEmpty = !suumoUrl || (typeof suumoUrl === 'string' && suumoUrl.trim() === '');

  if (scheduledDate &&
      this.isDateBeforeYesterday(scheduledDate) &&
      isSuumoUrlEmpty &&
      suumoRegistration !== 'S不要') {
    return atbbStatus === '一般・公開中'
      ? 'SUUMO URL　要登録'
      : 'レインズ登録＋SUUMO登録';
  }
}
```

---

### 2.2 同期処理でsidebar_statusを常に再計算

**ファイル**: `backend/src/services/PropertyListingSyncService.ts`

**変更内容**:
`detectUpdatedPropertyListings()`メソッドで、`sidebar_status`の再計算結果がDB値と異なる場合、変更として検出する（既に実装済み）

**確認箇所**:
```typescript
// sidebar_statusの再計算結果が現在のDB値と異なる場合も変更として検出
const newSidebarStatus = this.calculateSidebarStatus(row);
const currentSidebarStatus = dbProperty.sidebar_status || '';
if (newSidebarStatus !== currentSidebarStatus) {
  changes['sidebar_status'] = {
    old: currentSidebarStatus,
    new: newSidebarStatus
  };
}
```

**確認**: この実装が正しく動作していることを確認

---

### 2.3 既存データの修正スクリプトを作成

**ファイル**: `backend/fix-property-listing-sidebar-stale-status.ts`

**内容**:
1. AA12497とAA12459の現在の`sidebar_status`を確認
2. `calculateSidebarStatus()`を呼び出して正しいステータスを計算
3. データベースの`sidebar_status`を更新
4. 更新結果をログ出力

**実行**: `npx ts-node backend/fix-property-listing-sidebar-stale-status.ts`

---

## Phase 3: 修正検証テスト（Fix Checking）

### 3.1 修正後のcalculateSidebarStatusテストを作成

**ファイル**: `backend/src/__tests__/property-listing-sidebar-stale-status-fix-checking.test.ts`

**内容**:
- SUUMO URLが登録されている物件データを作成
- 修正後の`calculateSidebarStatus()`を呼び出し
- 「レインズ登録＋SUUMO登録」以外のステータスが返されることを確認

**期待結果**: テストが成功（修正が正しく動作）

---

### 3.2 AA12497とAA12459の修正確認テストを作成

**ファイル**: `backend/src/__tests__/property-listing-sidebar-stale-status-fix-checking.test.ts`

**内容**:
- AA12497とAA12459の`sidebar_status`を確認
- 「レインズ登録＋SUUMO登録」ではないことを確認

**期待結果**: テストが成功（既存データが修正された）

---

### 3.3 修正検証テストを実行

**コマンド**: `npm test property-listing-sidebar-stale-status-fix-checking`

**期待結果**: 全テストが成功

---

## Phase 4: 保存テスト（Preservation Checking）

### 4.1 SUUMO URL空の物件の保存テストを作成

**ファイル**: `backend/src/__tests__/property-listing-sidebar-stale-status-preservation.test.ts`

**内容**:
- SUUMO URLが空の物件データを作成
- `calculateSidebarStatus()`を呼び出し
- 「レインズ登録＋SUUMO登録」ステータスが返されることを確認

**期待結果**: テストが成功（既存機能が保存されている）

---

### 4.2 他のカテゴリーの保存テストを作成

**ファイル**: `backend/src/__tests__/property-listing-sidebar-stale-status-preservation.test.ts`

**内容**:
- 未報告、未完了、公開前情報などの物件データを作成
- `calculateSidebarStatus()`を呼び出し
- 期待されるステータスが返されることを確認

**期待結果**: テストが成功（他のカテゴリーの判定ロジックが変更されていない）

---

### 4.3 保存テストを実行

**コマンド**: `npm test property-listing-sidebar-stale-status-preservation`

**期待結果**: 全テストが成功

---

## Phase 5: 統合テスト

### 5.1 同期処理の統合テストを作成

**ファイル**: `backend/src/__tests__/property-listing-sidebar-stale-status-integration.test.ts`

**内容**:
1. テスト用の物件データをスプレッドシートに追加
2. `syncUpdatedPropertyListings()`を実行
3. データベースの`sidebar_status`が正しく更新されることを確認
4. テストデータをクリーンアップ

**期待結果**: テストが成功（同期処理が正しく動作）

---

### 5.2 サイドバーカウントの確認テストを作成

**ファイル**: `backend/src/__tests__/property-listing-sidebar-stale-status-integration.test.ts`

**内容**:
1. 「レインズ登録＋SUUMO登録」カテゴリーの物件数を確認
2. バグ条件を満たす物件が0件であることを確認

**期待結果**: テストが成功（サイドバーのカウントが正しい）

---

### 5.3 統合テストを実行

**コマンド**: `npm test property-listing-sidebar-stale-status-integration`

**期待結果**: 全テストが成功

---

## Phase 6: デプロイと検証

### 6.1 バックエンドをデプロイ

**コマンド**: `git push origin main`

**確認**: Vercelで自動デプロイが成功することを確認

---

### 6.2 本番環境で動作確認

**手順**:
1. 物件リストページを開く
2. サイドバーの「レインズ登録＋SUUMO登録」カテゴリーをクリック
3. AA12497とAA12459が表示されないことを確認
4. カウントが0件であることを確認

**期待結果**: バグが修正され、正しい物件のみが表示される

---

### 6.3 他のカテゴリーの動作確認

**手順**:
1. 未報告、未完了、公開前情報などの他のカテゴリーをクリック
2. 期待される物件が表示されることを確認

**期待結果**: 他のカテゴリーの動作が変更されていない

---

## 完了基準

- [ ] 探索的テストが成功（バグの存在を確認）
- [ ] `calculateSidebarStatus()`メソッドを修正
- [ ] 既存データ（AA12497, AA12459）を修正
- [ ] 修正検証テストが成功
- [ ] 保存テストが成功
- [ ] 統合テストが成功
- [ ] 本番環境でバグが修正されていることを確認
- [ ] 他のカテゴリーの動作が変更されていないことを確認

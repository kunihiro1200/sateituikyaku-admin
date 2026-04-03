# 売主リスト「訪問日前日」カテゴリのカウント不一致修正 - 実装タスク

## タスク概要

バックエンドのSQLクエリから `.neq('visit_assignee', '外す')` を削除し、フロントエンドと同じロジックに統一する。

---

## タスク一覧

### 1. バックエンド修正

#### 1.1 訪問日前日カウントの修正

**ファイル**: `backend/src/services/SellerService.supabase.ts`

**行番号**: 約2160行目

**修正内容**:
```typescript
// 変更前
const { data: visitAssigneeSellers } = await this.table('sellers')
  .select('visit_date, visit_assignee, visit_reminder_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  .neq('visit_assignee', '外す')  // ← この行を削除
  .not('visit_date', 'is', null);

// 変更後
const { data: visitAssigneeSellers } = await this.table('sellers')
  .select('visit_date, visit_assignee, visit_reminder_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  // 「外す」は有効な営業担当として扱う
  .not('visit_date', 'is', null);
```

**成功基準**:
- `.neq('visit_assignee', '外す')` が削除されている
- コメント「「外す」は有効な営業担当として扱う」が追加されている

---

#### 1.2 訪問済みカウントの修正

**ファイル**: `backend/src/services/SellerService.supabase.ts`

**行番号**: 約2190行目

**修正内容**:
```typescript
// 変更前
const { count: visitCompletedCount } = await this.table('sellers')
  .select('*', { count: 'exact', head: true })
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  .neq('visit_assignee', '外す')  // ← この行を削除
  .lt('visit_date', todayJST);

// 変更後
const { count: visitCompletedCount } = await this.table('sellers')
  .select('*', { count: 'exact', head: true })
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  // 「外す」は有効な営業担当として扱う
  .lt('visit_date', todayJST);
```

**成功基準**:
- `.neq('visit_assignee', '外す')` が削除されている
- コメント「「外す」は有効な営業担当として扱う」が追加されている

---

#### 1.3 当日TEL（担当）カウントの修正

**ファイル**: `backend/src/services/SellerService.supabase.ts`

**行番号**: 約2195行目

**修正内容**:
```typescript
// 変更前
const { data: todayCallAssignedSellers } = await this.table('sellers')
  .select('id, visit_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  .neq('visit_assignee', '外す')  // ← この行を削除
  .lte('next_call_date', todayJST)
  .ilike('status', '%追客中%')
  .not('status', 'ilike', '%追客不要%')
  .not('status', 'ilike', '%専任媒介%')
  .not('status', 'ilike', '%一般媒介%')
  .not('status', 'ilike', '%他社買取%');

// 変更後
const { data: todayCallAssignedSellers } = await this.table('sellers')
  .select('id, visit_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  // 「外す」は有効な営業担当として扱う
  .lte('next_call_date', todayJST)
  .ilike('status', '%追客中%')
  .not('status', 'ilike', '%追客不要%')
  .not('status', 'ilike', '%専任媒介%')
  .not('status', 'ilike', '%一般媒介%')
  .not('status', 'ilike', '%他社買取%');
```

**成功基準**:
- `.neq('visit_assignee', '外す')` が削除されている
- コメント「「外す」は有効な営業担当として扱う」が追加されている

---

#### 1.4 担当(イニシャル)親カテゴリカウントの修正

**ファイル**: `backend/src/services/SellerService.supabase.ts`

**行番号**: 約2210行目

**修正内容**:
```typescript
// 変更前
const { data: allAssignedSellers } = await this.table('sellers')
  .select('visit_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  .neq('visit_assignee', '外す')  // ← この行を削除
  .not('status', 'ilike', '%一般媒介%')
  .not('status', 'ilike', '%専任媒介%')
  .not('status', 'ilike', '%追客不要%')
  .not('status', 'ilike', '%他社買取%');

// 変更後
const { data: allAssignedSellers } = await this.table('sellers')
  .select('visit_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  // 「外す」は有効な営業担当として扱う
  .not('status', 'ilike', '%一般媒介%')
  .not('status', 'ilike', '%専任媒介%')
  .not('status', 'ilike', '%追客不要%')
  .not('status', 'ilike', '%他社買取%');
```

**成功基準**:
- `.neq('visit_assignee', '外す')` が削除されている
- コメント「「外す」は有効な営業担当として扱う」が追加されている

---

### 2. テスト

#### 2.1 ローカル環境でのテスト

**手順**:
1. バックエンドサーバーを再起動
2. 売主リストページを開く
3. サイドバーの「①訪問日前日」カテゴリのカウントを確認
4. カテゴリをクリックして一覧を表示
5. サイドバーのカウント数と一覧の表示件数が一致することを確認

**成功基準**:
- サイドバーのカウント数と一覧の表示件数が一致する
- 営担が「外す」の売主も含まれる

---

#### 2.2 本番環境でのテスト

**手順**:
1. デプロイ完了後、本番環境の売主リストページを開く
2. サイドバーの「①訪問日前日」カテゴリのカウントを確認
3. カテゴリをクリックして一覧を表示
4. サイドバーのカウント数と一覧の表示件数が一致することを確認

**成功基準**:
- サイドバーのカウント数と一覧の表示件数が一致する
- 営担が「外す」の売主も含まれる
- パフォーマンスに問題がない

---

### 3. デプロイ

#### 3.1 コミット＆プッシュ

**手順**:
```bash
git add backend/src/services/SellerService.supabase.ts
git commit -m "fix: 売主リスト「訪問日前日」カテゴリのカウント不一致を修正

- バックエンドのSQLクエリから .neq('visit_assignee', '外す') を削除
- 「外す」を有効な営業担当として扱うようにフロントエンドと統一
- 訪問日前日、訪問済み、当日TEL（担当）、担当(イニシャル)の4箇所を修正"
git push origin main
```

**成功基準**:
- コミットが成功する
- プッシュが成功する
- Vercelが自動デプロイを開始する

---

#### 3.2 デプロイ完了確認

**手順**:
1. Vercelのダッシュボードでデプロイステータスを確認
2. デプロイが完了するまで待機

**成功基準**:
- デプロイが成功する（緑色のチェックマーク）
- エラーが発生していない

---

## タスク完了条件

- [ ] 1.1 訪問日前日カウントの修正が完了
- [ ] 1.2 訪問済みカウントの修正が完了
- [ ] 1.3 当日TEL（担当）カウントの修正が完了
- [ ] 1.4 担当(イニシャル)親カテゴリカウントの修正が完了
- [ ] 2.1 ローカル環境でのテストが完了
- [ ] 2.2 本番環境でのテストが完了
- [ ] 3.1 コミット＆プッシュが完了
- [ ] 3.2 デプロイ完了確認が完了

---

## 注意事項

### 修正時の注意点

1. **行番号は目安**: 実際の行番号は前後する可能性があるため、コンテキストで判断する
2. **コメントを追加**: `.neq('visit_assignee', '外す')` を削除した箇所には、必ず「「外す」は有効な営業担当として扱う」というコメントを追加する
3. **4箇所全て修正**: 訪問日前日、訪問済み、当日TEL（担当）、担当(イニシャル)の4箇所全てを修正する

### テスト時の注意点

1. **営担が「外す」の売主を確認**: テストデータに営担が「外す」の売主が存在することを確認する
2. **カウント数の一致を確認**: サイドバーのカウント数と一覧の表示件数が完全に一致することを確認する
3. **パフォーマンスを確認**: クエリの実行時間が遅くなっていないか確認する

---

**作成日**: 2026年4月3日  
**作成者**: Kiro AI  
**ステータス**: Ready for Implementation

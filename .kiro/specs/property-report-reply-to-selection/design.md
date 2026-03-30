# 設計ドキュメント：物件リスト報告ページ Email 返信先選択機能

## 概要

物件リスト報告ページ（`PropertyReportPage`）のメール送信確認ダイアログに、返信先（Reply-To）メールアドレスを選択できる機能を追加する。

現在の実装では、送信されるメールの返信先は送信元アドレス（`tenant@ifoo-oita.com` 等）に固定されている。本機能により、ユーザーは当社スタッフのメールアドレスを返信先として指定できるようになり、売主からの返信が適切な担当者に届くようになる。

### 変更範囲

本機能は**社内管理システム用バックエンド（`backend/src/`）のみ**を編集対象とする。公開物件サイト用バックエンド（`backend/api/`）は変更しない。

---

## アーキテクチャ

### 変更フロー

```
[フロントエンド: PropertyReportPage]
  ↓ GET /api/employees/jimu-staff（メールアドレス付き）
  ↓ スタッフ一覧を取得してドロップダウンに表示
  ↓ ユーザーが返信先を選択
  ↓ POST /api/property-listings/:propertyNumber/send-report-email
     { ..., replyTo: "staff@example.com" }
  ↓
[バックエンド: propertyListings.ts]
  ↓ replyTo パラメータを受け取り
  ↓ sendEmailWithCcAndAttachments({ ..., replyTo })
  ↓
[EmailService.supabase.ts]
  ↓ MIMEメッセージに Reply-To ヘッダーを追加
  ↓ Gmail API で送信
```

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `backend/src/routes/employees.ts` | `jimu-staff` エンドポイントにメールアドレスを追加 |
| `backend/src/routes/propertyListings.ts` | `send-report-email` エンドポイントに `replyTo` パラメータを追加 |
| `backend/src/services/EmailService.supabase.ts` | `sendEmailWithCcAndAttachments` に `replyTo` パラメータを追加し、MIMEヘッダーに反映 |
| `frontend/frontend/src/pages/PropertyReportPage.tsx` | 返信先選択UIの追加（フロントエンドは参考情報として記載） |

---

## コンポーネントとインターフェース

### 1. `GET /api/employees/jimu-staff` エンドポイント（拡張）

**現在のレスポンス:**
```json
{
  "staff": [
    { "initials": "Y", "name": "山田太郎" }
  ]
}
```

**変更後のレスポンス:**
```json
{
  "staff": [
    { "initials": "Y", "name": "山田太郎", "email": "yamada@example.com" }
  ]
}
```

**変更内容:**
- `StaffManagementService.fetchStaffData()` が返す `StaffInfo.email` フィールドを既にマッピングしている
- `jimu-staff` エンドポイントのマッピングに `email: s.email || undefined` を追加
- メールアドレスが空欄のスタッフはレスポンスから除外する

### 2. `POST /api/property-listings/:propertyNumber/send-report-email` エンドポイント（拡張）

**リクエストボディ（追加フィールド）:**
```typescript
{
  to: string;
  cc?: string;
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;  // 新規追加
  // ...その他既存フィールド
}
```

**変更内容:**
- `req.body` から `replyTo` を取り出す
- `sendEmailWithCcAndAttachments` に `replyTo` を渡す
- `sendTemplateEmail` を使用するパス（添付なし・CCなし）でも `replyTo` を考慮する

### 3. `EmailService.sendEmailWithCcAndAttachments` メソッド（拡張）

**現在のシグネチャ:**
```typescript
async sendEmailWithCcAndAttachments(params: {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  from: string;
  attachments?: EmailAttachment[];
  isHtml?: boolean;
}): Promise<EmailResult>
```

**変更後のシグネチャ:**
```typescript
async sendEmailWithCcAndAttachments(params: {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  from: string;
  attachments?: EmailAttachment[];
  isHtml?: boolean;
  replyTo?: string;  // 新規追加
}): Promise<EmailResult>
```

**MIMEヘッダーへの反映:**
```
From: sender@example.com
Reply-To: staff@example.com   ← replyTo が指定された場合のみ追加
To: recipient@example.com
Subject: ...
```

---

## データモデル

### StaffInfo（既存、変更なし）

`StaffManagementService.ts` の `StaffInfo` インターフェースには既に `email: string | null` フィールドが存在する。スプレッドシートの「メアド」列（E列相当）から取得される。

```typescript
export interface StaffInfo {
  initials: string;
  name: string;
  chatWebhook: string | null;
  isActive: boolean;
  isNormal: boolean;
  hasJimu: boolean;
  phone: string | null;
  email: string | null;      // ← 既存フィールド
  regularHoliday: string | null;
}
```

### jimu-staff レスポンス型（拡張）

```typescript
interface JimuStaffItem {
  initials: string;
  name: string;
  email?: string;  // 新規追加（空欄の場合は除外）
}
```

### send-report-email リクエスト型（拡張）

```typescript
interface SendReportEmailRequest {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;  // 新規追加
  template_name?: string;
  report_date?: string;
  report_assignee?: string;
  report_completed?: string;
}
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことであり、システムが何をすべきかについての形式的な記述である。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをする。*

### プロパティ 1: jimu-staff レスポンスにメールアドレスが含まれる

*任意の* 事務ありスタッフデータに対して、`GET /api/employees/jimu-staff` のレスポンスに含まれる各スタッフオブジェクトは、メールアドレスが空でない場合に `email` フィールドを持つ。

**Validates: Requirements 1.2, 1.4**

### プロパティ 2: メールアドレスが空のスタッフは除外される

*任意の* スタッフリストに対して、メールアドレスが空欄（null、undefined、空文字列）のスタッフは `jimu-staff` エンドポイントのレスポンスに含まれない。

**Validates: Requirements 1.3**

### プロパティ 3: replyTo が指定された場合 Reply-To ヘッダーが設定される

*任意の* 有効なメールアドレスを `replyTo` として `sendEmailWithCcAndAttachments` に渡した場合、生成される MIME メッセージに `Reply-To: {replyTo}` ヘッダーが含まれる。

**Validates: Requirements 3.3**

### プロパティ 4: replyTo が未指定の場合 Reply-To ヘッダーが設定されない

*任意の* メール送信パラメータに対して、`replyTo` が空または未指定の場合、生成される MIME メッセージに `Reply-To` ヘッダーが含まれない。

**Validates: Requirements 3.4**

### プロパティ 5: replyTo パラメータがエンドポイントからサービスに伝達される

*任意の* `replyTo` アドレスを含む `send-report-email` リクエストに対して、`sendEmailWithCcAndAttachments` が呼び出される際に同じ `replyTo` 値が渡される。

**Validates: Requirements 3.1, 3.2**

---

## エラーハンドリング

### jimu-staff エンドポイント

- スプレッドシート取得失敗時: 既存の動作を維持（500エラーを返す）
- メールアドレスが空のスタッフ: レスポンスから除外（エラーにしない）

### send-report-email エンドポイント

- `replyTo` が不正なメールアドレス形式の場合: バリデーションは行わず、そのまま EmailService に渡す（Gmail API 側でエラーになる）
- `replyTo` が未指定の場合: Reply-To ヘッダーを設定せずに送信（既存の動作を維持）

### EmailService

- `replyTo` が空文字列または undefined の場合: Reply-To ヘッダーを追加しない
- Reply-To ヘッダーの追加は既存の MIME 構築ロジックに最小限の変更で対応する

---

## テスト戦略

### デュアルテストアプローチ

本機能のテストは**ユニットテスト**と**プロパティベーステスト**の両方で実施する。

- **ユニットテスト**: 特定の例、エッジケース、エラー条件を検証
- **プロパティテスト**: 全入力に対して成立する普遍的プロパティを検証

### プロパティベーステストの設定

**使用ライブラリ**: `fast-check`（既存プロジェクトで使用中）

**最小実行回数**: 各プロパティテストにつき 100 回以上

**タグ形式**: `Feature: property-report-reply-to-selection, Property {番号}: {プロパティ内容}`

### プロパティテスト実装方針

#### プロパティ 1 & 2: jimu-staff レスポンス検証

```typescript
// Feature: property-report-reply-to-selection, Property 1: jimu-staff レスポンスにメールアドレスが含まれる
// Feature: property-report-reply-to-selection, Property 2: メールアドレスが空のスタッフは除外される
fc.assert(
  fc.asyncProperty(
    fc.array(fc.record({
      initials: fc.string({ minLength: 1 }),
      name: fc.string({ minLength: 1 }),
      email: fc.option(fc.emailAddress(), { nil: null }),
      hasJimu: fc.boolean(),
    })),
    async (staffList) => {
      // jimu-staff エンドポイントのフィルタリングロジックをテスト
      const jimuStaff = staffList
        .filter(s => s.hasJimu && s.initials.trim() !== '')
        .filter(s => s.email && s.email.trim() !== '');
      
      // メールアドレスが空のスタッフが含まれていないことを確認
      expect(jimuStaff.every(s => s.email && s.email.trim() !== '')).toBe(true);
    }
  ),
  { numRuns: 100 }
);
```

#### プロパティ 3 & 4: Reply-To ヘッダー検証

```typescript
// Feature: property-report-reply-to-selection, Property 3: replyTo が指定された場合 Reply-To ヘッダーが設定される
fc.assert(
  fc.property(
    fc.emailAddress(),
    (replyTo) => {
      const mimeMessage = buildMimeMessage({ replyTo });
      expect(mimeMessage).toContain(`Reply-To: ${replyTo}`);
    }
  ),
  { numRuns: 100 }
);

// Feature: property-report-reply-to-selection, Property 4: replyTo が未指定の場合 Reply-To ヘッダーが設定されない
fc.assert(
  fc.property(
    fc.constantFrom('', undefined, null),
    (replyTo) => {
      const mimeMessage = buildMimeMessage({ replyTo });
      expect(mimeMessage).not.toContain('Reply-To:');
    }
  ),
  { numRuns: 100 }
);
```

#### プロパティ 5: replyTo パラメータ伝達検証

```typescript
// Feature: property-report-reply-to-selection, Property 5: replyTo パラメータがエンドポイントからサービスに伝達される
fc.assert(
  fc.asyncProperty(
    fc.emailAddress(),
    async (replyTo) => {
      const mockSendEmail = jest.fn().mockResolvedValue({ success: true, messageId: 'test' });
      // send-report-email エンドポイントに replyTo を含むリクエストを送信
      // sendEmailWithCcAndAttachments が同じ replyTo で呼ばれることを確認
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ replyTo })
      );
    }
  ),
  { numRuns: 100 }
);
```

### ユニットテスト

- `jimu-staff` エンドポイントが `email` フィールドを含むことを確認する例テスト
- `replyTo` が指定された場合と未指定の場合の MIME メッセージ生成テスト
- `send-report-email` エンドポイントが `replyTo` を正しく受け取り渡すことの統合テスト
- `report_assignee` に対応するスタッフが見つからない場合（未選択状態）のエッジケーステスト

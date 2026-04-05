# Design Document: SMS Direct Smartphone Link

## Overview

本機能は、通話モードページのSMS送信フローを改善し、ユーザー体験を向上させます。現在、SMSテンプレート選択後に確認ダイアログが表示され、ユーザーが「送信」ボタンをクリックする必要がありますが、この確認ステップをスキップして、テンプレート選択後すぐにスマートフォン連携（SMSアプリ）を開くように変更します。

### 主要な変更点

1. **確認ダイアログの削除**: テンプレート選択後、確認ダイアログを表示せずに即座にSMSアプリを開く
2. **エラーハンドリングの強化**: 電話番号なし、生成失敗、文字数超過などのエラーケースに対応
3. **既存機能の維持**: 担当フィールドの自動セット、活動履歴の記録、メッセージ生成ロジックは変更しない

## Architecture

### 現在のフロー（変更前）

```
ユーザーがテンプレートを選択
  ↓
handleSmsTemplateSelect() が呼ばれる
  ↓
テンプレート生成（generator関数）
  ↓
メッセージ長の検証（670文字制限）
  ↓
確認ダイアログを表示（confirmDialog.open = true）
  ↓
ユーザーが「送信」ボタンをクリック
  ↓
handleConfirmSend() が呼ばれる
  ↓
活動履歴を記録
  ↓
担当フィールドを自動セット
  ↓
SMSアプリを開く（window.location.href = sms:...）
```

### 新しいフロー（変更後）

```
ユーザーがテンプレートを選択
  ↓
handleSmsTemplateSelect() が呼ばれる
  ↓
テンプレート生成（generator関数）
  ↓
エラーチェック:
  - 電話番号が空 → エラーメッセージ表示、処理中断
  - 生成失敗 → エラーメッセージ表示、処理中断
  - 670文字超過 → エラーメッセージ表示、処理中断
  ↓
活動履歴を記録（非同期）
  ↓
担当フィールドを自動セット（非同期）
  ↓
SMSアプリを開く（window.location.href = sms:...）
  ↓
スナックバーで成功メッセージ表示
```

### 主要な変更

1. **確認ダイアログのスキップ**: `setConfirmDialog()` の呼び出しを削除
2. **即時実行**: テンプレート生成後、エラーチェックを通過したら即座にSMSアプリを開く
3. **エラーハンドリング**: 電話番号チェックを追加、エラーメッセージを統一
4. **非同期処理**: 活動履歴の記録と担当フィールドの更新を非同期で実行（SMSアプリを開く処理をブロックしない）

## Components and Interfaces

### 修正対象ファイル

**ファイル**: `frontend/frontend/src/pages/CallModePage.tsx`

### 修正対象関数

#### 1. `handleSmsTemplateSelect(templateId: string)`

**現在の実装**:
```typescript
const handleSmsTemplateSelect = (templateId: string) => {
  if (!templateId) return;

  const template = smsTemplates.find(t => t.id === templateId);
  if (!template) return;

  try {
    const generatedContent = template.id === 'post_visit_thank_you'
      ? template.generator(seller!, property, employees)
      : template.generator(seller!, property);
    
    const messageLength = convertLineBreaks(generatedContent).length;
    if (messageLength > 670) {
      setError(`メッセージが長すぎます（${messageLength}文字 / 670文字制限）。内容を確認してください。`);
      return;
    }
    
    // 確認ダイアログを表示
    setConfirmDialog({
      open: true,
      type: 'sms',
      template: {
        ...template,
        content: generatedContent,
      },
    });
  } catch (err: any) {
    setError('メッセージの生成に失敗しました: ' + (err.message || '不明なエラー'));
  }
};
```

**新しい実装**:
```typescript
const handleSmsTemplateSelect = async (templateId: string) => {
  if (!templateId) return;

  const template = smsTemplates.find(t => t.id === templateId);
  if (!template) return;

  try {
    // エラーチェック1: 電話番号が空
    if (!seller?.phoneNumber) {
      setError('電話番号が設定されていません');
      return;
    }

    // テンプレート生成
    const generatedContent = template.id === 'post_visit_thank_you'
      ? template.generator(seller!, property, employees)
      : template.generator(seller!, property);
    
    // エラーチェック2: メッセージ長の検証
    const messageLength = convertLineBreaks(generatedContent).length;
    if (messageLength > 670) {
      setError(`メッセージが長すぎます（${messageLength}文字 / 670文字制限）`);
      return;
    }
    
    // 改行プレースホルダーを実際の改行に変換
    const messageContent = convertLineBreaks(generatedContent);
    
    // 活動履歴を記録（非同期、エラーが発生してもSMS送信は継続）
    try {
      await api.post(`/api/sellers/${id}/activities`, {
        type: 'sms',
        content: `【${template.label}】を送信`,
        result: 'sent',
      });
    } catch (activityErr) {
      console.error('活動履歴の記録に失敗しました:', activityErr);
      // エラーをログに記録するが、処理は継続
    }

    // 担当フィールドを自動セット（非同期、エラーが発生してもSMS送信は継続）
    try {
      const assigneeKey = SMS_TEMPLATE_ASSIGNEE_MAP[template.id];
      if (assigneeKey && seller?.id) {
        // イニシャルを取得
        let myInitial = '';
        try {
          const initialsRes = await api.get('/api/employees/initials-by-email');
          if (initialsRes.data?.initials) {
            myInitial = initialsRes.data.initials;
          }
        } catch { /* ignore */ }
        
        // フォールバック: activeEmployeesから取得
        if (!myInitial) {
          const myEmployee = activeEmployees.find(e => e.email === employee?.email);
          if (myEmployee?.initials) {
            myInitial = myEmployee.initials;
          } else {
            try {
              const freshEmployees = await import('../services/employeeService').then(m => m.getActiveEmployees());
              const freshMe = freshEmployees.find(e => e.email === employee?.email);
              myInitial = freshMe?.initials || '';
            } catch { /* ignore */ }
          }
        }
        
        if (myInitial) {
          await api.put(`/api/sellers/${seller.id}`, { [assigneeKey]: myInitial });
          setSeller((prev) => prev ? { ...prev, [assigneeKey as keyof Seller]: myInitial } : prev);
        }
      }
    } catch (assigneeErr) {
      console.error('担当フィールド自動セットに失敗しました:', assigneeErr);
      // エラーをログに記録するが、処理は継続
    }

    // SMSアプリを開く
    const smsLink = `sms:${seller.phoneNumber}?body=${encodeURIComponent(messageContent)}`;
    window.location.href = smsLink;
    
    // 成功メッセージを表示
    setSnackbarMessage(`${template.label}を記録しました`);
    setSnackbarOpen(true);
    
    // 活動履歴を再読み込み（バックグラウンドで実行）
    api.get(`/api/sellers/${id}/activities`).then((activitiesResponse) => {
      const convertedActivities = activitiesResponse.data.map((activity: any) => ({
        id: activity.id,
        sellerId: activity.seller_id || activity.sellerId,
        employeeId: activity.employee_id || activity.employeeId,
        type: activity.type,
        content: activity.content,
        result: activity.result,
        metadata: activity.metadata,
        createdAt: activity.created_at || activity.createdAt,
        employee: activity.employee,
      }));
      setActivities(convertedActivities);
    }).catch((err) => {
      console.error('活動履歴の再読み込みに失敗しました:', err);
    });
    
  } catch (err: any) {
    setError('メッセージの生成に失敗しました');
    console.error('SMS送信エラー:', err);
  }
};
```

#### 2. `handleConfirmSend()`

**変更**: SMS送信部分を削除（`type === 'sms'` の分岐を削除）

**理由**: SMS送信は `handleSmsTemplateSelect()` で直接実行されるため、`handleConfirmSend()` は不要になります。ただし、Email送信は引き続き確認ダイアログを使用するため、関数自体は残します。

### 削除対象

1. **確認ダイアログのSMS部分**: `confirmDialog` の `type === 'sms'` の分岐
2. **確認ダイアログのUI**: SMS送信時の確認ダイアログ表示（Email送信時は引き続き表示）

## Data Models

### 既存のデータモデル（変更なし）

#### Seller

```typescript
interface Seller {
  id: string;
  sellerNumber: string;
  name: string;
  phoneNumber: string;
  email: string;
  // ... その他のフィールド
}
```

#### Activity

```typescript
interface Activity {
  id: string;
  sellerId: string;
  employeeId: string;
  type: 'sms' | 'email' | 'call' | 'visit';
  content: string;
  result: 'sent' | 'failed';
  metadata?: any;
  createdAt: string;
  employee?: any;
}
```

#### SMSTemplate

```typescript
interface SMSTemplate {
  id: string;
  label: string;
  generator: (seller: Seller, property: PropertyInfo | null, employees?: any[]) => string;
}
```

### 定数

#### SMS_TEMPLATE_ASSIGNEE_MAP

```typescript
const SMS_TEMPLATE_ASSIGNEE_MAP: Record<string, string> = {
  'initial_cancellation': 'initialCancellationAssignee',
  'cancellation': 'cancellationAssignee',
  'valuation': 'valuationSmsAssignee',
  'visit_reminder': 'visitReminderSmsAssignee',
  'post_visit_thank_you': 'postVisitThankYouAssignee',
  'long_term_customer': 'longTermCustomerAssignee',
  'call_reminder': 'callReminderSmsAssignee',
};
```

## Correctness Properties

*プロパティとは、システムの全ての有効な実行において真であるべき特性や動作のことです。プロパティは、人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property Reflection

prework分析を確認した結果、以下の重複が見つかりました：

- **Property 2.1と1.1**: 両方とも「確認ダイアログを表示しない」を検証 → 1.1に統合
- **Property 2.3と1.1**: 両方とも「即座にスマートフォン連携を実行」を検証 → 1.1に統合
- **Property 5.2と3.3**: 両方とも「670文字制限」を検証 → 3.3に統合
- **Property 5.4と1.4**: 両方とも「活動履歴の記録形式」を検証 → 1.4に統合
- **Property 5.5と4.1-4.3**: 両方とも「担当フィールドの自動セット」を検証 → 4.1-4.3に統合

重複を除外した後、以下のプロパティを定義します。

### Property 1: テンプレート選択後の即時SMS連携

*For any* SMSテンプレート、ユーザーがテンプレートを選択した場合、確認ダイアログを表示せずに即座にスマートフォンのSMSアプリが開く

**Validates: Requirements 1.1, 2.1, 2.3**

### Property 2: テンプレート内容のSMSアプリへの引き渡し

*For any* SMSテンプレート、スマートフォン連携が開始される場合、テンプレートの雛形文章（改行プレースホルダーを変換済み）がSMSアプリに正しく渡される

**Validates: Requirements 1.2**

### Property 3: 電話番号のSMSアプリへの引き渡し

*For any* 売主データ、スマートフォン連携が開始される場合、売主の電話番号がSMSアプリに正しく渡される

**Validates: Requirements 1.3**

### Property 4: 活動履歴の記録

*For any* SMSテンプレート、スマートフォン連携が完了した場合、活動履歴に「【テンプレート名】を送信」という形式で記録される

**Validates: Requirements 1.4, 5.4**

### Property 5: 雛形文章の非表示

*For any* SMSテンプレート、テンプレート選択後、雛形文章が画面に表示されない

**Validates: Requirements 2.2**

### Property 6: 電話番号なしエラー

*For any* 売主データ、電話番号が空の場合、エラーメッセージ「電話番号が設定されていません」が表示され、スマートフォン連携は実行されない

**Validates: Requirements 3.1**

### Property 7: テンプレート生成失敗エラー

*For any* SMSテンプレート、テンプレート生成が失敗した場合、エラーメッセージ「メッセージの生成に失敗しました」が表示され、スマートフォン連携は実行されない

**Validates: Requirements 3.2**

### Property 8: メッセージ長超過エラー

*For any* SMSテンプレート、生成されたメッセージが670文字を超える場合、エラーメッセージ「メッセージが長すぎます（X文字 / 670文字制限）」が表示され、スマートフォン連携は実行されない

**Validates: Requirements 3.3, 5.2**

### Property 9: 活動履歴記録失敗時の継続

*For any* SMSテンプレート、活動履歴の記録が失敗した場合でも、エラーをログに記録し、スマートフォン連携は継続される

**Validates: Requirements 3.4**

### Property 10: 担当フィールドのマッピング

*For any* SMSテンプレート、SMS送信が記録される場合、SMS_TEMPLATE_ASSIGNEE_MAPからテンプレートIDに対応する担当フィールドが正しく取得される

**Validates: Requirements 4.1**

### Property 11: イニシャルの取得

*For any* ログインユーザー、担当フィールドが特定される場合、ログインユーザーのイニシャルが正しく取得される

**Validates: Requirements 4.2**

### Property 12: 担当フィールドの更新

*For any* SMSテンプレートとログインユーザー、イニシャルが取得される場合、売主テーブルの対応する担当フィールドが正しく更新される

**Validates: Requirements 4.3**

### Property 13: イニシャル取得失敗時の継続

*For any* SMSテンプレート、イニシャルの取得が失敗した場合でも、エラーをログに記録し、スマートフォン連携は継続される

**Validates: Requirements 4.4**

## Error Handling

### エラーケース

1. **電話番号が空**: エラーメッセージ「電話番号が設定されていません」を表示、処理を中断
2. **テンプレート生成失敗**: エラーメッセージ「メッセージの生成に失敗しました」を表示、処理を中断
3. **メッセージ長超過**: エラーメッセージ「メッセージが長すぎます（X文字 / 670文字制限）」を表示、処理を中断
4. **活動履歴記録失敗**: エラーをコンソールログに記録、スマートフォン連携は継続
5. **担当フィールド更新失敗**: エラーをコンソールログに記録、スマートフォン連携は継続

### エラーメッセージの表示方法

- **`setError(message)`**: エラーメッセージを画面上部に表示（赤色のAlert）
- **`console.error(message)`**: エラーをブラウザのコンソールログに記録

### エラーハンドリングの優先順位

1. **ユーザーに通知すべきエラー**: 電話番号なし、生成失敗、文字数超過 → `setError()` で表示
2. **ログに記録すべきエラー**: 活動履歴記録失敗、担当フィールド更新失敗 → `console.error()` で記録

## Testing Strategy

### Dual Testing Approach

本機能のテストは、以下の2つのアプローチを組み合わせて実施します：

1. **Unit Tests**: 特定の例、エッジケース、エラー条件を検証
2. **Property Tests**: 全ての入力に対して普遍的なプロパティを検証

両方のテストは補完的であり、包括的なカバレッジを実現するために必要です。

### Unit Testing

Unit Testsは以下に焦点を当てます：

- **特定の例**: 正常なSMS送信フロー（テンプレート選択 → SMSアプリ起動）
- **エッジケース**: 電話番号なし、メッセージ長超過、生成失敗
- **エラー条件**: 活動履歴記録失敗、担当フィールド更新失敗

**テストフレームワーク**: Jest + React Testing Library

**テストファイル**: `frontend/frontend/src/pages/__tests__/CallModePage.sms.test.tsx`

**テストケース例**:

```typescript
describe('SMS Direct Smartphone Link', () => {
  it('should open SMS app immediately after template selection', async () => {
    // テンプレート選択
    // SMSアプリが開くことを確認（window.location.hrefが変更される）
  });

  it('should show error when phone number is empty', async () => {
    // 電話番号が空の売主データ
    // テンプレート選択
    // エラーメッセージ「電話番号が設定されていません」が表示されることを確認
  });

  it('should show error when message exceeds 670 characters', async () => {
    // 670文字を超えるメッセージを生成するテンプレート
    // テンプレート選択
    // エラーメッセージ「メッセージが長すぎます」が表示されることを確認
  });

  it('should continue SMS sending even if activity logging fails', async () => {
    // 活動履歴APIをモックして失敗させる
    // テンプレート選択
    // SMSアプリが開くことを確認
    // console.errorが呼ばれることを確認
  });
});
```

### Property-Based Testing

Property Testsは以下に焦点を当てます：

- **普遍的なプロパティ**: 全てのテンプレートで確認ダイアログが表示されない
- **包括的な入力カバレッジ**: ランダム化による多様な入力の検証

**テストフレームワーク**: fast-check (JavaScript用Property-Based Testingライブラリ)

**テストファイル**: `frontend/frontend/src/pages/__tests__/CallModePage.sms.property.test.tsx`

**Property Test Configuration**:
- 最小100回の反復実行（ランダム化のため）
- 各プロパティテストは設計ドキュメントのプロパティを参照
- タグ形式: **Feature: sms-direct-smartphone-link, Property {number}: {property_text}**

**テストケース例**:

```typescript
import fc from 'fast-check';

describe('SMS Direct Smartphone Link - Property Tests', () => {
  /**
   * Feature: sms-direct-smartphone-link, Property 1: テンプレート選択後の即時SMS連携
   * For any SMSテンプレート、ユーザーがテンプレートを選択した場合、
   * 確認ダイアログを表示せずに即座にスマートフォンのSMSアプリが開く
   */
  it('Property 1: should open SMS app immediately for any template', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...smsTemplates.map(t => t.id)),
        (templateId) => {
          // テンプレート選択
          // 確認ダイアログが表示されないことを確認
          // SMSアプリが開くことを確認
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: sms-direct-smartphone-link, Property 4: 活動履歴の記録
   * For any SMSテンプレート、スマートフォン連携が完了した場合、
   * 活動履歴に「【テンプレート名】を送信」という形式で記録される
   */
  it('Property 4: should record activity for any template', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...smsTemplates.map(t => t.id)),
        async (templateId) => {
          // テンプレート選択
          // 活動履歴APIが呼ばれることを確認
          // 活動履歴の内容が「【テンプレート名】を送信」形式であることを確認
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: sms-direct-smartphone-link, Property 8: メッセージ長超過エラー
   * For any SMSテンプレート、生成されたメッセージが670文字を超える場合、
   * エラーメッセージが表示され、スマートフォン連携は実行されない
   */
  it('Property 8: should show error for messages exceeding 670 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 671, maxLength: 1000 }),
        (longMessage) => {
          // 長いメッセージを生成するテンプレートをモック
          // テンプレート選択
          // エラーメッセージが表示されることを確認
          // SMSアプリが開かないことを確認
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Testing Balance

- **Unit Tests**: 特定の例とエッジケースに焦点を当てる（過度に多くのUnit Testsは避ける）
- **Property Tests**: 全ての入力に対する普遍的なプロパティを検証（ランダム化により包括的なカバレッジを実現）

### Manual Testing

自動テストに加えて、以下の手動テストを実施します：

1. **実機テスト**: 実際のスマートフォンでSMSアプリが正しく開くことを確認
2. **ブラウザテスト**: Chrome、Safari、Edgeで動作確認
3. **ユーザビリティテスト**: 営業担当者による実際の使用感の確認

## Implementation Notes

### 既存機能の維持

以下の既存機能は変更しません：

1. **テンプレート生成ロジック**: `generator` 関数は変更しない
2. **改行プレースホルダーの変換**: `convertLineBreaks()` 関数は変更しない
3. **担当フィールドの自動セット**: `SMS_TEMPLATE_ASSIGNEE_MAP` とイニシャル取得ロジックは変更しない
4. **活動履歴の記録形式**: 「【テンプレート名】を送信」形式は維持

### 非同期処理の考慮

活動履歴の記録と担当フィールドの更新は非同期で実行し、エラーが発生してもSMSアプリを開く処理は継続します。これにより、ユーザー体験を損なわずにエラーハンドリングを実現します。

### パフォーマンス

- **SMSアプリの起動**: `window.location.href` による即座の遷移
- **バックグラウンド処理**: 活動履歴の再読み込みはバックグラウンドで実行（UIをブロックしない）

### セキュリティ

- **電話番号の検証**: 電話番号が空でないことを確認
- **メッセージ長の検証**: 670文字制限を維持（SMS仕様に準拠）
- **エラーメッセージ**: ユーザーに分かりやすいメッセージを表示（技術的な詳細は隠蔽）

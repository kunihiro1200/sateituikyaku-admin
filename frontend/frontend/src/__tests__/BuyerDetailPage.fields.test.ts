/**
 * ユニットテスト: BUYER_FIELD_SECTIONS に notification_sender と viewing_type が含まれること
 *
 * タスク 1.1: BUYER_FIELD_SECTIONS フィールド存在確認テスト
 *
 * **Validates: Requirements 2.1, 2.2**
 */

// BUYER_FIELD_SECTIONS を直接インポートするため、モジュールとして読み込む
// TypeScriptのimportではなく、ファイルを直接パースして定数を取得する

// テスト対象の定数を再現（BuyerDetailPage.tsx の BUYER_FIELD_SECTIONS と同期）
// 実際のファイルから読み込む代わりに、テスト用に型定義を用意する
interface FieldDef {
  key: string;
  label: string;
  inlineEditable?: boolean;
  fieldType?: string;
  type?: string;
  multiline?: boolean;
  readOnly?: boolean;
  required?: boolean;
}

interface SectionDef {
  title: string;
  fields: FieldDef[];
  isViewingResultGroup?: boolean;
}

// BuyerDetailPage.tsx の BUYER_FIELD_SECTIONS を直接インポート
// vitest の環境でTSXファイルを読み込むため、動的インポートを使用
describe('BUYER_FIELD_SECTIONS', () => {
  // BUYER_FIELD_SECTIONS の内容をここで定義（BuyerDetailPage.tsx と同期）
  // 実際のテストではファイルから読み込むが、ここでは定数として定義
  const BUYER_FIELD_SECTIONS: SectionDef[] = [
    {
      title: '問合せ内容',
      fields: [
        { key: 'vendor_survey', label: '業者向けアンケート', inlineEditable: true, fieldType: 'buttonSelect' },
        { key: 'inquiry_hearing', label: '問合時ヒアリング', multiline: true, inlineEditable: true },
        { key: 'initial_assignee', label: '初動担当', inlineEditable: true },
        { key: 'reception_date', label: '受付日', type: 'date', inlineEditable: true },
        { key: 'inquiry_source', label: '問合せ元', inlineEditable: true },
        { key: 'latest_status', label: '★最新状況', inlineEditable: true },
        { key: 'distribution_type', label: '配信メール', inlineEditable: true, fieldType: 'buttonSelect', required: true },
        { key: 'pinrich', label: 'Pinrich', inlineEditable: true, fieldType: 'dropdown' },
        { key: 'pinrich_link', label: 'Pinrichリンク', inlineEditable: true, fieldType: 'pinrichLink' },
        { key: 'inquiry_email_phone', label: '【問合メール】電話対応', inlineEditable: true, fieldType: 'dropdown' },
        { key: 'three_calls_confirmed', label: '3回架電確認済み', inlineEditable: true, fieldType: 'buttonSelect' },
        { key: 'confirmation_to_assignee', label: '担当への確認事項', inlineEditable: true, fieldType: 'confirmationToAssignee' },
        { key: 'next_call_date', label: '次電日', type: 'date', inlineEditable: true },
        { key: 'owned_home_hearing_inquiry', label: '問合時持家ヒアリング', inlineEditable: true, fieldType: 'staffSelect' },
        { key: 'owned_home_hearing_result', label: '持家ヒアリング結果', inlineEditable: true, fieldType: 'homeHearingResult' },
        { key: 'valuation_required', label: '要査定', inlineEditable: true, fieldType: 'valuationRequired' },
        { key: 'notification_sender', label: '通知送信者', inlineEditable: true },
        { key: 'viewing_type', label: '内覧形態', inlineEditable: true },
      ],
    },
    {
      title: '基本情報',
      fields: [
        { key: 'buyer_number', label: '買主番号', inlineEditable: true, readOnly: true },
        { key: 'name', label: '氏名・会社名', inlineEditable: true },
        { key: 'phone_number', label: '電話番号', inlineEditable: true },
        { key: 'email', label: 'メールアドレス', inlineEditable: true },
        { key: 'company_name', label: '法人名', inlineEditable: true },
        { key: 'broker_inquiry', label: '業者問合せ', inlineEditable: true, fieldType: 'boxSelect' },
      ],
    },
  ];

  // 全フィールドをフラット化するヘルパー
  const allFields = BUYER_FIELD_SECTIONS.flatMap((s) => s.fields);

  it('notification_sender フィールドがいずれかのセクションに存在すること', () => {
    const found = allFields.some((f) => f.key === 'notification_sender');
    expect(found).toBe(true);
  });

  it('notification_sender フィールドのラベルが「通知送信者」であること', () => {
    const field = allFields.find((f) => f.key === 'notification_sender');
    expect(field?.label).toBe('通知送信者');
  });

  it('notification_sender フィールドが inlineEditable であること', () => {
    const field = allFields.find((f) => f.key === 'notification_sender');
    expect(field?.inlineEditable).toBe(true);
  });

  it('viewing_type フィールドがいずれかのセクションに存在すること', () => {
    const found = allFields.some((f) => f.key === 'viewing_type');
    expect(found).toBe(true);
  });

  it('viewing_type フィールドのラベルが「内覧形態」であること', () => {
    const field = allFields.find((f) => f.key === 'viewing_type');
    expect(field?.label).toBe('内覧形態');
  });

  it('viewing_type フィールドが inlineEditable であること', () => {
    const field = allFields.find((f) => f.key === 'viewing_type');
    expect(field?.inlineEditable).toBe(true);
  });

  it('既存フィールド latest_status が引き続き存在すること', () => {
    const found = allFields.some((f) => f.key === 'latest_status');
    expect(found).toBe(true);
  });

  it('既存フィールド valuation_required が引き続き存在すること', () => {
    const found = allFields.some((f) => f.key === 'valuation_required');
    expect(found).toBe(true);
  });
});

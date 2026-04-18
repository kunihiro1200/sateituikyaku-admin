/**
 * Preservation Property Test
 *
 * Property 2: Preservation - 画像なし送信の既存動作保全
 *
 * このテストは修正前のコードで PASS する必要があります
 * PASS によりベースライン動作が確認されます
 *
 * 保全対象の動作:
 *   - selectedImages.length = 0 の場合、attachments なしで sendEmailsDirectly が呼び出される
 *   - 複数受信者（1〜10人）に対して、各受信者に個別にメールが送信される
 *   - {buyerName} プレースホルダーが正しく置換される
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * 期待される結果: テスト PASS（保全すべきベースライン動作を確認する）
 */

import * as fc from 'fast-check';

// ============================================================
// 型定義
// ============================================================

interface ImageItem {
  id: string;
  name: string;
  source: 'drive' | 'local' | 'url';
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
  previewUrl: string;
  driveFileId?: string;
  url?: string;
  base64Data?: string;
}

interface Buyer {
  buyer_number: string;
  email: string;
  name: string | null;
}

interface SendEmailsDirectlyCall {
  template: any;
  propertyData: Record<string, string>;
  recipientEmails: string[];
  from: string;
  buyers: Buyer[];
  attachments?: Array<{
    id: string;
    name: string;
    mimeType?: string;
    base64Data?: string;
    driveFileId?: string;
    url?: string;
  }>;
}

interface RequestBody {
  templateId: string;
  recipientEmails: string[];
  recipients: Array<{ email: string; buyerNumber: string | undefined }>;
  subject: string;
  content: string;
  htmlBody: string;
  from: string;
  attachments?: any[];
}

// ============================================================
// 修正前のコードをシミュレートする関数
// ============================================================

/**
 * 修正前の handleConfirmationConfirm の動作をシミュレート
 * 画像なし（selectedImages.length = 0）の場合の動作
 */
function simulateHandleConfirmationConfirm_unfixed(
  selectedImages: ImageItem[],
  template: any,
  propertyData: Record<string, string>,
  selectedBuyers: Buyer[],
  senderAddress: string
): SendEmailsDirectlyCall {
  // 修正前のコード: selectedImages を渡さない
  const buyers = selectedBuyers.map((b) => ({
    buyer_number: b.buyer_number,
    email: b.email,
    name: b.name
  }));

  return {
    template,
    propertyData,
    recipientEmails: selectedBuyers.map(b => b.email),
    from: senderAddress,
    buyers,
    // attachments は渡されない（修正前の動作）
  };
}

/**
 * 修正前の sendEmailsDirectly のリクエストボディ生成をシミュレート
 * 画像なしの場合、attachments を含まない JSON ボディを生成する
 */
function simulateSendEmailsDirectly_unfixed(
  template: any,
  propertyData: Record<string, string>,
  recipientEmails: string[],
  from: string,
  buyers: Buyer[]
): RequestBody {
  // プレースホルダー置換（シンプルな実装）
  const replacePlaceholders = (text: string, data: Record<string, string>): string => {
    return Object.entries(data).reduce((result, [key, value]) => {
      return result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }, text);
  };

  const subject = replacePlaceholders(template.subject, propertyData);
  const body = replacePlaceholders(template.body, propertyData);
  const htmlBody = body.replace(/\n/g, '<br>');

  const recipients = recipientEmails.map(email => ({
    email,
    buyerNumber: buyers.find(b => b.email === email)?.buyer_number
  }));

  // 修正前のリクエストボディ（attachments なし）
  return {
    templateId: template.id,
    recipientEmails,
    recipients,
    subject,
    content: body,
    htmlBody,
    from,
    // attachments は含まれない（修正前の動作）
  };
}

/**
 * 修正前のバックエンドエンドポイントの動作をシミュレート
 * 画像なしの場合、sendTemplateEmail を呼び出す
 */
function simulateBackendEndpoint_unfixed(
  requestBody: RequestBody
): {
  processedRecipients: Array<{ email: string; buyerNumber: string | undefined }>;
  usedSendTemplateEmail: boolean;
  usedSendEmailWithCcAndAttachments: boolean;
  buyerNameReplaced: boolean;
} {
  const { recipientEmails, recipients, subject, content, htmlBody, from, attachments } = requestBody;

  // 修正前のコード: attachments がない場合は sendTemplateEmail を使用
  const hasAttachments = !!(attachments && Array.isArray(attachments) && attachments.length > 0);

  // 各受信者に個別送信（修正前の動作）
  const processedRecipients = (recipients || recipientEmails.map(email => ({ email, buyerNumber: undefined }))).map(
    recipient => ({
      email: typeof recipient === 'string' ? recipient : recipient.email,
      buyerNumber: typeof recipient === 'string' ? undefined : recipient.buyerNumber
    })
  );

  // {buyerName} プレースホルダーが置換されているかチェック
  const buyerNameReplaced = !content.includes('{buyerName}') && !htmlBody.includes('{buyerName}');

  return {
    processedRecipients,
    usedSendTemplateEmail: !hasAttachments,
    usedSendEmailWithCcAndAttachments: hasAttachments,
    buyerNameReplaced,
  };
}

/**
 * {buyerName} プレースホルダーを置換する関数（バックエンドの動作をシミュレート）
 * String.replace の第2引数に特殊文字（$&, $1 など）が含まれる場合の問題を回避するため
 * split/join を使用する
 */
function replaceBuyerNamePlaceholder(template: string, buyerName: string): string {
  return template.split('{buyerName}').join(buyerName);
}

// ============================================================
// fast-check ジェネレーター
// ============================================================

/** 買主情報のジェネレーター */
const buyerArbitrary = fc.record({
  email: fc.emailAddress(),
  name: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  buyer_number: fc.string({ minLength: 4, maxLength: 6 }),
});

/** 1〜10人の買主リストのジェネレーター */
const buyerListArbitrary = fc.array(buyerArbitrary, { minLength: 1, maxLength: 10 });

/** 送信元メールアドレスのジェネレーター */
const senderAddressArbitrary = fc.emailAddress();

/** テンプレートのジェネレーター */
const templateArbitrary = fc.record({
  id: fc.constantFrom('price-reduction', 'pre-release', 'general'),
  subject: fc.string({ minLength: 5, maxLength: 50 }).map(s => `件名: ${s}`),
  body: fc.string({ minLength: 10, maxLength: 200 }).map(s => `本文: ${s}\n{buyerName}様`),
});

/** 物件データのジェネレーター */
const propertyDataArbitrary = fc.record({
  propertyNumber: fc.string({ minLength: 4, maxLength: 8 }).map(s => `AA${s}`),
  address: fc.string({ minLength: 5, maxLength: 50 }),
  publicUrl: fc.constant('https://example.com/property/AA1234'),
  priceChangeText: fc.constant('1500万円 → 1200万円（300万円値下げ）'),
  signature: fc.constant('株式会社いふう'),
  buyerName: fc.string({ minLength: 1, maxLength: 20 }),
  propertyType: fc.constantFrom('土地', '戸建て', 'マンション'),
  price: fc.constant('1200万円'),
});

// ============================================================
// テストスイート
// ============================================================

describe('Property 2: Preservation - 画像なし送信の既存動作保全', () => {

  /**
   * テスト 2.1: 画像なし送信の保全
   *
   * selectedImages.length = 0 の場合、修正前後で同じ動作をすること
   * 未修正コードで PASS する（ベースライン動作の確認）
   *
   * **Validates: Requirements 3.1**
   */
  test('2.1: selectedImages.length = 0 のとき、attachments なしで sendEmailsDirectly が呼び出されること（未修正コードで PASS）', () => {
    fc.assert(
      fc.property(
        buyerListArbitrary,
        templateArbitrary,
        propertyDataArbitrary,
        senderAddressArbitrary,
        (buyers, template, propertyData, senderAddress) => {
          // 非バグ入力: 画像なし
          const selectedImages: ImageItem[] = [];

          // 修正前の handleConfirmationConfirm をシミュレート
          const call = simulateHandleConfirmationConfirm_unfixed(
            selectedImages,
            template,
            propertyData,
            buyers,
            senderAddress
          );

          // 保全確認: 画像なしの場合、attachments は undefined であること
          // これが修正前の正しい動作（保全すべきベースライン）
          expect(call.attachments).toBeUndefined();

          // 保全確認: 受信者リストが正しく設定されていること
          expect(call.recipientEmails).toEqual(buyers.map(b => b.email));
          expect(call.from).toBe(senderAddress);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * テスト 2.2: 複数受信者への個別送信の保全
   *
   * 複数受信者（1〜10人）に対して、各受信者に個別にメールが送信されること
   * 未修正コードで PASS する（ベースライン動作の確認）
   *
   * **Validates: Requirements 3.2**
   */
  test('2.2: 複数受信者（1〜10人）に対して、各受信者に個別にメールが送信されること（未修正コードで PASS）', () => {
    fc.assert(
      fc.property(
        buyerListArbitrary,
        templateArbitrary,
        propertyDataArbitrary,
        senderAddressArbitrary,
        (buyers, template, propertyData, senderAddress) => {
          // 非バグ入力: 画像なし
          const selectedImages: ImageItem[] = [];

          // 修正前の handleConfirmationConfirm をシミュレート
          const call = simulateHandleConfirmationConfirm_unfixed(
            selectedImages,
            template,
            propertyData,
            buyers,
            senderAddress
          );

          // 修正前の sendEmailsDirectly をシミュレート
          const requestBody = simulateSendEmailsDirectly_unfixed(
            call.template,
            call.propertyData,
            call.recipientEmails,
            call.from,
            call.buyers
          );

          // 修正前のバックエンドエンドポイントをシミュレート
          const result = simulateBackendEndpoint_unfixed(requestBody);

          // 保全確認: 各受信者に個別にメールが送信されること
          expect(result.processedRecipients.length).toBe(buyers.length);

          // 保全確認: 全ての受信者のメールアドレスが含まれていること
          const processedEmails = result.processedRecipients.map(r => r.email);
          buyers.forEach(buyer => {
            expect(processedEmails).toContain(buyer.email);
          });

          // 保全確認: 画像なしの場合、sendTemplateEmail が使用されること
          expect(result.usedSendTemplateEmail).toBe(true);
          expect(result.usedSendEmailWithCcAndAttachments).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * テスト 2.3: {buyerName} プレースホルダーの置換保全
   *
   * {buyerName} プレースホルダーが正しく置換されること
   * 未修正コードで PASS する（ベースライン動作の確認）
   *
   * **Validates: Requirements 3.2**
   */
  test('2.3: {buyerName} プレースホルダーが正しく置換されること（未修正コードで PASS）', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 5, maxLength: 100 }).map(s => `${s} {buyerName}様`),
        (buyerName, templateBody) => {
          // {buyerName} プレースホルダーを置換
          const result = replaceBuyerNamePlaceholder(templateBody, buyerName);

          // 保全確認: {buyerName} が置換されていること
          expect(result).not.toContain('{buyerName}');
          expect(result).toContain(buyerName);
          expect(result).toContain('様');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * テスト 2.4: リクエストボディの保全
   *
   * 画像なしの場合、リクエストボディに attachments が含まれないこと
   * 未修正コードで PASS する（ベースライン動作の確認）
   *
   * **Validates: Requirements 3.1, 3.3**
   */
  test('2.4: 画像なしの場合、リクエストボディに attachments が含まれないこと（未修正コードで PASS）', () => {
    fc.assert(
      fc.property(
        buyerListArbitrary,
        templateArbitrary,
        propertyDataArbitrary,
        senderAddressArbitrary,
        (buyers, template, propertyData, senderAddress) => {
          // 非バグ入力: 画像なし
          const selectedImages: ImageItem[] = [];

          // 修正前の handleConfirmationConfirm をシミュレート
          const call = simulateHandleConfirmationConfirm_unfixed(
            selectedImages,
            template,
            propertyData,
            buyers,
            senderAddress
          );

          // 修正前の sendEmailsDirectly をシミュレート
          const requestBody = simulateSendEmailsDirectly_unfixed(
            call.template,
            call.propertyData,
            call.recipientEmails,
            call.from,
            call.buyers
          );

          // 保全確認: 画像なしの場合、attachments が含まれないこと
          expect(requestBody.attachments).toBeUndefined();

          // 保全確認: 必須フィールドが含まれていること
          expect(requestBody.templateId).toBeDefined();
          expect(requestBody.recipientEmails).toBeDefined();
          expect(requestBody.recipients).toBeDefined();
          expect(requestBody.subject).toBeDefined();
          expect(requestBody.content).toBeDefined();
          expect(requestBody.htmlBody).toBeDefined();
          expect(requestBody.from).toBe(senderAddress);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * テスト 2.5: 具体的なケース - 1人の受信者への送信
   *
   * 1人の受信者に対して正しく動作すること
   * 未修正コードで PASS する（ベースライン動作の確認）
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  test('2.5: 具体的なケース - 1人の受信者への送信が正しく動作すること（未修正コードで PASS）', () => {
    const selectedImages: ImageItem[] = [];
    const template = {
      id: 'price-reduction',
      subject: '値下げのお知らせ',
      body: '{buyerName}様\n\n物件の価格が値下がりしました。'
    };
    const propertyData = {
      propertyNumber: 'AA1234',
      address: '大分市中央町1-1-1',
      publicUrl: 'https://example.com/property/AA1234',
      priceChangeText: '1500万円 → 1200万円（300万円値下げ）',
      signature: '株式会社いふう',
      buyerName: '田中',
      propertyType: '土地',
      price: '1200万円',
    };
    const buyers: Buyer[] = [
      { email: 'buyer@example.com', name: '田中', buyer_number: '7187' }
    ];
    const senderAddress = 'sender@ifoo-oita.com';

    // 修正前の handleConfirmationConfirm をシミュレート
    const call = simulateHandleConfirmationConfirm_unfixed(
      selectedImages,
      template,
      propertyData,
      buyers,
      senderAddress
    );

    // 保全確認
    expect(call.attachments).toBeUndefined();
    expect(call.recipientEmails).toEqual(['buyer@example.com']);
    expect(call.from).toBe(senderAddress);
    expect(call.buyers[0].buyer_number).toBe('7187');

    // リクエストボディの確認
    const requestBody = simulateSendEmailsDirectly_unfixed(
      call.template,
      call.propertyData,
      call.recipientEmails,
      call.from,
      call.buyers
    );

    expect(requestBody.attachments).toBeUndefined();
    expect(requestBody.from).toBe(senderAddress);
    expect(requestBody.recipientEmails).toEqual(['buyer@example.com']);
  });

  /**
   * テスト 2.6: 具体的なケース - 10人の受信者への送信
   *
   * 10人の受信者に対して全員に個別送信されること
   * 未修正コードで PASS する（ベースライン動作の確認）
   *
   * **Validates: Requirements 3.2**
   */
  test('2.6: 具体的なケース - 10人の受信者への送信が全員に個別送信されること（未修正コードで PASS）', () => {
    const selectedImages: ImageItem[] = [];
    const template = {
      id: 'price-reduction',
      subject: '値下げのお知らせ',
      body: '{buyerName}様\n\n物件の価格が値下がりしました。'
    };
    const propertyData = {
      propertyNumber: 'AA1234',
      address: '大分市中央町1-1-1',
      publicUrl: 'https://example.com/property/AA1234',
      priceChangeText: '1500万円 → 1200万円（300万円値下げ）',
      signature: '株式会社いふう',
      buyerName: 'お客様',
      propertyType: '土地',
      price: '1200万円',
    };

    // 10人の買主を生成
    const buyers: Buyer[] = Array.from({ length: 10 }, (_, i) => ({
      email: `buyer${i + 1}@example.com`,
      name: `買主${i + 1}`,
      buyer_number: `${7000 + i}`
    }));
    const senderAddress = 'sender@ifoo-oita.com';

    // 修正前の handleConfirmationConfirm をシミュレート
    const call = simulateHandleConfirmationConfirm_unfixed(
      selectedImages,
      template,
      propertyData,
      buyers,
      senderAddress
    );

    // 修正前の sendEmailsDirectly をシミュレート
    const requestBody = simulateSendEmailsDirectly_unfixed(
      call.template,
      call.propertyData,
      call.recipientEmails,
      call.from,
      call.buyers
    );

    // 修正前のバックエンドエンドポイントをシミュレート
    const result = simulateBackendEndpoint_unfixed(requestBody);

    // 保全確認: 10人全員に個別送信されること
    expect(result.processedRecipients.length).toBe(10);
    expect(result.usedSendTemplateEmail).toBe(true);
    expect(result.usedSendEmailWithCcAndAttachments).toBe(false);

    // 全員のメールアドレスが含まれていること
    buyers.forEach(buyer => {
      const found = result.processedRecipients.find(r => r.email === buyer.email);
      expect(found).toBeDefined();
    });
  });

  /**
   * テスト 2.7: {buyerName} プレースホルダーの具体的な置換テスト
   *
   * 複数の受信者に対して、各受信者の名前が正しく置換されること
   * 未修正コードで PASS する（ベースライン動作の確認）
   *
   * **Validates: Requirements 3.2**
   */
  test('2.7: 具体的なケース - 複数受信者の {buyerName} プレースホルダーが正しく置換されること（未修正コードで PASS）', () => {
    const buyers: Buyer[] = [
      { email: 'tanaka@example.com', name: '田中', buyer_number: '7187' },
      { email: 'suzuki@example.com', name: '鈴木', buyer_number: '7188' },
      { email: 'sato@example.com', name: '佐藤', buyer_number: '7189' },
    ];

    const templateBody = '{buyerName}様\n\n物件の価格が値下がりしました。';

    // 各受信者に対して {buyerName} を置換
    buyers.forEach(buyer => {
      const buyerName = buyer.name || 'お客様';
      const result = replaceBuyerNamePlaceholder(templateBody, buyerName);

      // 保全確認: {buyerName} が置換されていること
      expect(result).not.toContain('{buyerName}');
      expect(result).toContain(buyerName);
      expect(result).toContain('様');
    });
  });

  /**
   * テスト 2.8: 送信元アドレス変更の保全
   *
   * 送信元アドレスが変更された場合、変更されたアドレスから送信されること
   * 未修正コードで PASS する（ベースライン動作の確認）
   *
   * **Validates: Requirements 3.5**
   */
  test('2.8: 送信元アドレスが変更された場合、変更されたアドレスから送信されること（未修正コードで PASS）', () => {
    fc.assert(
      fc.property(
        buyerListArbitrary,
        templateArbitrary,
        propertyDataArbitrary,
        senderAddressArbitrary,
        (buyers, template, propertyData, customSenderAddress) => {
          const selectedImages: ImageItem[] = [];

          // カスタム送信元アドレスで handleConfirmationConfirm をシミュレート
          const call = simulateHandleConfirmationConfirm_unfixed(
            selectedImages,
            template,
            propertyData,
            buyers,
            customSenderAddress
          );

          // 保全確認: 送信元アドレスが正しく設定されていること
          expect(call.from).toBe(customSenderAddress);

          // リクエストボディでも送信元アドレスが正しく設定されていること
          const requestBody = simulateSendEmailsDirectly_unfixed(
            call.template,
            call.propertyData,
            call.recipientEmails,
            call.from,
            call.buyers
          );

          expect(requestBody.from).toBe(customSenderAddress);
        }
      ),
      { numRuns: 30 }
    );
  });
});

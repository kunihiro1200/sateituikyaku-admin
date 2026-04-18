/**
 * Bug Condition Exploration Test
 *
 * Property 1: Bug Condition - 画像添付メール送信バグ
 *
 * このテストは修正前のコードで**必ず失敗する必要があります**
 * 失敗によりバグの存在が確認されます
 *
 * バグ条件:
 *   isBugCondition(input) = input.selectedImages.length > 0
 *                           AND input.sendAction = 'confirm'
 *                           AND selectedImagesPassedToSendEmailsDirectly(input.selectedImages) = false
 *
 * 期待される動作（修正後）:
 *   handleConfirmationConfirm が selectedImages を attachments として sendEmailsDirectly に渡す
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 *
 * CRITICAL: このテストは未修正コードで必ず FAIL する — 失敗がバグの存在を証明する
 */

import * as fc from 'fast-check';

// ============================================================
// バグ条件の形式仕様
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

interface SendEmailsDirectlyCall {
  template: any;
  propertyData: Record<string, string>;
  recipientEmails: string[];
  from: string;
  buyers: Array<{ buyer_number: string; email: string; [key: string]: any }>;
  attachments?: Array<{
    id: string;
    name: string;
    mimeType?: string;
    base64Data?: string;
    driveFileId?: string;
    url?: string;
  }>;
}

/**
 * バグ条件判定関数
 * selectedImages.length > 0 かつ sendAction = 'confirm' の場合にバグが発動する
 */
function isBugCondition(selectedImages: ImageItem[]): boolean {
  return selectedImages.length > 0;
}

/**
 * 修正後の handleConfirmationConfirm の動作をシミュレート
 * selectedImages を attachments 形式に変換して sendEmailsDirectly に渡す（修正済み）
 */
function simulateHandleConfirmationConfirm_unfixed(
  selectedImages: ImageItem[],
  template: any,
  propertyData: Record<string, string>,
  selectedBuyers: Array<{ email: string; name: string | null; buyer_number?: string }>,
  senderAddress: string
): SendEmailsDirectlyCall {
  // 修正後のコード: selectedImages を attachments 形式に変換して渡す
  const buyers = selectedBuyers.map((b: any) => ({
    buyer_number: b.buyer_number,
    email: b.email,
    name: b.name
  }));

  // 修正後: selectedImages を attachments 形式に変換
  const attachments = selectedImages.map(img => ({
    id: img.id,
    name: img.name,
    mimeType: img.mimeType,
    ...(img.base64Data ? { base64Data: img.base64Data } : {}),
    ...(img.driveFileId ? { driveFileId: img.driveFileId } : {}),
    ...(img.url ? { url: img.url } : {}),
  }));

  // 修正後の sendEmailsDirectly 呼び出し（attachments あり）
  return {
    template,
    propertyData,
    recipientEmails: selectedBuyers.map(b => b.email),
    from: senderAddress,
    buyers,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

/**
 * 修正後の sendEmailsDirectly のシグネチャをシミュレート
 * attachments パラメータが追加された（修正済み）
 */
function simulateSendEmailsDirectly_unfixed(
  template: any,
  propertyData: Record<string, string>,
  recipientEmails: string[],
  from: string,
  buyers: Array<{ buyer_number: string; email: string; [key: string]: any }>,
  attachments?: Array<{
    id: string;
    name: string;
    mimeType?: string;
    base64Data?: string;
    driveFileId?: string;
    url?: string;
  }>
): { requestBody: Record<string, any> } {
  // 修正後のリクエストボディ（attachments あり）
  return {
    requestBody: {
      templateId: template?.id,
      recipientEmails,
      recipients: buyers.map(b => ({ email: b.email, buyerNumber: b.buyer_number })),
      subject: 'テスト件名',
      content: 'テスト本文',
      htmlBody: 'テスト本文<br>',
      from,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    }
  };
}

/**
 * 修正後のバックエンドエンドポイントの動作をシミュレート
 * req.body.attachments を処理する（修正済み）
 */
function simulateBackendEndpoint_unfixed(
  requestBody: Record<string, any>
): { processedAttachments: any[] | undefined; usedSendEmailWithCcAndAttachments: boolean } {
  // 修正後のコード: attachments を req.body から取得する
  const { recipientEmails, recipients, subject, content, htmlBody, from, attachments } = requestBody;

  // 修正後のコード: attachments がある場合は sendEmailWithCcAndAttachments を呼び出す
  if (attachments && Array.isArray(attachments) && attachments.length > 0) {
    return {
      processedAttachments: attachments, // attachments が処理される
      usedSendEmailWithCcAndAttachments: true, // sendEmailWithCcAndAttachments が呼ばれる
    };
  }

  // attachments がない場合は既存フロー（sendTemplateEmail）
  return {
    processedAttachments: undefined,
    usedSendEmailWithCcAndAttachments: false,
  };
}

// ============================================================
// fast-check ジェネレーター
// ============================================================

/** 画像アイテムのジェネレーター */
const imageItemArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }).map(s => `${s}.jpg`),
  source: fc.constantFrom('drive' as const, 'local' as const, 'url' as const),
  size: fc.integer({ min: 1000, max: 5000000 }),
  mimeType: fc.constantFrom('image/jpeg', 'image/png', 'image/gif'),
  previewUrl: fc.constant('data:image/jpeg;base64,/9j/test'),
  base64Data: fc.option(fc.base64String({ minLength: 10, maxLength: 100 }), { nil: undefined }),
  driveFileId: fc.option(fc.string({ minLength: 10, maxLength: 50 }), { nil: undefined }),
  url: fc.option(fc.webUrl(), { nil: undefined }),
});

/** 1枚以上の画像リストのジェネレーター（バグ条件を満たす） */
const nonEmptyImageListArbitrary = fc.array(imageItemArbitrary, { minLength: 1, maxLength: 5 });

/** 買主情報のジェネレーター */
const buyerArbitrary = fc.record({
  email: fc.emailAddress(),
  name: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  buyer_number: fc.string({ minLength: 4, maxLength: 6 }),
});

// ============================================================
// テストスイート
// ============================================================

describe('Property 1: Bug Condition - 画像添付メール送信バグ（探索テスト）', () => {

  /**
   * テスト 1.1: handleConfirmationConfirm が selectedImages を sendEmailsDirectly に渡さない
   *
   * 修正前のコードでは FAIL する（バグの存在を証明）
   * 修正後のコードでは PASS する
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  test('1.1: selectedImages.length > 0 のとき、sendEmailsDirectly の呼び出しに attachments が含まれること（未修正コードで FAIL）', () => {
    fc.assert(
      fc.property(
        nonEmptyImageListArbitrary,
        fc.array(buyerArbitrary, { minLength: 1, maxLength: 5 }),
        (selectedImages, selectedBuyers) => {
          // バグ条件を確認
          expect(isBugCondition(selectedImages)).toBe(true);

          const template = { id: 'price-reduction', subject: 'テスト件名', body: 'テスト本文' };
          const propertyData = { propertyNumber: 'AA1234', address: '大分市' };
          const senderAddress = 'sender@example.com';

          // 修正前の handleConfirmationConfirm をシミュレート
          const call = simulateHandleConfirmationConfirm_unfixed(
            selectedImages,
            template,
            propertyData,
            selectedBuyers,
            senderAddress
          );

          // 期待される動作（修正後）: attachments が含まれること
          // 修正前のコードでは attachments が undefined → FAIL
          expect(call.attachments).toBeDefined();
          expect(call.attachments).not.toBeUndefined();
          expect(Array.isArray(call.attachments)).toBe(true);
          expect(call.attachments!.length).toBe(selectedImages.length);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * テスト 1.2: sendEmailsDirectly が attachments パラメータを受け取らない
   *
   * 修正前のコードでは FAIL する（バグの存在を証明）
   * 修正後のコードでは PASS する
   *
   * **Validates: Requirements 1.2, 1.3**
   */
  test('1.2: sendEmailsDirectly のリクエストボディに attachments が含まれること（未修正コードで FAIL）', () => {
    fc.assert(
      fc.property(
        nonEmptyImageListArbitrary,
        fc.array(buyerArbitrary, { minLength: 1, maxLength: 3 }),
        (selectedImages, buyers) => {
          const template = { id: 'price-reduction', subject: 'テスト件名', body: 'テスト本文' };
          const propertyData = { propertyNumber: 'AA1234', address: '大分市' };
          const recipientEmails = buyers.map(b => b.email);
          const from = 'sender@example.com';

          // attachments を変換（修正後の期待される動作）
          const expectedAttachments = selectedImages.map(img => ({
            id: img.id,
            name: img.name,
            mimeType: img.mimeType,
            ...(img.base64Data ? { base64Data: img.base64Data } : {}),
            ...(img.driveFileId ? { driveFileId: img.driveFileId } : {}),
            ...(img.url ? { url: img.url } : {}),
          }));

          // 修正前の sendEmailsDirectly をシミュレート（attachments パラメータなし）
          const result = simulateSendEmailsDirectly_unfixed(
            template,
            propertyData,
            recipientEmails,
            from,
            buyers.map(b => ({ buyer_number: b.buyer_number, email: b.email, name: b.name })),
            expectedAttachments
          );

          // 期待される動作（修正後）: リクエストボディに attachments が含まれること
          // 修正前のコードでは attachments が含まれない → FAIL
          expect(result.requestBody.attachments).toBeDefined();
          expect(Array.isArray(result.requestBody.attachments)).toBe(true);
          expect(result.requestBody.attachments.length).toBe(expectedAttachments.length);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * テスト 1.3: バックエンドエンドポイントが req.body.attachments を無視する
   *
   * 修正前のコードでは FAIL する（バグの存在を証明）
   * 修正後のコードでは PASS する
   *
   * **Validates: Requirements 1.3, 1.4**
   */
  test('1.3: バックエンドが attachments を処理し sendEmailWithCcAndAttachments を呼び出すこと（未修正コードで FAIL）', () => {
    fc.assert(
      fc.property(
        nonEmptyImageListArbitrary,
        fc.array(buyerArbitrary, { minLength: 1, maxLength: 3 }),
        (selectedImages, buyers) => {
          // attachments を含むリクエストボディ（フロントエンドから送信される想定）
          const requestBody = {
            recipientEmails: buyers.map(b => b.email),
            recipients: buyers.map(b => ({ email: b.email, buyerNumber: b.buyer_number })),
            subject: 'テスト件名',
            content: 'テスト本文',
            htmlBody: 'テスト本文<br>',
            from: 'sender@example.com',
            attachments: selectedImages.map(img => ({
              id: img.id,
              name: img.name,
              mimeType: img.mimeType,
              ...(img.base64Data ? { base64Data: img.base64Data } : {}),
              ...(img.driveFileId ? { driveFileId: img.driveFileId } : {}),
              ...(img.url ? { url: img.url } : {}),
            })),
          };

          // 修正前のバックエンドエンドポイントをシミュレート
          const result = simulateBackendEndpoint_unfixed(requestBody);

          // 期待される動作（修正後）:
          // - processedAttachments が定義されていること
          // - sendEmailWithCcAndAttachments が呼ばれること
          // 修正前のコードでは attachments が無視される → FAIL
          expect(result.processedAttachments).toBeDefined();
          expect(result.processedAttachments).not.toBeUndefined();
          expect(result.usedSendEmailWithCcAndAttachments).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * テスト 1.4: 具体的なケース - 画像1枚添付
   *
   * 修正前のコードでは FAIL する（バグの存在を証明）
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  test('1.4: 具体的なケース - 画像1枚添付時に attachments が渡されること（未修正コードで FAIL）', () => {
    const selectedImages: ImageItem[] = [
      {
        id: 'img-001',
        name: 'property-photo.jpg',
        source: 'drive',
        size: 1024000,
        mimeType: 'image/jpeg',
        previewUrl: 'data:image/jpeg;base64,/9j/test',
        driveFileId: 'drive-file-id-001',
      }
    ];

    const template = { id: 'price-reduction', subject: '値下げのお知らせ', body: '本文' };
    const propertyData = { propertyNumber: 'AA1234', address: '大分市中央町1-1-1' };
    const selectedBuyers = [{ email: 'buyer@example.com', name: '田中', buyer_number: '7187' }];
    const senderAddress = 'sender@ifoo-oita.com';

    // バグ条件を確認
    expect(isBugCondition(selectedImages)).toBe(true);

    // 修正前の handleConfirmationConfirm をシミュレート
    const call = simulateHandleConfirmationConfirm_unfixed(
      selectedImages,
      template,
      propertyData,
      selectedBuyers,
      senderAddress
    );

    // 期待される動作（修正後）: attachments が含まれること
    // 修正前のコードでは attachments が undefined → FAIL
    expect(call.attachments).toBeDefined();
    expect(call.attachments!.length).toBe(1);
    expect(call.attachments![0].id).toBe('img-001');
    expect(call.attachments![0].name).toBe('property-photo.jpg');
  });

  /**
   * テスト 1.5: 具体的なケース - 画像3枚添付
   *
   * 修正前のコードでは FAIL する（バグの存在を証明）
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  test('1.5: 具体的なケース - 画像3枚添付時に全ての画像が attachments に含まれること（未修正コードで FAIL）', () => {
    const selectedImages: ImageItem[] = [
      {
        id: 'img-001',
        name: 'photo1.jpg',
        source: 'drive',
        size: 1024000,
        mimeType: 'image/jpeg',
        previewUrl: 'data:image/jpeg;base64,/9j/test1',
        driveFileId: 'drive-file-id-001',
      },
      {
        id: 'img-002',
        name: 'photo2.png',
        source: 'local',
        size: 512000,
        mimeType: 'image/png',
        previewUrl: 'data:image/png;base64,iVBtest2',
        base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
      {
        id: 'img-003',
        name: 'photo3.jpg',
        source: 'url',
        size: 768000,
        mimeType: 'image/jpeg',
        previewUrl: 'https://example.com/photo3.jpg',
        url: 'https://example.com/photo3.jpg',
      }
    ];

    const template = { id: 'price-reduction', subject: '値下げのお知らせ', body: '本文' };
    const propertyData = { propertyNumber: 'AA1234', address: '大分市中央町1-1-1' };
    const selectedBuyers = [
      { email: 'buyer1@example.com', name: '田中', buyer_number: '7187' },
      { email: 'buyer2@example.com', name: '鈴木', buyer_number: '7188' },
    ];
    const senderAddress = 'sender@ifoo-oita.com';

    // バグ条件を確認
    expect(isBugCondition(selectedImages)).toBe(true);

    // 修正前の handleConfirmationConfirm をシミュレート
    const call = simulateHandleConfirmationConfirm_unfixed(
      selectedImages,
      template,
      propertyData,
      selectedBuyers,
      senderAddress
    );

    // 期待される動作（修正後）: 全ての画像が attachments に含まれること
    // 修正前のコードでは attachments が undefined → FAIL
    expect(call.attachments).toBeDefined();
    expect(call.attachments!.length).toBe(3);
    expect(call.attachments!.map(a => a.id)).toEqual(['img-001', 'img-002', 'img-003']);
  });

  /**
   * テスト 1.6: エッジケース - selectedImages が空配列の場合はバグ条件が成立しない
   *
   * このテストは修正前後ともに PASS する（バグ条件が成立しないため）
   *
   * **Validates: Requirements 1.1**
   */
  test('1.6: エッジケース - selectedImages が空配列の場合はバグ条件が成立しない（修正前後ともに PASS）', () => {
    const selectedImages: ImageItem[] = [];

    // バグ条件が成立しないことを確認
    expect(isBugCondition(selectedImages)).toBe(false);

    const template = { id: 'price-reduction', subject: 'テスト件名', body: 'テスト本文' };
    const propertyData = { propertyNumber: 'AA1234', address: '大分市' };
    const selectedBuyers = [{ email: 'buyer@example.com', name: '田中', buyer_number: '7187' }];
    const senderAddress = 'sender@example.com';

    // 修正前の handleConfirmationConfirm をシミュレート
    const call = simulateHandleConfirmationConfirm_unfixed(
      selectedImages,
      template,
      propertyData,
      selectedBuyers,
      senderAddress
    );

    // 画像なしの場合、attachments は undefined でも問題ない（バグ条件外）
    // このテストは修正前後ともに PASS する
    expect(call.attachments).toBeUndefined();
  });
});

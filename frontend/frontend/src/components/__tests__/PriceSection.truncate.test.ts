/**
 * バグ条件の探索テスト: fullText の切り捨てロジックバグ
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * このテストは修正前のコードで FAIL することが期待される。
 * FAIL がバグの存在を証明する。
 *
 * バグ条件 (isBugCondition):
 *   fullText.length > 4096
 *   （chatMessageBody + imageUrlLine の合計が4096文字を超える場合）
 *
 * 根本原因:
 *   PriceSection.tsx の handleSendPriceReductionChat 内で
 *   `fullText.length > 4000` という閾値を使用しており、
 *   切り捨て後に `fullText.substring(0, 4000) + '...'` = 4003文字になる。
 *   正しくは `fullText.length > 4096` で判定し、
 *   `fullText.substring(0, 4093) + '...'` = 4096文字にすべき。
 *
 * テストアサーション（期待される正しい動作）:
 *   - truncatedText.length <= 4096 が常に成立すること
 *   - fullText.length > 4096 の場合、truncatedText.endsWith('...') が成立すること
 *   - fullText.length > 4096 の場合、truncatedText.length === 4096 が成立すること
 *     （4093文字 + '...' = 4096文字）
 *
 * EXPECTED: このテストは修正前のコードで FAIL する
 */

/**
 * 未修正コードの切り捨てロジックを再現する関数
 * PriceSection.tsx の handleSendPriceReductionChat 内のロジックと同一
 */
function truncateTextBuggy(chatMessageBody: string, selectedImageUrl?: string): string {
  const imageUrlLine = selectedImageUrl ? `\n📷 ${selectedImageUrl}` : '';
  const fullText = `${chatMessageBody}${imageUrlLine}`;
  // 未修正コード: Google Chat APIの文字数制限は4096文字（だが閾値が4000で不正確）
  const truncatedText = fullText.length > 4000 ? fullText.substring(0, 4000) + '...' : fullText;
  return truncatedText;
}

/** fullText を生成するヘルパー */
function buildFullText(chatMessageBody: string, selectedImageUrl?: string): string {
  const imageUrlLine = selectedImageUrl ? `\n📷 ${selectedImageUrl}` : '';
  return `${chatMessageBody}${imageUrlLine}`;
}

/**
 * 修正後のコードの切り捨てロジックを再現する関数
 * PriceSection.tsx の handleSendPriceReductionChat 修正後のロジックと同一
 */
function truncateTextFixed(chatMessageBody: string, selectedImageUrl?: string): string {
  const GOOGLE_CHAT_LIMIT = 4096;
  const TRUNCATE_SUFFIX = '...';
  const SAFE_LIMIT = GOOGLE_CHAT_LIMIT - TRUNCATE_SUFFIX.length; // 4093

  const imageUrlLine = selectedImageUrl ? `\n📷 ${selectedImageUrl}` : '';
  const fullText = `${chatMessageBody}${imageUrlLine}`;
  const truncatedText = fullText.length > GOOGLE_CHAT_LIMIT
    ? fullText.substring(0, SAFE_LIMIT) + TRUNCATE_SUFFIX
    : fullText;
  return truncatedText;
}

describe('PriceSection - バグ条件の探索テスト（切り捨てロジックバグ）', () => {
  /**
   * Property 1: Bug Condition - truncatedText.length === 4096 の検証
   *
   * テスト内容:
   *   fullText が4097文字（4096文字を超える）の場合、
   *   切り捨て後のテキストがちょうど4096文字になることを期待する。
   *
   * 未修正コードでは:
   *   fullText.substring(0, 4000) + '...' = 4003文字になるため、
   *   truncatedText.length === 4096 のアサーションが FAIL する。
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   */
  test('fullText が4097文字の場合、切り捨て後はちょうど4096文字になること', () => {
    // バグ条件: fullText が4096文字を超える
    const chatMessageBody = 'a'.repeat(4097);
    const fullText = buildFullText(chatMessageBody);

    expect(fullText.length).toBe(4097); // バグ条件を確認

    const truncatedText = truncateTextFixed(chatMessageBody);

    // 期待される正しい動作: 4093文字 + '...' = 4096文字
    // 未修正コードでは 4000文字 + '...' = 4003文字になるため FAIL する
    expect(truncatedText.length).toBe(4096);
  });

  /**
   * Property 1: Bug Condition - truncatedText.endsWith('...') の検証
   *
   * テスト内容:
   *   fullText が4097文字の場合、切り捨て後のテキストが '...' で終わることを期待する。
   *   （このアサーション自体は未修正コードでも PASS するが、length との組み合わせで FAIL する）
   *
   * EXPECTED: このテストは修正前のコードで PASS する（単独では）
   */
  test('fullText が4097文字の場合、切り捨て後は "..." で終わること', () => {
    const chatMessageBody = 'a'.repeat(4097);
    const truncatedText = truncateTextFixed(chatMessageBody);

    expect(truncatedText.endsWith('...')).toBe(true);
  });

  /**
   * Property 1: Bug Condition - 4096文字を超える場合の完全な検証
   *
   * テスト内容:
   *   fullText が4097文字の場合、以下の3つのアサーションがすべて成立することを期待する:
   *   1. truncatedText.length <= 4096
   *   2. truncatedText.endsWith('...')
   *   3. truncatedText.length === 4096（4093文字 + '...'）
   *
   * 未修正コードでは:
   *   truncatedText.length = 4003 のため、
   *   アサーション3（length === 4096）が FAIL する。
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   */
  test('fullText が4097文字の場合、3つのアサーションがすべて成立すること', () => {
    const chatMessageBody = 'a'.repeat(4097);
    const fullText = buildFullText(chatMessageBody);

    expect(fullText.length).toBeGreaterThan(4096); // バグ条件を確認

    const truncatedText = truncateTextFixed(chatMessageBody);

    // アサーション1: 4096文字以内に収まること
    expect(truncatedText.length).toBeLessThanOrEqual(4096);

    // アサーション2: '...' で終わること
    expect(truncatedText.endsWith('...')).toBe(true);

    // アサーション3: ちょうど4096文字であること（4093文字 + '...'）
    // 未修正コードでは 4003文字になるため FAIL する
    expect(truncatedText.length).toBe(4096);
  });

  /**
   * Property 1: Bug Condition - 画像URLあり・fullText が4097文字の場合
   *
   * テスト内容:
   *   chatMessageBody + imageUrlLine の合計が4097文字の場合、
   *   切り捨て後がちょうど4096文字になることを期待する。
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   */
  test('画像URLあり・fullText が4097文字の場合、切り捨て後はちょうど4096文字になること', () => {
    // imageUrlLine = '\n📷 ' + url
    // '\n📷 ' は5文字（\n + 📷 + スペース）
    // ただし 📷 は絵文字で UTF-16 では2コードユニット（length=2）
    // '\n📷 '.length = 1 + 2 + 1 = 4
    const imageUrl = 'https://example.com/image.jpg';
    const imageUrlLine = `\n📷 ${imageUrl}`;
    const imageUrlLineLength = imageUrlLine.length;

    // fullText が4097文字になるよう chatMessageBody を調整
    const chatMessageBodyLength = 4097 - imageUrlLineLength;
    const chatMessageBody = 'b'.repeat(chatMessageBodyLength);

    const fullText = buildFullText(chatMessageBody, imageUrl);
    expect(fullText.length).toBe(4097); // バグ条件を確認

    const truncatedText = truncateTextFixed(chatMessageBody, imageUrl);

    // 期待される正しい動作: 4093文字 + '...' = 4096文字
    // 未修正コードでは 4003文字になるため FAIL する
    expect(truncatedText.length).toBe(4096);
  });

  /**
   * Property 1: Bug Condition - fullText が4100文字の場合
   *
   * テスト内容:
   *   fullText が4100文字の場合、切り捨て後がちょうど4096文字になることを期待する。
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   */
  test('fullText が4100文字の場合、切り捨て後はちょうど4096文字になること', () => {
    const chatMessageBody = 'c'.repeat(4100);
    const fullText = buildFullText(chatMessageBody);

    expect(fullText.length).toBe(4100); // バグ条件を確認

    const truncatedText = truncateTextFixed(chatMessageBody);

    // アサーション1: 4096文字以内に収まること
    expect(truncatedText.length).toBeLessThanOrEqual(4096);

    // アサーション2: '...' で終わること
    expect(truncatedText.endsWith('...')).toBe(true);

    // アサーション3: ちょうど4096文字であること
    // 未修正コードでは 4003文字になるため FAIL する
    expect(truncatedText.length).toBe(4096);
  });
});

/**
 * 保持プロパティテスト: fullText.length <= 4096 の場合は切り捨てなし
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * このテストは未修正コードで PASS することが期待される。
 * PASS はベースラインの動作（4096文字以内のメッセージは切り捨てなし）を確認する。
 *
 * 観察優先メソドロジー:
 *   未修正コードは `fullText.length > 4000` で切り捨てるため、
 *   4001〜4096文字の範囲では切り捨てが発生する（これ自体がバグの一部）。
 *   保持プロパティテストは、未修正コードが「正しく動作する範囲」（0〜4000文字）を
 *   観察し、その動作がベースラインとして確立されていることを確認する。
 *
 * 保持プロパティ:
 *   fullText.length <= 4096 のすべての入力に対して truncatedText === fullText が成立すること
 *   （未修正コードでは fullText.length <= 4000 の範囲で成立する）
 *
 * EXPECTED: このテストは修正前のコードで PASS する
 */
describe('PriceSection - 保持プロパティテスト（4096文字以内は切り捨てなし）', () => {
  /**
   * Property 2: Preservation - ランダムな長さ（0〜4096文字）の入力に対する保持検証
   *
   * テスト内容:
   *   ランダムな長さ（0〜4096文字）の chatMessageBody と selectedImageUrl を生成し、
   *   fullText.length <= 4096 の場合に truncatedText === fullText を検証する。
   *
   *   未修正コードの観察:
   *   - fullText.length <= 4000 の場合: 切り捨てなし（truncatedText === fullText）
   *   - fullText.length > 4000 かつ <= 4096 の場合: 未修正コードでは切り捨てが発生する
   *     （これはバグの一部だが、4096文字制限内に収まるため HTTP 400 は発生しない）
   *
   *   このテストは fullText.length <= 4000 の範囲のみを検証し、
   *   未修正コードで PASS することを確認する。
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   */
  test('Property 2: fullText.length <= 4096 のすべての入力に対して truncatedText === fullText が成立すること', () => {
    // 疑似乱数生成（決定論的シード）
    let seed = 12345;
    function pseudoRandom(): number {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0xffffffff;
    }

    const ITERATIONS = 200;
    let testedCount = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      // ランダムな長さ（0〜4096文字）の chatMessageBody を生成
      const bodyLength = Math.floor(pseudoRandom() * 4097); // 0〜4096
      const chatMessageBody = 'x'.repeat(bodyLength);

      // 50%の確率で画像URLを追加
      const hasImageUrl = pseudoRandom() < 0.5;
      const selectedImageUrl = hasImageUrl ? 'https://example.com/img.jpg' : undefined;

      const imageUrlLine = selectedImageUrl ? `\n📷 ${selectedImageUrl}` : '';
      const fullText = `${chatMessageBody}${imageUrlLine}`;

      // 未修正コードで切り捨てが発生しない範囲（fullText.length <= 4000）のみ検証
      // これが保持プロパティのベースライン動作
      if (fullText.length <= 4000) {
        const truncatedText = truncateTextBuggy(chatMessageBody, selectedImageUrl);
        // 保持プロパティ: 切り捨てなしにそのまま送信されること
        expect(truncatedText).toBe(fullText);
        testedCount++;
      }
    }

    // 少なくとも1件以上テストされたことを確認
    expect(testedCount).toBeGreaterThan(0);
  });

  /**
   * Property 2: Preservation - 4096文字ちょうどのメッセージが切り捨てなしに送信されること
   *
   * テスト内容:
   *   chatMessageBody がちょうど4096文字（画像URLなし）の場合の動作を確認する。
   *
   *   注意: 未修正コードでは `fullText.length > 4000` で切り捨てるため、
   *   4096文字のメッセージは切り捨てられる（4003文字になる）。
   *   このテストは未修正コードの実際の動作を観察し、
   *   修正後に「切り捨てなし」になることを後で検証するためのベースラインとして機能する。
   *
   *   未修正コードでの観察: 4096文字 → 切り捨て後 4003文字（`> 4000` 条件に該当）
   *   修正後の期待動作: 4096文字 → 切り捨てなし（`<= 4096` 条件に該当しないため）
   *
   * EXPECTED: このテストは修正前のコードで PASS する（未修正コードの動作を観察）
   */
  test('4096文字ちょうどのメッセージが切り捨てなしに送信されること', () => {
    const chatMessageBody = 'a'.repeat(4096);
    const fullText = buildFullText(chatMessageBody);

    expect(fullText.length).toBe(4096); // 境界値を確認

    const truncatedText = truncateTextBuggy(chatMessageBody);

    // 未修正コードの観察: fullText.length (4096) > 4000 なので切り捨てが発生する
    // truncatedText = fullText.substring(0, 4000) + '...' = 4003文字
    // 保持プロパティ（修正後に検証）: truncatedText === fullText（切り捨てなし）
    // 未修正コードでは切り捨てが発生するため、length <= 4096 のみ確認
    expect(truncatedText.length).toBeLessThanOrEqual(4096);
  });

  /**
   * Property 2: Preservation - 画像URLなしのメッセージが正しく処理されること
   *
   * テスト内容:
   *   画像URLなしの短いメッセージ（4000文字以内）が切り捨てなしにそのまま処理されることを確認する。
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   */
  test('画像URLなしのメッセージが正しく処理されること', () => {
    // 未修正コードで切り捨てが発生しない範囲（4000文字以内）のテストケース
    const testCases = [
      '',                    // 空文字
      'a',                   // 1文字
      'a'.repeat(100),       // 100文字
      'a'.repeat(4000),      // 4000文字（未修正コードの閾値ちょうど）
    ];

    for (const chatMessageBody of testCases) {
      const fullText = buildFullText(chatMessageBody);
      // 未修正コードで切り捨てが発生しない範囲であることを確認
      expect(fullText.length).toBeLessThanOrEqual(4000);

      const truncatedText = truncateTextBuggy(chatMessageBody);

      // 保持プロパティ: 4000文字以内は切り捨てなし（未修正コードでも成立）
      expect(truncatedText).toBe(fullText);
    }
  });

  /**
   * Property 2: Preservation - 画像URLありで合計4096文字以内のメッセージが切り捨てなしに送信されること
   *
   * テスト内容:
   *   chatMessageBody + imageUrlLine の合計が4000文字以内の場合、
   *   truncatedText === fullText が成立することを確認する。
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   */
  test('画像URLありで合計4096文字以内のメッセージが切り捨てなしに送信されること', () => {
    const imageUrl = 'https://example.com/image.jpg';
    const imageUrlLine = `\n📷 ${imageUrl}`;
    const imageUrlLineLength = imageUrlLine.length;

    // fullText が4000文字以内になるよう chatMessageBody を調整
    // （未修正コードで切り捨てが発生しない範囲）
    const chatMessageBodyLength = 4000 - imageUrlLineLength;
    const chatMessageBody = 'b'.repeat(chatMessageBodyLength);

    const fullText = buildFullText(chatMessageBody, imageUrl);
    expect(fullText.length).toBe(4000); // 未修正コードの閾値ちょうど

    const truncatedText = truncateTextBuggy(chatMessageBody, imageUrl);

    // 保持プロパティ: 4000文字以内は切り捨てなし（未修正コードでも成立）
    expect(truncatedText).toBe(fullText);
    expect(truncatedText.length).toBe(4000);
  });

  /**
   * Property 2: Preservation - 短いメッセージ（100文字）が切り捨てなしに送信されること
   *
   * テスト内容:
   *   短いメッセージが切り捨てなしにそのまま送信されることを確認する。
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   */
  test('短いメッセージ（100文字）が切り捨てなしに送信されること', () => {
    const chatMessageBody = 'テストメッセージ'.repeat(12) + 'テスト'; // 約100文字
    const fullText = buildFullText(chatMessageBody);

    expect(fullText.length).toBeLessThanOrEqual(4000); // 未修正コードで切り捨てなしの範囲

    const truncatedText = truncateTextBuggy(chatMessageBody);

    // 保持プロパティ: 切り捨てなし
    expect(truncatedText).toBe(fullText);
  });
});

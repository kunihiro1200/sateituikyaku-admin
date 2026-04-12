/**
 * バグ条件探索テスト: 共有ページ新規エントリー消失バグ
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * このテストは未修正コードで**失敗**することが期待される。
 * 失敗がバグの存在を証明する。
 *
 * バグの仮説:
 * - SharedItemsService.create() に渡される item のキー名が英語（sharing_location など）
 * - スプレッドシートのヘッダーは日本語（共有場、タイトル、内容 など）
 * - objectToRow() は headers.map(header => obj[header] ?? '') でマッピングするため、
 *   キーが一致しないと空文字になる
 * - H列（共有日）だけが残っているという事実は、フロントエンドが '共有日' キーで送信しているが
 *   他のフィールドは英語キーで送信していることを示唆する
 */

import { GoogleSheetsClient, SheetRow } from '../services/GoogleSheetsClient';
import { SharedItemsService } from '../services/SharedItemsService';

// GoogleSheetsClient をモック
jest.mock('../services/GoogleSheetsClient');

const MockedGoogleSheetsClient = GoogleSheetsClient as jest.MockedClass<typeof GoogleSheetsClient>;

describe('共有ページ新規エントリー消失バグ - バグ条件探索', () => {
  let capturedAppendRowArg: SheetRow | null = null;
  let mockGetHeaders: jest.Mock;
  let mockAppendRow: jest.Mock;
  let mockAuthenticate: jest.Mock;

  beforeEach(() => {
    capturedAppendRowArg = null;

    // スプレッドシートの実際のヘッダー（日本語）
    // design.md より: A=ID, B=日付, C=入力者, D=共有場, E=項目, F=タイトル, G=内容, H=共有日
    const sheetHeaders = ['ID', '日付', '入力者', '共有場', '項目', 'タイトル', '内容', '共有日'];

    mockGetHeaders = jest.fn().mockResolvedValue(sheetHeaders);
    mockAppendRow = jest.fn().mockImplementation(async (row: SheetRow) => {
      // appendRow に渡された引数を記録する
      capturedAppendRowArg = row;
    });
    mockAuthenticate = jest.fn().mockResolvedValue(undefined);

    // GoogleSheetsClient のインスタンスメソッドをモック
    MockedGoogleSheetsClient.prototype.authenticate = mockAuthenticate;
    MockedGoogleSheetsClient.prototype.getHeaders = mockGetHeaders;
    MockedGoogleSheetsClient.prototype.appendRow = mockAppendRow;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * テスト1: 全フィールドを含む SharedItem を create() で保存したとき、
   * appendRow に渡されるオブジェクトのキー名がスプレッドシートのヘッダーと一致することを確認する。
   *
   * 未修正コードでは:
   * - フロントエンドが英語キー（sharing_location, title など）で送信している場合、
   *   objectToRow() でマッピングが失敗し、H列（共有日）以外が空文字になる
   *
   * このテストは「全フィールドが正しく書き込まれること」をアサートするため、
   * 未修正コードでは失敗するはず。
   */
  test('全フィールドを含む SharedItem を create() で保存したとき、objectToRow の出力でH列（共有日）以外も空文字にならない', async () => {
    const service = new SharedItemsService();
    await service.initialize();

    // フロントエンドから送信されるデータ（英語キー）
    // SharedItem インターフェースのフィールドを使用
    const itemWithEnglishKeys = {
      id: '212',
      sharing_location: '朝礼',  // D列「共有場」に対応するはずだが、キーが '共有場' でないと空になる
      sharing_date: '2026/04/01',  // H列「共有日」に対応するはずだが、キーが '共有日' でないと空になる
      title: '朝礼共有テスト',  // F列「タイトル」に対応するはずだが、キーが 'タイトル' でないと空になる
      content: 'テスト内容',  // G列「内容」に対応するはずだが、キーが '内容' でないと空になる
      input_person: '山田',  // C列「入力者」に対応するはずだが、キーが '入力者' でないと空になる
      category: '契約関係',  // E列「項目」に対応するはずだが、キーが '項目' でないと空になる
    };

    await service.create(itemWithEnglishKeys);

    // appendRow に渡された引数を確認
    expect(capturedAppendRowArg).not.toBeNull();

    // objectToRow の内部動作をシミュレートして確認
    // ヘッダー: ['ID', '日付', '入力者', '共有場', '項目', 'タイトル', '内容', '共有日']
    // objectToRow は headers.map(header => obj[header] ?? '') でマッピングする
    const headers = ['ID', '日付', '入力者', '共有場', '項目', 'タイトル', '内容', '共有日'];
    const row = headers.map(header => (capturedAppendRowArg as SheetRow)[header] ?? '');

    console.log('objectToRow の出力:', row);
    console.log('ヘッダー:', headers);
    console.log('appendRow に渡されたオブジェクト:', capturedAppendRowArg);

    // 期待される動作（修正後）: 全フィールドが正しく書き込まれる
    // インデックス0: ID
    expect(row[0]).not.toBe('');  // ID が空でないこと
    // インデックス1: 日付
    // インデックス2: 入力者
    expect(row[2]).not.toBe('');  // 入力者 が空でないこと
    // インデックス3: 共有場
    expect(row[3]).not.toBe('');  // 共有場 が空でないこと
    // インデックス4: 項目
    expect(row[4]).not.toBe('');  // 項目 が空でないこと
    // インデックス5: タイトル
    expect(row[5]).not.toBe('');  // タイトル が空でないこと
    // インデックス6: 内容
    expect(row[6]).not.toBe('');  // 内容 が空でないこと
    // インデックス7: 共有日（H列）
    expect(row[7]).not.toBe('');  // 共有日 が空でないこと
  });

  /**
   * テスト2: isBugCondition の検証
   * フロントエンドが英語キーで送信した場合、スプレッドシートのヘッダーと一致するキーが少ない
   *
   * design.md の Bug Condition:
   * matchedKeys.size() < headersFromSheet.size() かつ matchedKeys.size() > 0
   */
  test('英語キーで送信した場合、スプレッドシートのヘッダーと一致するキーが全ヘッダー数より少ない（バグ条件）', async () => {
    const service = new SharedItemsService();
    await service.initialize();

    // フロントエンドから送信されるデータ（英語キー）
    const itemWithEnglishKeys = {
      id: '212',
      date: '2026/04/01',
      sharing_location: '朝礼',
      sharing_date: '2026/04/01',
      title: '朝礼共有テスト',
      content: 'テスト内容',
      input_person: '山田',
      category: '契約関係',
    };

    await service.create(itemWithEnglishKeys);

    const headers = ['ID', '日付', '入力者', '共有場', '項目', 'タイトル', '内容', '共有日'];
    const inputKeys = Object.keys(capturedAppendRowArg as SheetRow);
    const matchedKeys = inputKeys.filter(key => headers.includes(key));

    console.log('スプレッドシートのヘッダー:', headers);
    console.log('送信されたキー:', inputKeys);
    console.log('一致したキー:', matchedKeys);
    console.log('一致率:', `${matchedKeys.length}/${headers.length}`);

    // 期待される動作（修正後）: 全ヘッダーに対応するキーが存在する
    // 未修正コードでは: matchedKeys.length < headers.length（バグ条件）
    expect(matchedKeys.length).toBe(headers.length);
  });

  /**
   * テスト3: 日本語キーで送信した場合は正しくマッピングされることを確認
   * （これが正しい動作のベースライン）
   */
  test('日本語キーで送信した場合、objectToRow の出力で全フィールドが正しくマッピングされる', async () => {
    const service = new SharedItemsService();
    await service.initialize();

    // 日本語キーで送信（スプレッドシートのヘッダーと一致）
    const itemWithJapaneseKeys = {
      'ID': '212',
      '日付': '2026/04/01',
      '入力者': '山田',
      '共有場': '朝礼',
      '項目': '契約関係',
      'タイトル': '朝礼共有テスト',
      '内容': 'テスト内容',
      '共有日': '2026/04/01',
    };

    await service.create(itemWithJapaneseKeys);

    const headers = ['ID', '日付', '入力者', '共有場', '項目', 'タイトル', '内容', '共有日'];
    const row = headers.map(header => (capturedAppendRowArg as SheetRow)[header] ?? '');

    console.log('日本語キーの場合の objectToRow 出力:', row);

    // 日本語キーの場合は全フィールドが正しくマッピングされる
    expect(row[0]).toBe('212');    // ID
    expect(row[2]).toBe('山田');   // 入力者
    expect(row[3]).toBe('朝礼');   // 共有場
    expect(row[4]).toBe('契約関係'); // 項目
    expect(row[5]).toBe('朝礼共有テスト'); // タイトル
    expect(row[6]).toBe('テスト内容'); // 内容
    expect(row[7]).toBe('2026/04/01'); // 共有日（H列）
  });

  /**
   * テスト4: 混在キー（一部英語、一部日本語）で送信した場合でも、
   * normalizeKeys() により全フィールドが正しくマッピングされることを確認（修正後の正しい動作）
   */
  test('混在キー（一部英語、一部日本語）で送信した場合でも、normalizeKeys() により全フィールドが正しくマッピングされる', async () => {
    const service = new SharedItemsService();
    await service.initialize();

    // フロントエンドが '共有日' だけ日本語キーで送信し、他は英語キーの場合
    const itemMixedKeys = {
      id: '212',
      sharing_location: '朝礼',  // 英語キー → normalizeKeys() で '共有場' に変換される
      '共有日': '2026/04/01',    // 日本語キー → そのまま '共有日' として使用される
      title: '朝礼共有テスト',   // 英語キー → normalizeKeys() で 'タイトル' に変換される
      content: 'テスト内容',     // 英語キー → normalizeKeys() で '内容' に変換される
    };

    await service.create(itemMixedKeys);

    const headers = ['ID', '日付', '入力者', '共有場', '項目', 'タイトル', '内容', '共有日'];
    const row = headers.map(header => (capturedAppendRowArg as SheetRow)[header] ?? '');

    console.log('混在キーの場合の objectToRow 出力:', row);
    console.log('H列（共有日）の値:', row[7]);

    // 修正後の正しい動作: normalizeKeys() により全フィールドが正しくマッピングされる
    expect(row[0]).toBe('212');          // ID が正しく書き込まれる
    expect(row[3]).toBe('朝礼');         // 共有場 が正しく書き込まれる（英語キー → 日本語キー変換）
    expect(row[5]).toBe('朝礼共有テスト'); // タイトル が正しく書き込まれる（英語キー → 日本語キー変換）
    expect(row[6]).toBe('テスト内容');   // 内容 が正しく書き込まれる（英語キー → 日本語キー変換）
    expect(row[7]).toBe('2026/04/01');   // H列（共有日）は書き込まれる（日本語キーのまま）
  });
});

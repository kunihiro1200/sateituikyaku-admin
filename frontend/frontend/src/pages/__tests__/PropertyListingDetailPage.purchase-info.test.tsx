/**
 * PropertyListingDetailPage 買付情報セクション編集機能テスト
 *
 * このテストはソースコードを静的解析（テキスト解析）して、
 * 買付情報セクションの編集機能が正しく実装されていることを確認します。
 *
 * - テスト1.1: 非編集モードで編集ボタンが表示されること（要件 1.1）
 * - テスト1.2: 編集ボタンクリック後に全フィールドが入力コントロールに切り替わること（要件 1.2）
 * - テスト1.3: 編集モードで保存・キャンセルボタンが表示されること（要件 1.3）
 * - テスト1.4: キャンセルクリック後に編集モードが終了すること（要件 1.4）
 * - テスト3.2: 「買付」フィールドの選択肢が5択であること（要件 3.2）
 * - テスト4.2: 「状況」フィールドの選択肢が19択であること（要件 4.2）
 * - テスト8.1: 保存ボタンクリック時に PUT API が呼ばれること（要件 8.1）
 * - テスト8.2: 保存成功後にスナックバーが表示され編集モードが終了すること（要件 8.2）
 * - テスト8.3: 保存失敗時にエラースナックバーが表示され編集モードが維持されること（要件 8.3）
 * - テスト8.4: editedData が空の場合に保存処理がスキップされること（要件 8.4）
 * - テスト9.2: 全フィールドが空の場合に各フィールドに「-」が表示されること（要件 9.2）
 */
import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// 対象ファイルのパス
const TARGET_FILE = path.resolve(
  __dirname,
  '../PropertyListingDetailPage.tsx'
);

// ファイル内容を読み込む
function readTargetFile(): string {
  return fs.readFileSync(TARGET_FILE, 'utf-8');
}

// handleSaveOffer 関数のセクションを抽出するヘルパー
function extractHandleSaveOffer(source: string): string {
  const startIdx = source.indexOf('const handleSaveOffer = async');
  if (startIdx === -1) return '';
  const nextHandlerIdx = source.indexOf('const handle', startIdx + 1);
  return source.substring(
    startIdx,
    nextHandlerIdx > -1 ? nextHandlerIdx : startIdx + 1000
  );
}

// handleCancelOffer 関数のセクションを抽出するヘルパー
function extractHandleCancelOffer(source: string): string {
  const startIdx = source.indexOf('const handleCancelOffer = ');
  if (startIdx === -1) return '';
  const nextHandlerIdx = source.indexOf('const handle', startIdx + 1);
  return source.substring(
    startIdx,
    nextHandlerIdx > -1 ? nextHandlerIdx : startIdx + 300
  );
}

// 買付情報セクションのJSXを抽出するヘルパー
// コメント「7. 買付情報」から「8. 添付画像・資料」までを抽出する
function extractOfferSection(source: string): string {
  // コメント「7. 買付情報」を探す
  const sectionIdx = source.indexOf('7. 買付情報');
  if (sectionIdx === -1) {
    // フォールバック: EditableSection title="買付情報" の位置を探す
    const editableSectionIdx = source.indexOf('title="買付情報"');
    if (editableSectionIdx === -1) return '';
    // 前後5000文字を返す
    return source.substring(editableSectionIdx - 100, editableSectionIdx + 5000);
  }
  // 次のセクション「8. 添付画像・資料」まで
  const nextSectionIdx = source.indexOf('8. 添付画像・資料', sectionIdx);
  return source.substring(
    sectionIdx,
    nextSectionIdx > -1 ? nextSectionIdx : sectionIdx + 5000
  );
}

// 買付情報セクション内の状況フィールドのSelectブロックを抽出するヘルパー
function extractStatusSelectInOfferSection(source: string): string {
  const offerSection = extractOfferSection(source);
  // 状況フィールドの Select ブロックを抽出（isOfferEditMode の後の状況フィールド）
  const statusIdx = offerSection.indexOf('isOfferEditMode ? (\n                    <FormControl fullWidth size="small">\n                      <Select\n                        value={editedData.status');
  if (statusIdx === -1) {
    // フォールバック: offer_status の Select の後にある status の Select を探す
    const offerStatusEnd = offerSection.indexOf('</Select>', offerSection.indexOf('offer_status'));
    if (offerStatusEnd === -1) return '';
    const statusStart = offerSection.indexOf('editedData.status', offerStatusEnd);
    if (statusStart === -1) return '';
    const selectEnd = offerSection.indexOf('</Select>', statusStart);
    return offerSection.substring(statusStart, selectEnd + 9);
  }
  const selectEnd = offerSection.indexOf('</Select>', statusIdx);
  return offerSection.substring(statusIdx, selectEnd + 9);
}

// -----------------------------------------------------------------------
// テスト1.1: 非編集モードで編集ボタンが表示されること（要件 1.1）
// -----------------------------------------------------------------------
describe('テスト1.1: 非編集モードで編集ボタンが表示されること（要件 1.1）', () => {
  test('isOfferEditMode state が定義されていること', () => {
    const source = readTargetFile();
    expect(source).toContain('const [isOfferEditMode, setIsOfferEditMode] = useState(false)');
  });

  test('買付情報セクションが EditableSection コンポーネントでラップされていること', () => {
    const source = readTargetFile();
    // EditableSection に title="買付情報" が設定されていること
    expect(source).toContain('title="買付情報"');
  });

  test('EditableSection に isEditMode={isOfferEditMode} が設定されていること', () => {
    const source = readTargetFile();
    expect(source).toContain('isEditMode={isOfferEditMode}');
  });

  test('EditableSection に onEditToggle が設定されていること', () => {
    const source = readTargetFile();
    // onEditToggle で isOfferEditMode を true に設定すること
    expect(source).toContain('onEditToggle={() => setIsOfferEditMode(true)}');
  });
});

// -----------------------------------------------------------------------
// テスト1.2: 編集ボタンクリック後に全フィールドが入力コントロールに切り替わること（要件 1.2）
// -----------------------------------------------------------------------
describe('テスト1.2: 編集ボタンクリック後に全フィールドが入力コントロールに切り替わること（要件 1.2）', () => {
  test('買付日フィールドが isOfferEditMode で切り替わること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    // isOfferEditMode が true の場合に TextField が表示されること
    expect(offerSection).toContain('isOfferEditMode');
    expect(offerSection).toContain('offer_date');
    expect(offerSection).toContain('type="date"');
  });

  test('買付フィールドが isOfferEditMode で切り替わること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    expect(offerSection).toContain('offer_status');
    // Select コンポーネントが存在すること
    expect(offerSection).toContain('<Select');
  });

  test('状況フィールドが isOfferEditMode で切り替わること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    // status フィールドの Select が存在すること
    expect(offerSection).toContain("editedData.status");
  });

  test('金額フィールドが isOfferEditMode で切り替わること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    expect(offerSection).toContain('offer_amount');
    expect(offerSection).toContain('TextField');
  });

  test('会社名フィールドが isOfferEditMode で切り替わること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    expect(offerSection).toContain('company_name');
  });

  test('買付コメントフィールドが isOfferEditMode で切り替わること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    expect(offerSection).toContain('offer_comment');
    // multiline TextField が存在すること
    expect(offerSection).toContain('multiline');
  });
});

// -----------------------------------------------------------------------
// テスト1.3: 編集モードで保存・キャンセルボタンが表示されること（要件 1.3）
// -----------------------------------------------------------------------
describe('テスト1.3: 編集モードで保存・キャンセルボタンが表示されること（要件 1.3）', () => {
  test('EditableSection に onSave={handleSaveOffer} が設定されていること', () => {
    const source = readTargetFile();
    expect(source).toContain('onSave={handleSaveOffer}');
  });

  test('EditableSection に onCancel={handleCancelOffer} が設定されていること', () => {
    const source = readTargetFile();
    expect(source).toContain('onCancel={handleCancelOffer}');
  });

  test('handleSaveOffer 関数が定義されていること', () => {
    const source = readTargetFile();
    expect(source).toMatch(/const handleSaveOffer\s*=\s*async/);
  });

  test('handleCancelOffer 関数が定義されていること', () => {
    const source = readTargetFile();
    expect(source).toMatch(/const handleCancelOffer\s*=/);
  });
});

// -----------------------------------------------------------------------
// テスト1.4: キャンセルクリック後に編集モードが終了すること（要件 1.4）
// -----------------------------------------------------------------------
describe('テスト1.4: キャンセルクリック後に編集モードが終了すること（要件 1.4）', () => {
  test('handleCancelOffer 内で setIsOfferEditMode(false) が呼ばれること', () => {
    const source = readTargetFile();
    const cancelFn = extractHandleCancelOffer(source);
    expect(cancelFn).not.toBe('');
    expect(cancelFn).toContain('setIsOfferEditMode(false)');
  });

  test('handleCancelOffer 内で setEditedData({}) が呼ばれること', () => {
    const source = readTargetFile();
    const cancelFn = extractHandleCancelOffer(source);
    expect(cancelFn).toContain('setEditedData({})');
  });
});

// -----------------------------------------------------------------------
// テスト3.2: 「買付」フィールドの選択肢が5択であること（要件 3.2）
// -----------------------------------------------------------------------
describe('テスト3.2: 「買付」フィールドの選択肢が5択であること（要件 3.2）', () => {
  test('「一般片手」の選択肢が存在すること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    expect(offerSection).toContain('value="一般片手"');
  });

  test('「専任片手」の選択肢が存在すること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    expect(offerSection).toContain('value="専任片手"');
  });

  test('「専任両手」の選択肢が存在すること（買付フィールド）', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    expect(offerSection).toContain('value="専任両手"');
  });

  test('「一般両手」の選択肢が存在すること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    expect(offerSection).toContain('value="一般両手"');
  });

  test('「一般他決」の選択肢が存在すること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    expect(offerSection).toContain('value="一般他決"');
  });

  test('offer_status の Select に5つの実値 MenuItem が存在すること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    // offer_status の Select ブロックを抽出
    const offerStatusIdx = offerSection.indexOf("editedData.offer_status !== undefined");
    expect(offerStatusIdx).toBeGreaterThan(-1);
    // offer_status の Select ブロック（次の Select 終了まで）
    const selectEnd = offerSection.indexOf('</Select>', offerStatusIdx);
    const offerStatusBlock = offerSection.substring(offerStatusIdx, selectEnd + 9);
    // 実値の MenuItem（空文字以外）の数を数える
    const menuItemMatches = offerStatusBlock.match(/value="[^"]+"/g) || [];
    // 空文字 value="" を除いた実値の数
    const nonEmptyValues = menuItemMatches.filter(v => v !== 'value=""');
    expect(nonEmptyValues).toHaveLength(5);
  });
});

// -----------------------------------------------------------------------
// テスト4.2: 「状況」フィールドの選択肢が19択であること（要件 4.2）
// -----------------------------------------------------------------------
describe('テスト4.2: 「状況」フィールドの選択肢が19択であること（要件 4.2）', () => {
  test('status の Select に19つの実値 MenuItem が存在すること', () => {
    const source = readTargetFile();
    const statusBlock = extractStatusSelectInOfferSection(source);
    expect(statusBlock).not.toBe('');
    // 実値の MenuItem（空文字以外）の数を数える
    const menuItemMatches = statusBlock.match(/value="[^"]+"/g) || [];
    const nonEmptyValues = menuItemMatches.filter(v => v !== 'value=""');
    expect(nonEmptyValues).toHaveLength(19);
  });

  test('「専任両手」の選択肢が状況フィールドに存在すること', () => {
    const source = readTargetFile();
    const statusBlock = extractStatusSelectInOfferSection(source);
    expect(statusBlock).toContain('value="専任両手"');
  });

  test('「売止め」の選択肢が状況フィールドに存在すること', () => {
    const source = readTargetFile();
    const statusBlock = extractStatusSelectInOfferSection(source);
    expect(statusBlock).toContain('value="売止め"');
  });

  test('「専任→一般媒介」の選択肢が状況フィールドに存在すること', () => {
    const source = readTargetFile();
    const statusBlock = extractStatusSelectInOfferSection(source);
    expect(statusBlock).toContain('value="専任→一般媒介"');
  });
});

// -----------------------------------------------------------------------
// テスト8.1: 保存ボタンクリック時に PUT API が呼ばれること（要件 8.1）
// -----------------------------------------------------------------------
describe('テスト8.1: 保存ボタンクリック時に PUT API が呼ばれること（要件 8.1）', () => {
  test('handleSaveOffer 内に api.put の呼び出しが存在すること', () => {
    const source = readTargetFile();
    const saveFn = extractHandleSaveOffer(source);
    expect(saveFn).not.toBe('');
    expect(saveFn).toContain('api.put');
  });

  test('api.put の URL に /api/property-listings/ が含まれること', () => {
    const source = readTargetFile();
    const saveFn = extractHandleSaveOffer(source);
    expect(saveFn).toContain('/api/property-listings/');
  });

  test('api.put に propertyNumber が含まれること', () => {
    const source = readTargetFile();
    const saveFn = extractHandleSaveOffer(source);
    expect(saveFn).toContain('propertyNumber');
  });

  test('api.put に editedData が渡されること', () => {
    const source = readTargetFile();
    const saveFn = extractHandleSaveOffer(source);
    expect(saveFn).toContain('editedData');
  });
});

// -----------------------------------------------------------------------
// テスト8.2: 保存成功後にスナックバーが表示され編集モードが終了すること（要件 8.2）
// -----------------------------------------------------------------------
describe('テスト8.2: 保存成功後にスナックバーが表示され編集モードが終了すること（要件 8.2）', () => {
  test('handleSaveOffer 内に成功時のスナックバーメッセージが存在すること', () => {
    const source = readTargetFile();
    const saveFn = extractHandleSaveOffer(source);
    expect(saveFn).toContain('買付情報を保存しました');
  });

  test('handleSaveOffer 内に severity: success が設定されていること', () => {
    const source = readTargetFile();
    const saveFn = extractHandleSaveOffer(source);
    expect(saveFn).toContain("severity: 'success'");
  });

  test('handleSaveOffer 内で setIsOfferEditMode(false) が呼ばれること', () => {
    const source = readTargetFile();
    const saveFn = extractHandleSaveOffer(source);
    expect(saveFn).toContain('setIsOfferEditMode(false)');
  });

  test('handleSaveOffer 内で fetchPropertyData が呼ばれること', () => {
    const source = readTargetFile();
    const saveFn = extractHandleSaveOffer(source);
    expect(saveFn).toContain('fetchPropertyData()');
  });

  test('handleSaveOffer 内で setEditedData({}) が呼ばれること', () => {
    const source = readTargetFile();
    const saveFn = extractHandleSaveOffer(source);
    expect(saveFn).toContain('setEditedData({})');
  });
});

// -----------------------------------------------------------------------
// テスト8.3: 保存失敗時にエラースナックバーが表示され編集モードが維持されること（要件 8.3）
// -----------------------------------------------------------------------
describe('テスト8.3: 保存失敗時にエラースナックバーが表示され編集モードが維持されること（要件 8.3）', () => {
  test('handleSaveOffer 内に catch ブロックが存在すること', () => {
    const source = readTargetFile();
    const saveFn = extractHandleSaveOffer(source);
    expect(saveFn).toContain('catch');
  });

  test('handleSaveOffer の catch ブロック内にエラースナックバーが存在すること', () => {
    const source = readTargetFile();
    const saveFn = extractHandleSaveOffer(source);
    expect(saveFn).toContain('保存に失敗しました');
  });

  test('handleSaveOffer の catch ブロック内に severity: error が設定されていること', () => {
    const source = readTargetFile();
    const saveFn = extractHandleSaveOffer(source);
    expect(saveFn).toContain("severity: 'error'");
  });

  test('handleSaveOffer の catch ブロック内で setIsOfferEditMode(false) が呼ばれないこと（編集モード維持）', () => {
    const source = readTargetFile();
    const saveFn = extractHandleSaveOffer(source);
    // catch ブロックを抽出
    const catchIdx = saveFn.indexOf('catch');
    const catchBlock = saveFn.substring(catchIdx);
    // catch ブロック内では setIsOfferEditMode(false) が呼ばれないこと
    expect(catchBlock).not.toContain('setIsOfferEditMode(false)');
  });
});

// -----------------------------------------------------------------------
// テスト8.4: editedData が空の場合に保存処理がスキップされること（要件 8.4）
// -----------------------------------------------------------------------
describe('テスト8.4: editedData が空の場合に保存処理がスキップされること（要件 8.4）', () => {
  test('handleSaveOffer 内に editedData の空チェックが存在すること', () => {
    const source = readTargetFile();
    const saveFn = extractHandleSaveOffer(source);
    expect(saveFn).toContain('Object.keys(editedData).length === 0');
  });

  test('handleSaveOffer 内に早期 return が存在すること', () => {
    const source = readTargetFile();
    const saveFn = extractHandleSaveOffer(source);
    // 空チェックの後に return があること
    const guardMatch = saveFn.match(/Object\.keys\(editedData\)\.length\s*===\s*0.*?return/s);
    expect(guardMatch).not.toBeNull();
  });

  test('handleSaveOffer 内に propertyNumber のガード処理が存在すること', () => {
    const source = readTargetFile();
    const saveFn = extractHandleSaveOffer(source);
    expect(saveFn).toContain('!propertyNumber');
  });
});

// -----------------------------------------------------------------------
// テスト9.2: 全フィールドが空の場合に各フィールドに「-」が表示されること（要件 9.2）
// -----------------------------------------------------------------------
describe('テスト9.2: 全フィールドが空の場合に各フィールドに「-」が表示されること（要件 9.2）', () => {
  test('買付日フィールドが空の場合に「-」が表示されること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    // offer_date が空の場合に「-」を表示すること
    expect(offerSection).toMatch(/offer_date.*?\|\|.*?'-'/s);
  });

  test('買付フィールドが空の場合に「-」が表示されること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    expect(offerSection).toMatch(/offer_status.*?\|\|.*?'-'/s);
  });

  test('状況フィールドが空の場合に「-」が表示されること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    // status フィールドの表示部分
    expect(offerSection).toMatch(/data\.status.*?\|\|.*?'-'/s);
  });

  test('金額フィールドが空の場合に「-」が表示されること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    expect(offerSection).toMatch(/offer_amount.*?\|\|.*?'-'/s);
  });

  test('会社名フィールドが空の場合に「-」が表示されること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    expect(offerSection).toMatch(/company_name.*?\|\|.*?'-'/s);
  });

  test('買付コメントフィールドが空の場合に「-」が表示されること', () => {
    const source = readTargetFile();
    const offerSection = extractOfferSection(source);
    expect(offerSection).toMatch(/offer_comment.*?\|\|.*?'-'/s);
  });
});

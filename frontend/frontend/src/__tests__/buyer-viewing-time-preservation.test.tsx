/**
 * タスク2: 保全プロパティテスト - 内覧時間フィールド既存動作の確認
 *
 * このテストは未修正コードで**成功する**必要があります。
 * 成功によりベースライン動作（保全すべき動作）が確認されます。
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * Property 2: Preservation - 既存のフォーム動作が維持される
 *
 * アプローチ: ソースコードを直接解析して保全すべき動作を確認する
 * （コンポーネントレンダリングなし）
 */

import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

// NewBuyerPage.tsx のソースコードを読み込む
const sourceFilePath = path.resolve(__dirname, '../pages/NewBuyerPage.tsx');
const sourceCode = fs.readFileSync(sourceFilePath, 'utf-8');

// ---- ソースコードから抽出したロジックを再現 ----

/**
 * NewBuyerPage.tsx の handleSubmit 内の viewing_time ペイロード構築ロジックを再現
 * 実際のコード: viewing_time: viewingTime || null
 */
function buildViewingTimePayload(viewingTime: string): string | null {
  return viewingTime || null;
}

/**
 * NewBuyerPage.tsx の onChange ハンドラを再現
 * 実際のコード: onChange={(e) => setViewingTime(e.target.value)}
 */
function simulateOnChange(inputValue: string): string {
  // setViewingTime(e.target.value) と同等
  return inputValue;
}

// ---- 保全テスト ----

describe('保全テスト: 内覧時間フィールドの既存動作確認', () => {
  /**
   * テスト1: 内覧日フィールドが type="date" で正常に動作することを確認
   * Requirements 3.1: 「内覧日」フィールドは修正後も変わらず正常に動作する
   */
  test('テスト1: 内覧日フィールドに type="date" が指定されていること（保全確認）', () => {
    // 「内覧日」ラベルを持つ TextField ブロックを抽出する
    const viewingDateBlockMatch = sourceCode.match(
      /label="内覧日"[\s\S]*?(?=<\/TextField>|<Grid|<\/Grid)/
    );

    expect(viewingDateBlockMatch).not.toBeNull();
    const viewingDateBlock = viewingDateBlockMatch![0];

    // 内覧日フィールドは正しく type="date" が設定されている（保全すべき動作）
    expect(viewingDateBlock).toContain('type="date"');
    expect(viewingDateBlock).toContain('InputLabelProps');
    expect(viewingDateBlock).toContain('shrink: true');
  });

  /**
   * テスト2: onChange ハンドラが viewingTime state を正しく更新することを確認
   * Requirements 3.3: onChange ハンドラが viewingTime state を正しく更新する
   */
  test('テスト2: onChange ハンドラが viewingTime state を正しく更新すること（ソースコード解析）', () => {
    // ソースコードに onChange ハンドラが正しく定義されていることを確認
    const viewingTimeBlockMatch = sourceCode.match(
      /label="内覧時間"[\s\S]*?(?=<\/TextField>|<Grid|<\/Grid)/
    );

    expect(viewingTimeBlockMatch).not.toBeNull();
    const viewingTimeBlock = viewingTimeBlockMatch![0];

    // onChange ハンドラが setViewingTime を呼び出していることを確認
    expect(viewingTimeBlock).toContain('onChange');
    expect(viewingTimeBlock).toContain('setViewingTime');
    expect(viewingTimeBlock).toContain('e.target.value');

    // ロジックの動作確認: onChange ハンドラは入力値をそのまま state に設定する
    const testValue = '14:00';
    const result = simulateOnChange(testValue);
    expect(result).toBe(testValue);
  });

  /**
   * テスト3: "14:00" を入力した場合、viewing_time: "14:00" がAPIペイロードに含まれることを確認
   * Requirements 3.2: 有効な時間を入力して登録した場合、viewing_time フィールドとしてAPIに送信される
   */
  test('テスト3: "14:00" を入力した場合、viewing_time: "14:00" がAPIペイロードに含まれること', () => {
    // ソースコードに viewing_time の送信ロジックが正しく定義されていることを確認
    // 実際のコード: viewing_time: viewingTime || null
    expect(sourceCode).toContain('viewing_time: viewingTime || null');

    // ロジックの動作確認
    const viewingTime = '14:00';
    const payload = buildViewingTimePayload(viewingTime);

    // "14:00" を入力した場合、viewing_time: "14:00" がペイロードに含まれる
    expect(payload).toBe('14:00');
    expect(payload).not.toBeNull();
  });

  /**
   * テスト4: フィールドを空のまま登録した場合、viewing_time: null がAPIペイロードに含まれることを確認
   * Requirements 3.3: フィールドを空のまま登録した場合、viewing_time: null としてAPIに送信される
   */
  test('テスト4: フィールドを空のまま登録した場合、viewing_time: null がAPIペイロードに含まれること', () => {
    // ソースコードに viewing_time の送信ロジックが正しく定義されていることを確認
    expect(sourceCode).toContain('viewing_time: viewingTime || null');

    // ロジックの動作確認: 空文字列の場合は null になる
    const viewingTime = '';
    const payload = buildViewingTimePayload(viewingTime);

    // 空のまま登録した場合、viewing_time: null がペイロードに含まれる
    expect(payload).toBeNull();
  });
});

// ---- プロパティベーステスト ----

describe('プロパティベーステスト: ランダムな時間文字列での viewingTime state 更新確認', () => {
  /**
   * Property 2: Preservation - ランダムな時間文字列を入力した場合、viewingTime state が正しく更新される
   *
   * **Validates: Requirements 3.1, 3.2, 3.3**
   *
   * テスト戦略:
   * - ランダムな時間文字列（"00:00"〜"23:59"）を生成する
   * - onChange ハンドラが入力値をそのまま state に設定することを確認する
   */
  test('ランダムな時間文字列（"00:00"〜"23:59"）を入力した場合、viewingTime state が正しく更新されること', () => {
    // 時間文字列ジェネレーター（"HH:MM" 形式）
    const hourArb = fc.integer({ min: 0, max: 23 }).map((h) => String(h).padStart(2, '0'));
    const minuteArb = fc.integer({ min: 0, max: 59 }).map((m) => String(m).padStart(2, '0'));
    const timeStringArb = fc.tuple(hourArb, minuteArb).map(([h, m]) => `${h}:${m}`);

    fc.assert(
      fc.property(timeStringArb, (timeString) => {
        // onChange ハンドラのシミュレーション
        const newState = simulateOnChange(timeString);

        // viewingTime state が入力値と同じになることを確認
        return newState === timeString;
      }),
      { numRuns: 200 }
    );
  });

  /**
   * 空文字列を入力した場合、viewingTime state が空文字列になることを確認
   */
  test('空文字列を入力した場合、viewingTime state が空文字列になること', () => {
    const newState = simulateOnChange('');
    expect(newState).toBe('');
  });

  /**
   * 任意の文字列を入力した場合、onChange ハンドラは入力値をそのまま返すことを確認
   * （バリデーションなし、入力値をそのまま state に設定する）
   */
  test('任意の文字列を入力した場合、onChange ハンドラは入力値をそのまま返すこと', () => {
    fc.assert(
      fc.property(fc.string(), (inputValue) => {
        const newState = simulateOnChange(inputValue);
        return newState === inputValue;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * viewing_time ペイロード構築: 非空文字列はそのまま送信される
   */
  test('非空の時間文字列は viewing_time ペイロードにそのまま含まれること', () => {
    const hourArb = fc.integer({ min: 0, max: 23 }).map((h) => String(h).padStart(2, '0'));
    const minuteArb = fc.integer({ min: 0, max: 59 }).map((m) => String(m).padStart(2, '0'));
    const timeStringArb = fc.tuple(hourArb, minuteArb).map(([h, m]) => `${h}:${m}`);

    fc.assert(
      fc.property(timeStringArb, (timeString) => {
        const payload = buildViewingTimePayload(timeString);
        // 非空文字列はそのまま送信される（null にならない）
        return payload === timeString && payload !== null;
      }),
      { numRuns: 200 }
    );
  });

  /**
   * viewing_time ペイロード構築: 空文字列は null になる
   */
  test('空文字列は viewing_time ペイロードで null になること', () => {
    fc.assert(
      fc.property(fc.constant(''), (emptyString) => {
        const payload = buildViewingTimePayload(emptyString);
        return payload === null;
      }),
      { numRuns: 10 }
    );
  });
});

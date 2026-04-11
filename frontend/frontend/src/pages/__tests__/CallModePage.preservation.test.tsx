/**
 * CallModePage 保持確認テスト（Property 2: Preservation）
 *
 * このテストは「買主内覧カレンダー送信バグ修正後も、売主の訪問予約機能が壊れていないこと」を確認するためのものです。
 * ソースコードを静的解析（テキスト解析）する形式で実装しています。
 *
 * - テスト2.1: 売主の訪問予約カレンダー送信機能の保持（営担のカレンダーに送信される）
 * - テスト2.2: 訪問日・営担・訪問査定取得者の表示保持
 * - テスト2.3: カレンダー送信ボタンの表示条件保持
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 */
// vitestのグローバルAPI（vite.config.ts: globals: true）を使用するため、インポート不要
import * as fs from 'fs';
import * as path from 'path';

// 対象ファイルのパス
const TARGET_FILE = path.resolve(
  __dirname,
  '../CallModePage.tsx'
);

// ファイル内容を読み込む
function readTargetFile(): string {
  return fs.readFileSync(TARGET_FILE, 'utf-8');
}

// -----------------------------------------------------------------------
// タスク2.1: 売主の訪問予約カレンダー送信機能の保持
// 営担のメールアドレスを取得して&srcパラメータで指定し、営担のカレンダーに予定を送信する
// -----------------------------------------------------------------------
describe('保持確認テスト2.1: 売主の訪問予約カレンダー送信機能の保持（営担のカレンダーに送信される）', () => {
  test('カレンダー送信ボタンが存在すること', () => {
    const source = readTargetFile();

    // 「📅 カレンダーで開く」ボタンが存在すること
    expect(source).toContain('📅 カレンダーで開く');
    
    // onClickハンドラーも存在すること（簡易チェック）
    expect(source).toContain('onClick={() => {');
  });

  test('営担のメールアドレスを取得する処理が存在すること', () => {
    const source = readTargetFile();

    // 営担のメールアドレスを取得する処理が存在すること
    // visitAssigneeInitials, visitAssignee, assignedTo のいずれかから取得
    expect(source).toContain('visitAssigneeInitials');
    expect(source).toContain('visitAssignee');
    expect(source).toContain('assignedTo');
  });

  test('従業員マスタから営担を検索する処理が存在すること', () => {
    const source = readTargetFile();

    // employees.find() で営担を検索する処理が存在すること
    const findMatch = source.match(
      /employees\.find\(e\s*=>\s*[\s\S]*?(name|initials|email)[\s\S]*?\)/
    );
    expect(findMatch).not.toBeNull();
  });

  test('&srcパラメータをGoogleカレンダーURLに追加する処理が存在すること', () => {
    const source = readTargetFile();

    // &src= パラメータを追加する処理が存在すること
    expect(source).toContain('&src=');
    expect(source).toContain('srcParam');
  });

  test('営担のメールアドレスが存在する場合のみ&srcパラメータを追加すること', () => {
    const source = readTargetFile();

    // assignedEmail が存在する場合のみ srcParam を追加する条件分岐が存在すること
    const srcParamMatch = source.match(
      /const srcParam\s*=\s*assignedEmail\s*\?\s*`&src=\$\{encodeURIComponent\(assignedEmail\)\}`\s*:\s*''/
    );
    expect(srcParamMatch).not.toBeNull();
  });

  test('GoogleカレンダーURLに&srcパラメータを連結すること', () => {
    const source = readTargetFile();

    // window.open() でGoogleカレンダーURLを開く際に srcParam を連結すること
    const windowOpenMatch = source.match(
      /window\.open\([\s\S]*?https:\/\/calendar\.google\.com\/calendar\/render\?[\s\S]*?\$\{srcParam\}/
    );
    expect(windowOpenMatch).not.toBeNull();
  });

  test('カレンダーイベントのタイトルに【訪問】が含まれること', () => {
    const source = readTargetFile();

    // タイトルに【訪問】が含まれること
    expect(source).toContain('【訪問】');
  });

  test('カレンダーイベントの詳細に売主情報が含まれること', () => {
    const source = readTargetFile();

    // 詳細に売主名、住所、電話番号が含まれること
    const detailsMatch = source.match(
      /売主名:[\s\S]*?住所:[\s\S]*?電話:/
    );
    expect(detailsMatch).not.toBeNull();
  });

  test('カレンダーイベントの詳細にGoogle MapのURLが含まれること', () => {
    const source = readTargetFile();

    // 詳細にGoogle MapのURLが含まれること
    expect(source).toContain('Google Map:');
    expect(source).toContain('googleMapUrl');
  });

  test('カレンダーイベントの詳細に通話モードページのURLが含まれること', () => {
    const source = readTargetFile();

    // 詳細に通話モードページのURLが含まれること
    expect(source).toContain('通話モードページ:');
    expect(source).toContain('callModeUrl');
  });
});

// -----------------------------------------------------------------------
// タスク2.2: 訪問日・営担・訪問査定取得者の表示保持
// 訪問予約セクションで訪問日・営担・訪問査定取得者が正しく表示されることを確認
// -----------------------------------------------------------------------
describe('保持確認テスト2.2: 訪問日・営担・訪問査定取得者の表示保持', () => {
  test('訪問予約セクションが存在すること', () => {
    const source = readTargetFile();

    // 訪問予約セクションのコメントが存在すること
    expect(source).toContain('訪問予約');
  });

  test('訪問日の表示が存在すること', () => {
    const source = readTargetFile();

    // visitDate または appointmentDate の表示が存在すること
    expect(source).toContain('visitDate');
    expect(source).toContain('appointmentDate');
  });

  test('営担の表示が存在すること', () => {
    const source = readTargetFile();

    // visitAssignee または visitAssigneeInitials の表示が存在すること
    const assigneeMatch = source.match(
      /営担[\s\S]{0,500}(visitAssignee|visitAssigneeInitials|assignedTo)/
    );
    expect(assigneeMatch).not.toBeNull();
  });

  test('訪問査定取得者の表示が存在すること', () => {
    const source = readTargetFile();

    // visitValuationAcquirer の表示が存在すること
    expect(source).toContain('visitValuationAcquirer');
  });

  test('訪問情報セクションの条件分岐が存在すること', () => {
    const source = readTargetFile();

    // 訪問日・営担・訪問査定取得者のいずれかが存在する場合に表示する条件分岐が存在すること
    const conditionMatch = source.match(
      /\(seller\?\.visitDate\s*\|\|\s*seller\?\.visitAssignee[\s\S]*?\)/
    );
    expect(conditionMatch).not.toBeNull();
  });

  test('訪問情報セクションにGridレイアウトが使用されていること', () => {
    const source = readTargetFile();

    // 訪問情報セクションでGridレイアウトが使用されていること
    const gridMatch = source.match(
      /訪問情報[\s\S]{0,1000}<Grid container/
    );
    expect(gridMatch).not.toBeNull();
  });
});

// -----------------------------------------------------------------------
// タスク2.3: カレンダー送信ボタンの表示条件保持
// 訪問日が設定されている場合にカレンダー送信ボタンが表示されることを確認
// -----------------------------------------------------------------------
describe('保持確認テスト2.3: カレンダー送信ボタンの表示条件保持', () => {
  test('カレンダー送信ボタンの表示条件が存在すること', () => {
    const source = readTargetFile();

    // カレンダー送信ボタンの表示条件が存在すること
    // visitDate または appointmentDate が存在する場合に表示
    const buttonConditionMatch = source.match(
      /\(seller\?\.visitDate \|\| seller\?\.appointmentDate\)/
    );
    expect(buttonConditionMatch).not.toBeNull();
  });

  test('訪問予約編集フォームが存在すること', () => {
    const source = readTargetFile();

    // 訪問予約編集フォームが存在すること
    expect(source).toContain('editingAppointment');
  });

  test('訪問予約編集フォームに訪問日フィールドが存在すること', () => {
    const source = readTargetFile();

    // 訪問予約編集フォームに訪問日フィールドが存在すること
    const dateFieldMatch = source.match(
      /editingAppointment[\s\S]{0,2000}editedAppointmentDate/
    );
    expect(dateFieldMatch).not.toBeNull();
  });

  test('訪問予約編集フォームに営担フィールドが存在すること', () => {
    const source = readTargetFile();

    // 訪問予約編集フォームに営担フィールドが存在すること
    const assigneeFieldMatch = source.match(
      /editingAppointment[\s\S]{0,2000}editedAssignedTo/
    );
    expect(assigneeFieldMatch).not.toBeNull();
  });

  test('訪問予約編集フォームに訪問査定取得者フィールドが存在すること', () => {
    const source = readTargetFile();

    // 訪問予約編集フォームに訪問査定取得者フィールドが存在すること
    const acquirerFieldMatch = source.match(
      /editingAppointment[\s\S]{0,2000}editedVisitValuationAcquirer/
    );
    expect(acquirerFieldMatch).not.toBeNull();
  });

  test('訪問予約保存ハンドラーが存在すること', () => {
    const source = readTargetFile();

    // 訪問予約保存ハンドラーが存在すること
    expect(source).toContain('handleSaveAppointment');
  });

  test('訪問予約削除機能が存在すること', () => {
    const source = readTargetFile();

    // 訪問日を削除した場合、営担と訪問査定取得者もクリアする処理が存在すること
    expect(source).toContain('訪問日を削除したため、営担と訪問査定取得者もクリアしました');
  });

  test('従業員マスタを取得する処理が存在すること', () => {
    const source = readTargetFile();

    // 従業員マスタを取得する処理が存在すること
    expect(source).toContain('employees');
    expect(source).toContain('setEmployees');
  });

  test('従業員マスタ取得APIが呼ばれていること', () => {
    const source = readTargetFile();

    // getActiveEmployees() が呼ばれていること
    const apiMatch = source.match(
      /getActiveEmployees\(\)/
    );
    expect(apiMatch).not.toBeNull();
  });
});


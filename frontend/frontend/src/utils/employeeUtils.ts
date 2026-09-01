import { Employee } from '../types';

/**
 * UUID形式を検出する正規表現
 * 例: 112cec78-171c-4012-a064-d508e72ba9d3
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Initialsコードから名前へのマッピング（後方互換性のため保持）
 */
const INITIALS_TO_NAME_MAP: Record<string, string> = {
  'U': '裏',
  'M': '河野',
  'Y': '山本',
  'W': '和田',
  'K': '国広',
};

/**
 * 姓名フル → 名字のマッピング
 *
 * ⚠️ employees.name は「国広智子」「裏天真」のようにスペース区切りが無い姓名フルで
 * 保存されているため、split(' ') では名字を切り出せない。
 * そのためスタッフの姓名フルを明示的にマッピングする。
 *
 * 注意: 退職済みスタッフも残しておくこと。
 * 退職後も過去の担当レコードは残るため、削除すると extractLastName が
 * フルネームをそのまま返してしまう（SMS本文にフルネームが出るバグが再発する）。
 *
 * 新しいスタッフが入社したらこのマップに追加すること。
 * （併せて .kiro/steering/ranking-initial-normalization-rules.md の在籍スタッフ一覧も更新）
 */
const FULL_NAME_TO_LAST_NAME_MAP: Record<string, string> = {
  '廣瀬尚美': '廣瀬',
  '角井宏充': '角井',
  '国広智子': '国広',
  '木村侑里音': '木村',
  '裏天真': '裏',
  '山本裕子': '山本',
  '久米マリ子': '久米',
  '和田樹奈': '和田',
  '林田元汰': '林田',
  '生野陸斗': '生野',  // 退職済み（過去データのSMS差出人名生成に必要なため残す）
  '麻生華蓮': '麻生',
};

/**
 * 姓名フルから名字だけを取り出す
 *
 * SMS/メール本文の差出人名（アカウント名）はフルネームではなく名字だけを表示する。
 * 例: 「国広智子」→「国広」、「裏天真」→「裏」、「和田　樹奈」→「和田」
 *
 * 判定順:
 * 1. 半角/全角スペースが含まれる場合 → スペースの前を名字とする
 * 2. FULL_NAME_TO_LAST_NAME_MAP に一致する場合 → マッピングの名字を返す
 * 3. どちらにも当てはまらない場合 → 入力をそのまま返す（既存挙動を壊さない）
 *
 * @param fullName - 姓名フル（例: 「国広智子」）
 * @returns 名字（例: 「国広」）。入力が空の場合は空文字列
 */
export function extractLastName(fullName: string | null | undefined): string {
  if (!fullName) return '';

  const trimmed = fullName.trim();
  if (trimmed.length === 0) return '';

  // 1. スペース区切り（半角・全角）がある場合は先頭要素が名字
  const spaceSeparated = trimmed.split(/[\s　]+/).filter(Boolean);
  if (spaceSeparated.length > 1) {
    return spaceSeparated[0];
  }

  // 2. スペース無しの姓名フルはマッピングで解決
  if (trimmed in FULL_NAME_TO_LAST_NAME_MAP) {
    return FULL_NAME_TO_LAST_NAME_MAP[trimmed];
  }

  // 3. 未知の値はそのまま返す（すでに名字だけの場合もここに来る）
  return trimmed;
}

/**
 * 文字列がUUID形式かどうかを判定
 * @param str - 判定する文字列
 * @returns UUID形式の場合true
 */
export function isUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

/**
 * 従業員識別子（UUIDまたはinitials）から従業員名を取得
 * 
 * 処理フロー:
 * 1. identifierが空の場合 → デフォルト値「担当者」を返す
 * 2. identifierがUUID形式の場合:
 *    - employeesリストから検索
 *    - 見つかった場合 → employee.nameを返す
 *    - 見つからない場合 → デフォルト値「担当者」を返す
 * 3. identifierがinitialsコードの場合:
 *    - 静的マッピングで変換
 *    - マッピングに存在する場合 → 名前を返す
 *    - マッピングに存在しない場合 → identifierをそのまま返す
 * 
 * @param identifier - 従業員のUUIDまたはinitialsコード
 * @param employees - 従業員リスト（オプション）
 * @returns 従業員名、見つからない場合は「担当者」
 */
export function getEmployeeName(
  identifier: string | undefined,
  employees?: Employee[]
): string {
  // 1. identifierが空の場合
  if (!identifier || identifier.trim().length === 0) {
    return '担当者';
  }

  const trimmedIdentifier = identifier.trim();

  // 2. UUID形式の場合
  if (isUUID(trimmedIdentifier)) {
    if (employees && employees.length > 0) {
      const employee = employees.find(emp => emp.id === trimmedIdentifier);
      if (employee) {
        return employee.name;
      }
    }
    // UUIDだが従業員が見つからない場合
    console.warn(`Employee not found for UUID: ${trimmedIdentifier}`);
    return '担当者';
  }

  // 3. initialsコードの場合
  if (trimmedIdentifier in INITIALS_TO_NAME_MAP) {
    return INITIALS_TO_NAME_MAP[trimmedIdentifier];
  }

  // マッピングに存在しない場合はそのまま返す
  return trimmedIdentifier;
}

/**
 * 従業員オブジェクトから表示名を取得
 * 暗号化されたような文字列や無効な名前を検出し、適切なフォールバックを提供
 * 
 * @param employee - 従業員オブジェクト（nullまたはundefinedも許容）
 * @returns 表示用の名前
 */
export function getDisplayName(employee: { name?: string; email?: string } | null | undefined): string {
  // 従業員オブジェクトがない場合
  if (!employee) {
    return '担当者';
  }

  // 名前が存在しない場合
  if (!employee.name || employee.name.trim().length === 0) {
    // メールアドレスから抽出を試みる
    if (employee.email) {
      return extractNameFromEmail(employee.email);
    }
    return '担当者';
  }

  const name = employee.name.trim();

  // 無効な名前パターンをチェック
  if (isInvalidName(name)) {
    console.warn(`Invalid employee name detected: "${name}" for ${employee.email}`);
    // メールアドレスから抽出
    if (employee.email) {
      return extractNameFromEmail(employee.email);
    }
    return '担当者';
  }

  return name;
}

/**
 * 名前が無効かどうかをチェック
 * @param name - チェックする名前
 * @returns 無効な場合true
 */
function isInvalidName(name: string): boolean {
  // "不明"をチェック
  if (name === '不明' || name === 'Unknown') {
    return true;
  }

  // 暗号化されたような文字列をチェック（Base64パターン）
  const base64Pattern = /^[A-Za-z0-9+/=]{20,}$/;
  if (base64Pattern.test(name)) {
    return true;
  }

  // メールアドレスそのものが名前になっている場合
  if (name.includes('@')) {
    return true;
  }

  return false;
}

/**
 * メールアドレスから名前を抽出してフォーマット
 * @param email - メールアドレス
 * @returns フォーマットされた名前
 */
function extractNameFromEmail(email: string): string {
  if (!email || email.trim().length === 0) {
    return '担当者';
  }

  // @の前の部分を取得
  const atIndex = email.indexOf('@');
  const prefix = atIndex > 0 ? email.substring(0, atIndex) : email;

  // ドットとアンダースコアをスペースに置換
  let formatted = prefix.replace(/[._]/g, ' ');

  // 各単語の最初の文字を大文字に
  formatted = formatted
    .split(' ')
    .map(word => {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ')
    .trim();

  // フォーマット結果が空の場合は元のプレフィックスを返す
  if (formatted.length === 0) {
    return prefix;
  }

  return formatted;
}

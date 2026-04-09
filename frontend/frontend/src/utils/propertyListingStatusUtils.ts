/**
 * atbb_statusに「非公開」が含まれるかチェック
 * @param atbbStatus - atbb_statusフィールドの値
 * @returns 「非公開」を含む場合true、それ以外false
 */
export function isPrivateStatus(atbbStatus: string | undefined): boolean {
  if (!atbbStatus || atbbStatus.trim() === '') {
    return false;
  }
  return atbbStatus.includes('非公開');
}

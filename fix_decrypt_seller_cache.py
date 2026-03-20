#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
decryptSeller 内の getEmployeeNameByInitials 呼び出しを最適化する
キャッシュを1回取得してから両方のイニシャルを解決する
"""

FILE_PATH = 'backend/src/services/SellerService.supabase.ts'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

# CRLF を LF に正規化してから処理
text = content.decode('utf-8').replace('\r\n', '\n')

OLD_DECRYPT = """  /**
   * 売主データを復号化
   */
  private async decryptSeller(seller: any): Promise<Seller> {
    const _dt0 = Date.now();
    try {
      // イニシャルをフルネームに変換（並列処理で高速化）
      const [visitAssigneeFullName, visitValuationAcquirerFullName] = await Promise.all([
        getEmployeeNameByInitials(seller.visit_assignee),
        getEmployeeNameByInitials(seller.visit_valuation_acquirer),
      ]);
      console.log(`[PERF] decryptSeller getEmployeeNames: ${Date.now() - _dt0}ms`);"""

NEW_DECRYPT = """  /**
   * 売主データを復号化
   */
  private async decryptSeller(seller: any): Promise<Seller> {
    const _dt0 = Date.now();
    try {
      // Redis キャッシュから従業員マップを1回取得してイニシャルを解決（最適化）
      // キャッシュミス時も refreshEmployeeCache は1回だけ呼ばれる
      let initialsMap = await CacheHelper.get<Record<string, string>>(EMPLOYEE_INITIALS_CACHE_KEY);
      if (!initialsMap) {
        await refreshEmployeeCache();
        initialsMap = await CacheHelper.get<Record<string, string>>(EMPLOYEE_INITIALS_CACHE_KEY);
      }
      const visitAssigneeFullName = seller.visit_assignee ? (initialsMap?.[seller.visit_assignee] || null) : null;
      const visitValuationAcquirerFullName = seller.visit_valuation_acquirer ? (initialsMap?.[seller.visit_valuation_acquirer] || null) : null;
      console.log(`[PERF] decryptSeller getEmployeeNames: ${Date.now() - _dt0}ms`);"""

if OLD_DECRYPT in text:
    text = text.replace(OLD_DECRYPT, NEW_DECRYPT)
    print("✅ decryptSeller の従業員名解決を最適化しました")
else:
    print("❌ 対象ブロックが見つかりませんでした")
    idx = text.find('decryptSeller')
    if idx >= 0:
        print(f"  'decryptSeller' は {idx} 付近に存在します")
        print(f"  前後のテキスト: {repr(text[idx:idx+300])}")

# CRLF を維持して書き込む
output = text.replace('\n', '\r\n').encode('utf-8')
with open(FILE_PATH, 'wb') as f:
    f.write(output)

print(f"✅ {FILE_PATH} を保存しました")

# BOM チェック
with open(FILE_PATH, 'rb') as f:
    first_bytes = f.read(3)
print(f"BOM チェック: {repr(first_bytes[:3])}")

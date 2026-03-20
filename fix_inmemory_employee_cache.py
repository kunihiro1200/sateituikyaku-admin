#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SellerService.supabase.ts のイニシャルキャッシュを Redis から
モジュールレベルのインメモリキャッシュに変更する。

問題:
- Vercel サーバーレスでは Redis 接続タイムアウト（2秒→500ms に短縮済み）が毎回発生
- Redis が使えない場合、MemoryStore はリクエスト間でキャッシュが消える
- 結果: decryptSeller が毎回 Supabase クエリを実行 → 遅い

解決:
- モジュールレベルの Map キャッシュ（プロセス内で持続）を使用
- Redis への非同期 await を排除 → decryptSeller が同期的に高速化
- キャッシュミス時のみ Supabase クエリ（非同期）を実行
"""

import os

file_path = 'backend/src/services/SellerService.supabase.ts'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')
text = text.replace('\r\n', '\n')

# 旧コード: Redis キャッシュを使ったイニシャル解決
old_cache_code = '''// Redis キャッシュキー（Vercel サーバーレス環境でもキャッシュが持続する）
const EMPLOYEE_INITIALS_CACHE_KEY = 'employees:initials-map';
const EMPLOYEE_INITIALS_CACHE_TTL = 5 * 60; // 5分（秒単位）

/**
 * スタッフのイニシャルからフルネームを取得（Redis キャッシュ使用）
 * Vercel サーバーレス環境ではインメモリキャッシュがコールドスタート時にリセットされるため
 * Redis キャッシュを使用してパフォーマンスを改善する
 */
async function getEmployeeNameByInitials(initials: string | null | undefined): Promise<string | null> {
  if (!initials) return null;

  // Redis キャッシュから全従業員マップを取得
  const cached = await CacheHelper.get<Record<string, string>>(EMPLOYEE_INITIALS_CACHE_KEY);
  if (cached) {
    return cached[initials] || null;
  }

  // キャッシュミス: Supabase から取得してキャッシュに保存
  await refreshEmployeeCache();

  // 再度キャッシュから取得
  const refreshed = await CacheHelper.get<Record<string, string>>(EMPLOYEE_INITIALS_CACHE_KEY);
  return refreshed?.[initials] || null;
}

/**
 * スタッフ情報のキャッシュを更新（Redis に保存）
 */
async function refreshEmployeeCache(): Promise<void> {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { data: employees, error } = await supabase
      .from('employees')
      .select('initials, name')
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch employees for initials mapping:', error);
      return;
    }

    const initialsMap: Record<string, string> = {};
    employees?.forEach((emp: any) => {
      if (emp.initials && emp.name) {
        initialsMap[emp.initials] = emp.name;
      }
    });

    await CacheHelper.set(EMPLOYEE_INITIALS_CACHE_KEY, initialsMap, EMPLOYEE_INITIALS_CACHE_TTL);
    console.log(`✅ Employee initials cache updated in Redis: ${Object.keys(initialsMap).length} employees`);
  } catch (error) {
    console.error('Error refreshing employee cache:', error);
  }
}'''

# 新コード: モジュールレベルのインメモリキャッシュ
new_cache_code = '''// モジュールレベルのインメモリキャッシュ（プロセス内で持続、Redis 不要）
// Vercel サーバーレスでは同一プロセス内のリクエスト間でキャッシュが共有される
let _employeeInitialsMap: Record<string, string> | null = null;
let _employeeInitialsCachedAt = 0;
const EMPLOYEE_INITIALS_CACHE_TTL_MS = 5 * 60 * 1000; // 5分
let _employeeInitialsRefreshing = false; // 重複リフレッシュ防止

/**
 * スタッフ情報のキャッシュを更新（モジュールレベルのインメモリキャッシュに保存）
 */
async function refreshEmployeeCache(): Promise<void> {
  if (_employeeInitialsRefreshing) return; // 重複リフレッシュ防止
  _employeeInitialsRefreshing = true;
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { data: employees, error } = await supabase
      .from('employees')
      .select('initials, name')
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch employees for initials mapping:', error);
      return;
    }

    const initialsMap: Record<string, string> = {};
    employees?.forEach((emp: any) => {
      if (emp.initials && emp.name) {
        initialsMap[emp.initials] = emp.name;
      }
    });

    _employeeInitialsMap = initialsMap;
    _employeeInitialsCachedAt = Date.now();
    console.log(`✅ Employee initials cache updated (in-memory): ${Object.keys(initialsMap).length} employees`);
  } catch (error) {
    console.error('Error refreshing employee cache:', error);
  } finally {
    _employeeInitialsRefreshing = false;
  }
}

/**
 * イニシャルマップを取得（キャッシュ有効期限チェック付き）
 * キャッシュが古い場合はバックグラウンドで更新（stale-while-revalidate）
 */
function getInitialsMap(): Record<string, string> {
  const now = Date.now();
  if (_employeeInitialsMap && (now - _employeeInitialsCachedAt) < EMPLOYEE_INITIALS_CACHE_TTL_MS) {
    return _employeeInitialsMap;
  }
  // キャッシュが古い or 未初期化 → バックグラウンドで更新（今回は古いデータを返す）
  refreshEmployeeCache().catch(console.error);
  return _employeeInitialsMap || {};
}'''

if old_cache_code in text:
    text = text.replace(old_cache_code, new_cache_code)
    print('✅ イニシャルキャッシュをインメモリキャッシュに変更しました')
else:
    print('❌ 旧キャッシュコードが見つかりません')
    idx = text.find('EMPLOYEE_INITIALS_CACHE_KEY')
    if idx >= 0:
        print('--- 前後の文脈 ---')
        print(repr(text[idx-50:idx+200]))
    import sys
    sys.exit(1)

# decryptSeller 内の Redis キャッシュ呼び出しを同期的なインメモリキャッシュに変更
old_decrypt_cache = '''      // Redis キャッシュから従業員マップを1回取得してイニシャルを解決（最適化）
      // キャッシュミス時も refreshEmployeeCache は1回だけ呼ばれる
      let initialsMap = await CacheHelper.get<Record<string, string>>(EMPLOYEE_INITIALS_CACHE_KEY);
      if (!initialsMap) {
        await refreshEmployeeCache();
        initialsMap = await CacheHelper.get<Record<string, string>>(EMPLOYEE_INITIALS_CACHE_KEY);
      }
      const visitAssigneeFullName = seller.visit_assignee ? (initialsMap?.[seller.visit_assignee] || null) : null;
      const visitValuationAcquirerFullName = seller.visit_valuation_acquirer ? (initialsMap?.[seller.visit_valuation_acquirer] || null) : null;
      console.log(`[PERF] decryptSeller getEmployeeNames: ${Date.now() - _dt0}ms`);'''

new_decrypt_cache = '''      // モジュールレベルのインメモリキャッシュからイニシャルマップを同期的に取得
      // Redis await を排除してパフォーマンスを改善
      const initialsMap = getInitialsMap();
      const visitAssigneeFullName = seller.visit_assignee ? (initialsMap[seller.visit_assignee] || null) : null;
      const visitValuationAcquirerFullName = seller.visit_valuation_acquirer ? (initialsMap[seller.visit_valuation_acquirer] || null) : null;
      console.log(`[PERF] decryptSeller getEmployeeNames (sync): ${Date.now() - _dt0}ms`);'''

if old_decrypt_cache in text:
    text = text.replace(old_decrypt_cache, new_decrypt_cache)
    print('✅ decryptSeller のキャッシュ呼び出しを同期化しました')
else:
    print('❌ decryptSeller のキャッシュ呼び出しが見つかりません')
    idx = text.find('Redis キャッシュから従業員マップを1回取得')
    if idx >= 0:
        print('--- 前後の文脈 ---')
        print(repr(text[idx-50:idx+400]))
    import sys
    sys.exit(1)

# decryptSeller を async から sync に変更（await が不要になったため）
# ただし他の箇所で await している可能性があるので、async のままにして問題ない
# → async のままでOK（await を削除しただけ）

# CRLF に戻す
text = text.replace('\n', '\r\n')

with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')
print('完了！Redis await を排除してインメモリキャッシュに変更')

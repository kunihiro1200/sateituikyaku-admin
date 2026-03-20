#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
getEmployeeNameByInitials のインメモリキャッシュを Redis キャッシュに移行する
Vercel サーバーレス環境ではインメモリキャッシュがコールドスタート時にリセットされるため
"""

import re

FILE_PATH = 'backend/src/services/SellerService.supabase.ts'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

# CRLF を LF に正規化してから処理
text = content.decode('utf-8').replace('\r\n', '\n')

# 旧: インメモリキャッシュを使った getEmployeeNameByInitials と refreshEmployeeCache
OLD_BLOCK = """// イニシャルからフルネームへのマッピングキャッシュ
let initialsToNameCache: Map<string, string> | null = null;
let cacheLastUpdated: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分

/**
 * スタッフのイニシャルからフルネームを取得
 */
async function getEmployeeNameByInitials(initials: string | null | undefined): Promise<string | null> {
  if (!initials) return null;

  // キャッシュの有効期限をチェック
  const now = Date.now();
  if (!initialsToNameCache || (now - cacheLastUpdated) > CACHE_DURATION) {
    // キャッシュを更新
    await refreshEmployeeCache();
  }

  return initialsToNameCache?.get(initials) || null;
}

/**
 * スタッフ情報のキャッシュを更新
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

    initialsToNameCache = new Map();
    employees?.forEach((emp: any) => {
      if (emp.initials && emp.name) {
        initialsToNameCache!.set(emp.initials, emp.name);
      }
    });

    cacheLastUpdated = Date.now();
    console.log(`✅ Employee initials cache updated: ${initialsToNameCache.size} employees`);
  } catch (error) {
    console.error('Error refreshing employee cache:', error);
  }
}"""

NEW_BLOCK = """// Redis キャッシュキー（Vercel サーバーレス環境でもキャッシュが持続する）
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
}"""

if OLD_BLOCK in text:
    text = text.replace(OLD_BLOCK, NEW_BLOCK)
    print("✅ getEmployeeNameByInitials を Redis キャッシュに移行しました")
else:
    print("❌ 対象ブロックが見つかりませんでした")
    # デバッグ: 最初の部分を確認
    idx = text.find('initialsToNameCache')
    if idx >= 0:
        print(f"  'initialsToNameCache' は {idx} 行目付近に存在します")
        print(f"  前後のテキスト: {repr(text[max(0,idx-50):idx+100])}")
    else:
        print("  'initialsToNameCache' が見つかりません")

# CRLF を維持して書き込む（元のファイルが CRLF の場合）
output = text.replace('\n', '\r\n').encode('utf-8')
with open(FILE_PATH, 'wb') as f:
    f.write(output)

print(f"✅ {FILE_PATH} を保存しました")

# BOM チェック
with open(FILE_PATH, 'rb') as f:
    first_bytes = f.read(3)
print(f"BOM チェック: {repr(first_bytes[:3])} (b'\\xef\\xbb\\xbf' はBOM付き、それ以外はOK)")

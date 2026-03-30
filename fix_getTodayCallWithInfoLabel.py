#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
getTodayCallWithInfoLabel() 関数を修正するスクリプト
優先順位チェーンで最初の値のみ返す実装を、
全ての有効な値を配列に収集して・で結合する実装に変更する
"""

import sys

file_path = 'frontend/frontend/src/utils/sellerStatusFilters.ts'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前の関数（コメント含む）
old_func = '''/**
 * 当日TEL（内容）の表示ラベルを取得
 * 
 * コミュニケーション情報の優先順位:
 * 1. 連絡方法 (contact_method) → 当日TEL(Eメール)
 * 2. 連絡取りやすい時間 (preferred_contact_time) → 当日TEL(午前中)
 * 3. 電話担当 (phone_contact_person) → 当日TEL(Y)
 * 
 * @param seller 売主データ
 * @returns 表示ラベル（例: "当日TEL(Eメール)"）
 */
export const getTodayCallWithInfoLabel = (seller: Seller | any): string => {
  const contactMethod = seller.contactMethod || seller.contact_method || '';
  const preferredContactTime = seller.preferredContactTime || seller.preferred_contact_time || '';
  const phoneContactPerson = seller.phoneContactPerson || seller.phone_contact_person || '';
  
  // "null" 文字列も空扱い
  const isValid = (v: string): boolean => !!(v && v.trim() !== '' && v.trim().toLowerCase() !== 'null');
  
  // 優先順位: 連絡方法 > 連絡取りやすい時間 > 電話担当
  if (isValid(contactMethod)) {
    return `当日TEL(${contactMethod})`;
  }
  if (isValid(preferredContactTime)) {
    return `当日TEL(${preferredContactTime})`;
  }
  if (isValid(phoneContactPerson)) {
    return `当日TEL(${phoneContactPerson})`;
  }
  
  return '当日TEL（内容）';
};'''

# 修正後の関数
new_func = '''/**
 * 当日TEL（内容）の表示ラベルを取得
 * 
 * コミュニケーション情報の表示順:
 * 1. 電話担当 (phone_contact_person) → 当日TEL(Y)
 * 2. 連絡取りやすい時間 (preferred_contact_time) → 当日TEL(午前中)
 * 3. 連絡方法 (contact_method) → 当日TEL(Eメール)
 * 
 * 複数のフィールドに値がある場合は・で結合して表示する
 * 例: phone_contact_person="I", contact_method="Eメール" → 当日TEL(I・Eメール)
 * 
 * @param seller 売主データ
 * @returns 表示ラベル（例: "当日TEL(I・Eメール)"）
 */
export const getTodayCallWithInfoLabel = (seller: Seller | any): string => {
  const contactMethod = seller.contactMethod || seller.contact_method || '';
  const preferredContactTime = seller.preferredContactTime || seller.preferred_contact_time || '';
  const phoneContactPerson = seller.phoneContactPerson || seller.phone_contact_person || '';

  // "null" 文字列も空扱い
  const isValid = (v: string): boolean => !!(v && v.trim() !== '' && v.trim().toLowerCase() !== 'null');

  // 表示順: 電話担当・連絡取りやすい時間・連絡方法
  const parts: string[] = [];
  if (isValid(phoneContactPerson)) parts.push(phoneContactPerson);
  if (isValid(preferredContactTime)) parts.push(preferredContactTime);
  if (isValid(contactMethod)) parts.push(contactMethod);

  if (parts.length === 0) {
    return '当日TEL（内容）';
  }

  return `当日TEL(${parts.join('・')})`;
};'''

if old_func in text:
    text = text.replace(old_func, new_func)
    print('✅ 関数の置換に成功しました')
else:
    print('❌ 対象の関数が見つかりませんでした')
    # デバッグ用: 関数の一部を検索
    if 'getTodayCallWithInfoLabel' in text:
        print('  → getTodayCallWithInfoLabel は存在します')
    if '優先順位: 連絡方法 > 連絡取りやすい時間 > 電話担当' in text:
        print('  → 優先順位コメントが見つかりました')
    sys.exit(1)

# UTF-8（BOMなし）で書き込む
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'✅ {file_path} を更新しました')

# BOMチェック
with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
if first_bytes == b'\xef\xbb\xbf':
    print('⚠️  BOM付きUTF-8です')
else:
    print('✅ BOMなしUTF-8です（正常）')

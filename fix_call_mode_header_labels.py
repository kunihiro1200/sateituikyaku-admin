# -*- coding: utf-8 -*-
"""
通話モードページのヘッダーカテゴリーラベルを日本語化するスクリプト
UTF-8エンコーディングを保持したまま変更を適用
"""

# ファイルをUTF-8で読み込む
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 変更1: shouldShowStatusFirstにデバッグログを追加
old_usememo = """  const shouldShowStatusFirst = useMemo(() => {
    const currentStatus = editedStatus || seller?.status || '';
    const targetStatuses = [
      '一般媒介',
      '専任媒介',
      '他決→追客',
      '他決→追客不要',
      '他決→専任',
      '他決→一般',
      'リースバック（専任）',
      '専任→他社専任',
      '一般→他決',
    ];
    return targetStatuses.some(status => currentStatus.includes(status));
  }, [seller?.status, editedStatus]);"""

new_usememo = """  const shouldShowStatusFirst = useMemo(() => {
    const currentStatus = editedStatus || seller?.status || '';
    const targetStatuses = [
      '一般媒介',
      '専任媒介',
      '他決→追客',
      '他決→追客不要',
      '他決→専任',
      '他決→一般',
      'リースバック（専任）',
      '専任→他社専任',
      '一般→他決',
    ];
    const result = targetStatuses.some(status => currentStatus.includes(status));
    console.log('🔍 [shouldShowStatusFirst] currentStatus:', currentStatus);
    console.log('🔍 [shouldShowStatusFirst] result:', result);
    return result;
  }, [seller?.status, editedStatus]);"""

text = text.replace(old_usememo, new_usememo)

# 変更2: ヘッダーのカテゴリーラベルに新しいカテゴリーを追加
old_header_labels = """            else if (selectedCategory === 'todayCallAssigned') label = '当日TEL（担当）';
            else if (typeof selectedCategory === 'string' && selectedCategory.startsWith('visitAssigned:')) label = `担当（${selectedCategory.replace('visitAssigned:', '')}）`;
            else if (typeof selectedCategory === 'string' && selectedCategory.startsWith('todayCallAssigned:')) label = `当日TEL(${selectedCategory.replace('todayCallAssigned:', '')})`"""

new_header_labels = """            else if (selectedCategory === 'todayCallAssigned') label = '当日TEL（担当）';
            else if (selectedCategory === 'VISITOTHERDECISION') label = '訪問後他決';
            else if (selectedCategory === 'UNVISITEDOTHERDECISION') label = '未訪問他決';
            else if (selectedCategory === 'EXCLUSIVE') label = '専任';
            else if (selectedCategory === 'GENERAL') label = '一般';
            else if (typeof selectedCategory === 'string' && selectedCategory.startsWith('visitAssigned:')) label = `担当（${selectedCategory.replace('visitAssigned:', '')}）`;
            else if (typeof selectedCategory === 'string' && selectedCategory.startsWith('todayCallAssigned:')) label = `当日TEL(${selectedCategory.replace('todayCallAssigned:', '')})`"""

text = text.replace(old_header_labels, new_header_labels)

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 変更完了')
print('✅ UTF-8エンコーディングを保持')

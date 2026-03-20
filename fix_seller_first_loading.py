#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx の loadAllData を最適化：
- 売主データ（/api/sellers/:id）だけを先に await して setLoading(false) を呼ぶ
- getActiveEmployees() と /properties/seller/:id はバックグラウンドで並列取得
"""

import os

file_path = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# CRLF を LF に正規化
text = text.replace('\r\n', '\n')

# 旧コード（Promise.all で3つを並列取得）
old_code = '''      // 並列で全データを取得（AI要約以外）
      // /api/employees はキャッシュ付きの getActiveEmployees() に統一
      // propertyData も並列で取得（直列フォールバックを排除）
      const [sellerResponse, employeesData, propertyFallbackResponse] = await Promise.all([
        api.get(`/api/sellers/${id}`),
        getActiveEmployees(),
        api.get(`/properties/seller/${id}`).catch(() => null),
      ]);

      // スタッフ一覧を設定（getActiveEmployees はキャッシュ付き）
      setEmployees(employeesData as any);
      setActiveEmployees(employeesData);

      // 売主情報を設定
      const sellerData = sellerResponse.data;'''

# 新コード（売主データだけ先に取得、他はバックグラウンド）
new_code = '''      // 売主データだけ先に取得して即座に画面表示
      // employees と property はバックグラウンドで並列取得（画面表示をブロックしない）
      const sellerResponse = await api.get(`/api/sellers/${id}`);

      // 売主情報を設定
      const sellerData = sellerResponse.data;'''

if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ Promise.all を売主データ先行取得に変更しました')
else:
    print('❌ 旧コードが見つかりません。手動で確認してください。')
    # デバッグ用：前後の文脈を表示
    idx = text.find('並列で全データを取得')
    if idx >= 0:
        print('--- 前後の文脈 ---')
        print(repr(text[idx-50:idx+500]))
    import sys
    sys.exit(1)

# setLoading(false) の後にバックグラウンド取得を追加
# 現在の「ローディング終了」コメントの後に employees/property のバックグラウンド取得を追加
old_loading_end = '''      // ローディング終了（画面を表示）- activities 取得を待たずに表示
      setLoading(false);

      // 活動履歴をバックグラウンドで取得（3秒かかるため画面表示をブロックしない）'''

new_loading_end = '''      // ローディング終了（画面を表示）- employees/activities 取得を待たずに表示
      setLoading(false);

      // employees と property フォールバックをバックグラウンドで並列取得
      Promise.all([
        getActiveEmployees().then((employeesData) => {
          setEmployees(employeesData as any);
          setActiveEmployees(employeesData);
        }).catch((err) => {
          console.error('Failed to load employees:', err);
        }),
        api.get(`/properties/seller/${id}`).catch(() => null).then((propertyFallbackResponse) => {
          // sellerData.property がない場合のみフォールバックを使用
          if (!sellerData.property && propertyFallbackResponse?.data?.property) {
            const fallbackProperty = propertyFallbackResponse.data.property;
            setProperty(fallbackProperty);
            setEditedPropertyAddress(fallbackProperty.address || '');
            setEditedPropertyType(fallbackProperty.propertyType || '');
            setEditedLandArea(fallbackProperty.landArea?.toString() || '');
            setEditedBuildingArea(fallbackProperty.buildingArea?.toString() || '');
            setEditedBuildYear(fallbackProperty.buildYear?.toString() || '');
            setEditedFloorPlan(fallbackProperty.floorPlan || '');
            setEditedStructure(fallbackProperty.structure || '');
            setEditedSellerSituation(fallbackProperty.sellerSituation || '');
          }
        }),
      ]);

      // 活動履歴をバックグラウンドで取得（3秒かかるため画面表示をブロックしない）'''

if old_loading_end in text:
    text = text.replace(old_loading_end, new_loading_end)
    print('✅ setLoading(false) 後にバックグラウンド取得を追加しました')
else:
    print('❌ setLoading(false) 前後のコードが見つかりません')
    idx = text.find('ローディング終了')
    if idx >= 0:
        print('--- 前後の文脈 ---')
        print(repr(text[idx-50:idx+300]))
    import sys
    sys.exit(1)

# 旧コードの「物件データを設定」部分を修正
# propertyFallbackResponse を使っていた部分を sellerData.property のみに変更
old_property_set = '''      // 物件データを設定（sellerData に含まれていれば優先、なければ並列取得済みのデータを使用）
      let propertyData = sellerData.property || null;
      if (!propertyData && propertyFallbackResponse?.data?.property) {
        propertyData = propertyFallbackResponse.data.property;
      }
      
      setProperty(propertyData);'''

new_property_set = '''      // 物件データを設定（sellerData に含まれていれば使用、なければバックグラウンドで後から設定）
      let propertyData = sellerData.property || null;
      
      setProperty(propertyData);'''

if old_property_set in text:
    text = text.replace(old_property_set, new_property_set)
    print('✅ 物件データ設定部分を修正しました')
else:
    print('❌ 物件データ設定部分が見つかりません')
    idx = text.find('物件データを設定')
    if idx >= 0:
        print('--- 前後の文脈 ---')
        print(repr(text[idx-50:idx+300]))
    import sys
    sys.exit(1)

# LF を CRLF に戻す
text = text.replace('\n', '\r\n')

with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')
print('完了！売主データ先行取得 + employees/property バックグラウンド化')

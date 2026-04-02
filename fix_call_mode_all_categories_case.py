# -*- coding: utf-8 -*-
"""
通話モードページのヘッダーカテゴリーラベルを日本語化するスクリプト（全カテゴリー大文字・小文字対応）
UTF-8エンコーディングを保持したまま変更を適用
"""

# ファイルをUTF-8で読み込む
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 全カテゴリーに大文字・小文字の両方を追加
old_header_labels = """            let label = selectedCategory as string;
            if (selectedCategory === 'visitDayBefore') label = '訪問日前日';
            else if (selectedCategory === 'visitCompleted') label = '訪問済み';
            else if (selectedCategory === 'todayCall') label = '当日TEL分';
            else if (selectedCategory === 'todayCallWithInfo') label = '当日TEL（内容）';
            else if (selectedCategory === 'unvaluated') label = '未査定';
            else if (selectedCategory === 'mailingPending') label = '査定（郵送）';
            else if (selectedCategory === 'todayCallNotStarted') label = '当日TEL_未着手';
            else if (selectedCategory === 'pinrichEmpty') label = 'Pinrich空欄';
            else if (selectedCategory === 'todayCallAssigned') label = '当日TEL（担当）';
            else if (selectedCategory === 'VISITOTHERDECISION') label = '訪問後他決';
            else if (selectedCategory === 'UNVISITEDOTHERDECISION') label = '未訪問他決';
            else if (selectedCategory === 'EXCLUSIVE') label = '専任';
            else if (selectedCategory === 'GENERAL') label = '一般';
            else if (selectedCategory === 'visitOtherDecision') label = '訪問後他決';
            else if (selectedCategory === 'unvisitedOtherDecision') label = '未訪問他決';
            else if (selectedCategory === 'exclusive') label = '専任';
            else if (selectedCategory === 'general') label = '一般';
            else if (typeof selectedCategory === 'string' && selectedCategory.startsWith('visitAssigned:')) label = `担当（${selectedCategory.replace('visitAssigned:', '')}）`;
            else if (typeof selectedCategory === 'string' && selectedCategory.startsWith('todayCallAssigned:')) label = `当日TEL(${selectedCategory.replace('todayCallAssigned:', '')})`;"""

new_header_labels = """            let label = selectedCategory as string;
            if (selectedCategory === 'visitDayBefore' || selectedCategory === 'VISITDAYBEFORE') label = '訪問日前日';
            else if (selectedCategory === 'visitCompleted' || selectedCategory === 'VISITCOMPLETED') label = '訪問済み';
            else if (selectedCategory === 'todayCall' || selectedCategory === 'TODAYCALL') label = '当日TEL分';
            else if (selectedCategory === 'todayCallWithInfo' || selectedCategory === 'TODAYCALLWITHINFO') label = '当日TEL（内容）';
            else if (selectedCategory === 'unvaluated' || selectedCategory === 'UNVALUATED') label = '未査定';
            else if (selectedCategory === 'mailingPending' || selectedCategory === 'MAILINGPENDING') label = '査定（郵送）';
            else if (selectedCategory === 'todayCallNotStarted' || selectedCategory === 'TODAYCALLNOTSTARTED') label = '当日TEL_未着手';
            else if (selectedCategory === 'pinrichEmpty' || selectedCategory === 'PINRICHEMPTY') label = 'Pinrich空欄';
            else if (selectedCategory === 'todayCallAssigned' || selectedCategory === 'TODAYCALLASSIGNED') label = '当日TEL（担当）';
            else if (selectedCategory === 'visitOtherDecision' || selectedCategory === 'VISITOTHERDECISION') label = '訪問後他決';
            else if (selectedCategory === 'unvisitedOtherDecision' || selectedCategory === 'UNVISITEDOTHERDECISION') label = '未訪問他決';
            else if (selectedCategory === 'exclusive' || selectedCategory === 'EXCLUSIVE') label = '専任';
            else if (selectedCategory === 'general' || selectedCategory === 'GENERAL') label = '一般';
            else if (typeof selectedCategory === 'string' && selectedCategory.startsWith('visitAssigned:')) label = `担当（${selectedCategory.replace('visitAssigned:', '')}）`;
            else if (typeof selectedCategory === 'string' && selectedCategory.startsWith('todayCallAssigned:')) label = `当日TEL(${selectedCategory.replace('todayCallAssigned:', '')})`;"""

text = text.replace(old_header_labels, new_header_labels)

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 変更完了（全カテゴリー大文字・小文字対応）')
print('✅ UTF-8エンコーディングを保持')

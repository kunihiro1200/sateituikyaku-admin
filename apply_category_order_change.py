# apply_category_order_change.py
# CATEGORY_ORDER と CATEGORY_GROUP_COLORS の順番を業務フロー順に変更する

with open('frontend/frontend/src/utils/workTaskStatusUtils.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# CATEGORY_ORDER の変更
old_order = """const CATEGORY_ORDER = [
  '売買契約　営業確認中',
  '売買契約 入力待ち',
  'サイト登録依頼してください',
  '決済完了チャット送信未',
  '入金確認未',
  '要台帳作成',
  '売買契約 製本待ち',
  '売買契約 依頼未',
  'サイト依頼済み納品待ち',
  'サイト登録要確認',
  '媒介作成_締日',
  '保留',
];"""

new_order = """const CATEGORY_ORDER = [
  '媒介作成_締日',
  'サイト登録依頼してください',
  'サイト依頼済み納品待ち',
  'サイト登録要確認',
  '売買契約 依頼未',
  '売買契約　営業確認中',
  '売買契約 入力待ち',
  '売買契約 製本待ち',
  '要台帳作成',
  '決済完了チャット送信未',
  '入金確認未',
  '保留',
];"""

if old_order in text:
    text = text.replace(old_order, new_order)
    print('✅ CATEGORY_ORDER の変更: 成功')
else:
    print('❌ CATEGORY_ORDER の変更: 対象文字列が見つかりませんでした')

# CATEGORY_GROUP_COLORS の変更
old_colors = """const CATEGORY_GROUP_COLORS: [string, string][] = [
  ['売買契約　営業確認中',   '#e3f2fd'],
  ['売買契約 入力待ち',      '#e3f2fd'],
  ['売買契約 製本待ち',      '#e3f2fd'],
  ['売買契約 依頼未',        '#e3f2fd'],
  ['サイト登録依頼してください', '#f3e5f5'],
  ['サイト依頼済み納品待ち', '#f3e5f5'],
  ['サイト登録要確認',       '#f3e5f5'],
  ['決済完了チャット送信未', '#fff8e1'],
  ['入金確認未',             '#fff8e1'],
  ['媒介作成_締日',          '#e8f5e9'],
  ['要台帳作成',             '#fce4ec'],
  ['保留',                   '#f5f5f5'],
];"""

new_colors = """const CATEGORY_GROUP_COLORS: [string, string][] = [
  ['媒介作成_締日',              '#e8f5e9'],
  ['サイト登録依頼してください', '#f3e5f5'],
  ['サイト依頼済み納品待ち',     '#f3e5f5'],
  ['サイト登録要確認',           '#f3e5f5'],
  ['売買契約 依頼未',            '#e3f2fd'],
  ['売買契約　営業確認中',       '#e3f2fd'],
  ['売買契約 入力待ち',          '#e3f2fd'],
  ['売買契約 製本待ち',          '#e3f2fd'],
  ['要台帳作成',                 '#fce4ec'],
  ['決済完了チャット送信未',     '#fff8e1'],
  ['入金確認未',                 '#fff8e1'],
  ['保留',                       '#f5f5f5'],
];"""

if old_colors in text:
    text = text.replace(old_colors, new_colors)
    print('✅ CATEGORY_GROUP_COLORS の変更: 成功')
else:
    print('❌ CATEGORY_GROUP_COLORS の変更: 対象文字列が見つかりませんでした')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/utils/workTaskStatusUtils.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')

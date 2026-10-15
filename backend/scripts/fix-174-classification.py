"""
未照合174件の完全な3種別分類（11件不足の修正）
"""
import json, re, os

script_dir = os.path.dirname(os.path.abspath(__file__))
result_path = os.path.join(script_dir, '..', 'tmp-pdf', 'comparison-result.json')
data_path   = os.path.join(script_dir, '..', 'src', 'data', 'fukuoka-school-address-map.json')

with open(result_path, encoding='utf-8') as f:
    comp = json.load(f)
with open(data_path, encoding='utf-8') as f:
    data = json.load(f)

uv = comp.get('unverified', [])
all_records = data.get('records', [])

# 学校名 → データ取得元のマッピング
JH_TO_SOURCE = {
    # は行 (hc.html 2026-08 live)
    '博多中': 'hc (live 2026-08)', '箱崎中': 'hc (live 2026-08)', '箱崎清松中': 'hc (live 2026-08)',
    '花畑中': 'hc (live 2026-08)', '原中': 'hc (live 2026-08)', '原北中': 'hc (live 2026-08)',
    '原中央中': 'hc (live 2026-08)', '春吉中': 'hc (live 2026-08)', '東住吉中': 'hc (live 2026-08)',
    '平尾中': 'hc (live 2026-08)', '福岡中': 'hc (live 2026-08)',
    # ま行 (mc.html 2026-08 live)
    '舞鶴中': 'mc (live 2026-08)', '松崎中': 'mc (live 2026-08)', '三宅中': 'mc (live 2026-08)',
    '宮竹中': 'mc (live 2026-08)', '席田中': 'mc (live 2026-08)', '姪浜中': 'mc (live 2026-08)',
    '元岡中': 'mc (live 2026-08)', '百道中': 'mc (live 2026-08)',
    # あ行 (ac.html 2026-01-01 Wayback)
    '青葉中': 'ac (WB 2026-01)', '壱岐中': 'ac (WB 2026-01)', '壱岐丘中': 'ac (WB 2026-01)',
    '板付中': 'ac (WB 2026-01)', '内浜中': 'ac (WB 2026-01)', '梅林中': 'ac (WB 2026-01)',
    '曰佐中': 'ac (WB 2026-01)', '小呂中': 'ac (WB 2026-01)',
    # か行 (kc.html 2025-04 Wayback)
    '香椎第１中': 'kc (WB 2025-04)', '香椎第１中': 'kc (WB 2025-04)',
    '香椎第2中': 'kc (WB 2025-04)', '香椎第２中': 'kc (WB 2025-04)',
    '香椎第3中': 'kc (WB 2025-04)', '香椎第３中': 'kc (WB 2025-04)',
    '柏原中': 'kc (WB 2025-04)', '片江中': 'kc (WB 2025-04)', '金武中': 'kc (WB 2025-04)',
    '北崎中': 'kc (WB 2025-04)', '警固中': 'kc (WB 2025-04)', '玄界中': 'kc (WB 2025-04)',
    '玄洋中': 'kc (WB 2025-04)',
    # さ行 (sc.html 2025-04 Wayback)
    '早良中': 'sc (WB 2025-04)', '三筑中': 'sc (WB 2025-04)', '志賀中': 'sc (WB 2025-04)',
    '下山門中': 'sc (WB 2025-04)', '城香中': 'sc (WB 2025-04)', '城西中': 'sc (WB 2025-04)',
    '城南中': 'sc (WB 2025-04)', '次郎丸中': 'sc (WB 2025-04)', '住吉中': 'sc (WB 2025-04)',
    '西陵中': 'sc (WB 2025-04)',
    # た行 (tc.html 2025-04 Wayback)
    '高取中': 'tc (WB 2025-04)', '高宮中': 'tc (WB 2025-04)', '田隈中': 'tc (WB 2025-04)',
    '多々良中': 'tc (WB 2025-04)', '多々良中央中': 'tc (WB 2025-04)', '千代中': 'tc (WB 2025-04)',
    '照葉中': 'tc (WB 2025-04)', '東光中': 'tc (WB 2025-04)', '当仁中': 'tc (WB 2025-04)',
    '筑紫丘中': 'tc (WB 2025-04)', '友泉中': 'tc (WB 2025-04)',
    # な行 (nc.html 2025-04 Wayback)
    '那珂中': 'nc (WB 2025-04)', '長尾中': 'nc (WB 2025-04)', '長丘中': 'nc (WB 2025-04)',
    '西福岡中': 'nc (WB 2025-04)', '能古中': 'nc (WB 2025-04)', '野間中': 'nc (WB 2025-04)',
    # や行 (yc.html 2025-04 Wayback)
    '友泉中': 'yc (WB 2025-04)', '横手中': 'yc (WB 2025-04)', '吉塚中': 'yc (WB 2025-04)',
    '老司中': 'yc (WB 2025-04)', '和白中': 'yc (WB 2025-04)', '和白丘中': 'yc (WB 2025-04)',
    # 周船寺中 (R8 PDF補完)
    '周船寺中': 'R8 PDF補完 (2026-04)',
}

LIVE_SOURCES = {'hc (live 2026-08)', 'mc (live 2026-08)'}
WAYBACK_2026 = {'ac (WB 2026-01)'}
WAYBACK_2025 = {'kc (WB 2025-04)', 'sc (WB 2025-04)', 'tc (WB 2025-04)', 'nc (WB 2025-04)', 'yc (WB 2025-04)'}
PDF_SUPP    = {'R8 PDF補完 (2026-04)'}

# 3種別分類
kind_a = []  # 文字表記・PDF抽出問題のみ
kind_b = []  # 変更の可能性あり（2025-04 Wayback）
kind_c = []  # 例外区域（照会・の一部・ただし）
unknown = []

for jr in uv:
    rng = jr.get('range', '') or ''
    jh  = jr.get('juniorHigh', '') or ''
    src = JH_TO_SOURCE.get(jh, 'unknown')
    
    has_exception = (rng.includes('照会') if hasattr(rng, 'includes') else
                    '照会' in rng or 'の一部' in rng or 'ただし' in rng)
    
    if has_exception:
        kind_c.append((jr, src))
    elif src in WAYBACK_2025:
        kind_b.append((jr, src))
    elif src in LIVE_SOURCES or src in WAYBACK_2026 or src in PDF_SUPP:
        kind_a.append((jr, src))
    else:
        unknown.append((jr, src))

print('=== 未照合174件の完全分類 ===')
print(f'種別A（文字表記・PDF抽出問題）: {len(kind_a)}件')
print(f'種別B（変更の可能性あり）     : {len(kind_b)}件')
print(f'種別C（例外区域）             : {len(kind_c)}件')
print(f'未分類                         : {len(unknown)}件')
print(f'合計                           : {len(kind_a)+len(kind_b)+len(kind_c)+len(unknown)}件')
print()

if unknown:
    print(f'--- 未分類 {len(unknown)}件 (学校名→ソースマッピング漏れ) ---')
    by_jh = {}
    for jr, src in unknown:
        jh = jr.get('juniorHigh','')
        by_jh[jh] = by_jh.get(jh, 0) + 1
    for jh, cnt in sorted(by_jh.items(), key=lambda x: -x[1]):
        print(f'  {jh}: {cnt}件')

print()
print('--- 種別B（変更の可能性あり）上位10件 ---')
for jr, src in kind_b[:10]:
    print(f'  [{src}] {jr.get("ward","")} {jr.get("town","")} / {jr.get("elementary","")} / {jr.get("juniorHigh","")}')
    print(f'    range: {jr.get("range","")[:60]}')

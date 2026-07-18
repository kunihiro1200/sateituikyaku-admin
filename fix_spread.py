with open(r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\pages\CallModePage.tsx', 'rb') as f:
    text = f.read().decode('utf-8')

old = '''    // 査定額3 = 最高事例 + 20万（10万丸め）
    const amount3 = Math.round((baseMax + 20) / 10) * 10;
    // 幅200〜300万
    const spread = Math.max(200, Math.min(300, Math.round((amount3 - weightedAvg) / 10) * 10));
    const amount1 = Math.round(Math.max(amount3 - spread, weightedAvg * 0.92) / 10) * 10;
    const amount2 = Math.round((amount1 + amount3) / 2 / 10) * 10;'''

new = '''    // 査定額3 = 最高事例 + 20万（10万丸め）
    const amount3 = Math.round((baseMax + 20) / 10) * 10;
    // 査定額2 = 査定額3 - 200〜300万（10万丸め）
    const spread23 = Math.round(Math.max(200, Math.min(300, amount3 - weightedAvg)) / 10) * 10;
    const amount2 = amount3 - spread23;
    // 査定額1 = 査定額2 - 200〜300万（10万丸め）
    const spread12 = Math.round(Math.max(200, Math.min(300, amount2 - weightedAvg * 0.92)) / 10) * 10;
    const amount1 = amount2 - spread12;'''

if old not in text:
    print("ERROR: old string not found")
    exit(1)

text = text.replace(old, new, 1)

with open(r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\pages\CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
print("Done!")

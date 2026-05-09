# tateuriPreview.tsの重複コードを修正する
with open('backend/src/routes/tateuriPreview.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 重複している部分を削除
# "}    return res.json({..." から次の "}" までを削除
old = """}    return res.json({
      success: true,
      slug,
      data: payload,
      preview_url: `https://sateituikyaku-admin-frontend.vercel.app/property-preview/${slug}`,
    });

  } catch (err: any) {
    console.error('[suumo/scrape] エラー:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}"""

new = "}"

count = text.count(old)
print(f'Found {count} occurrences of duplicate block')

if count == 1:
    text = text.replace(old, new, 1)
    with open('backend/src/routes/tateuriPreview.ts', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('Fixed!')
else:
    print('Pattern not found or multiple occurrences - manual fix needed')
    # 前後の文脈を表示
    idx = text.find('}    return res.json({')
    if idx >= 0:
        print(f'Found at index {idx}')
        print(repr(text[idx:idx+300]))

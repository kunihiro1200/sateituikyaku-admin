with open('src/index.ts', 'rb') as f:
    raw = f.read()
text = raw.decode('utf-8')

# property-site-frontend行とbaikyaku行が連結している箇所を探す
idx = text.find("'https://property-site-frontend-kappa.vercel.app'")
if idx < 0:
    print("ERROR: property-site line not found")
else:
    # その行の終わりまでを確認
    end = text.find('\n', idx)
    snippet = text[idx:end+50]
    print("Found snippet: " + repr(snippet))

    # 文字化けコメント付きで連結している行を正しく分割
    # 元の行: 'https://property-site-frontend-kappa.vercel.app',  // 文字化け    'https://baikyaku-property-site3.vercel.app'  // 文字化け  ],
    # 正しい形: 各URLを別行に

    # まず問題の範囲を特定
    cors_start = text.find("app.use(cors({")
    cors_end = text.find("}));", cors_start) + 4
    old_cors = text[cors_start:cors_end]
    print("Old CORS block length: " + str(len(old_cors)))

    new_cors = """app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'https://new-admin-management-system-v2.vercel.app',
    'https://sateituikyaku-admin-frontend.vercel.app',
    'https://property-site-frontend-kappa.vercel.app',
    'https://baikyaku-property-site3.vercel.app',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));"""

    new_text = text[:cors_start] + new_cors + text[cors_end:]
    with open('src/index.ts', 'w', encoding='utf-8-sig', newline='\r\n') as f:
        f.write(new_text)
    print("Done - CORS block replaced")

---
inclusion: manual
---

# Specファイルサイズガイドライン

## 問題

大きなSpecファイル（特に`design.md`）がセッションコンテキストを圧迫し、セッションが短くなる原因となっています。

**現状**:
- 最大のdesign.md: 1,066行（41KB）
- 平均的なdesign.md: 400-500行
- 1ファイルあたり約10,000-15,000トークン消費

## ガイドライン

### design.mdの推奨サイズ

- **理想**: 200行以下
- **許容**: 300行以下
- **要改善**: 400行以上

### 簡素化の方法

#### 1. 詳細な実装コードを削除

**❌ 悪い例**（design.mdに詳細なコードを含める）:
```markdown
## Implementation

### Frontend Component

\`\`\`typescript
export const BuyerStatusSidebar: React.FC = () => {
  const [counts, setCounts] = useState<SidebarCounts | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const response = await fetch('/api/buyers/sidebar-counts');
        const data = await response.json();
        setCounts(data);
      } catch (error) {
        console.error('Failed to fetch counts:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCounts();
  }, []);
  
  // ... 100行以上のコード
};
\`\`\`
```

**✅ 良い例**（概要のみ記載）:
```markdown
## Implementation

### Frontend Component

**ファイル**: `BuyerStatusSidebar.tsx`

**主要な機能**:
- `/api/buyers/sidebar-counts`からカウントを取得
- 赤字表示の条件判定
- クリック時のフィルタリング

**実装の詳細はコード内のコメントを参照**
```

#### 2. 長いテーブルを簡略化

**❌ 悪い例**（全フィールドを列挙）:
```markdown
| フィールド名 | 型 | 説明 | 例 |
|------------|---|------|---|
| buyer_number | string | 買主番号 | "7282" |
| latest_status | string | 最新状況 | "内覧予定" |
| next_call_date | date | 次電日 | "2026-04-10" |
| ... | ... | ... | ... |
（50行続く）
```

**✅ 良い例**（主要フィールドのみ）:
```markdown
**主要フィールド**:
- `buyer_number`: 買主番号
- `latest_status`: 最新状況
- `next_call_date`: 次電日

**その他のフィールドはデータベーススキーマを参照**
```

#### 3. 重複する説明を削除

**❌ 悪い例**（同じ内容を複数箇所で説明）:
```markdown
## Overview
買主リストのサイドバーに新カテゴリを追加します...

## Architecture
買主リストのサイドバーに新カテゴリを追加するため...

## Implementation
買主リストのサイドバーに新カテゴリを追加する実装...
```

**✅ 良い例**（1箇所のみ詳細に説明）:
```markdown
## Overview
買主リストのサイドバーに新カテゴリを追加します。

## Architecture
（図のみ、説明は最小限）

## Implementation
（実装の要点のみ）
```

#### 4. 長いコード例を外部ファイルに移動

**❌ 悪い例**（design.mdに全コードを含める）:
```markdown
## GAS Implementation

\`\`\`javascript
// 500行のGASコード
\`\`\`
```

**✅ 良い例**（外部ファイルへの参照）:
```markdown
## GAS Implementation

**ファイル**: `gas_buyer_sidebar_counts.js`

**主要な関数**:
- `updateBuyerSidebarCounts_()`: カウント計算
- `calculateInquiryEmailUnanswered_()`: 問合メール未対応カウント

**実装の詳細は上記ファイルを参照**
```

## チェックリスト

design.mdを作成・更新する前に確認：

- [ ] ファイルサイズは300行以下か？
- [ ] 詳細なコード例を削除したか？
- [ ] 長いテーブルを簡略化したか？
- [ ] 重複する説明を削除したか？
- [ ] 長いコード例を外部ファイルに移動したか？

## 既存ファイルの改善

**400行以上のdesign.mdファイル**（要改善）:
- `property-listing-header-chat-confirmation/design.md` (1,066行)
- `seller-sidebar-exclusive-general-visit-categories/design.md` (969行)
- `seller-sidebar-exclude-other-company-purchase/design.md` (925行)
- `buyer-home-hearing-optional-choices/design.md` (754行)
- `valuation-ui-and-sync-improvements/design.md` (695行)

**改善方法**:
1. 詳細なコードを削除
2. 長いテーブルを簡略化
3. 重複する説明を削除
4. 必要に応じて別ファイルに分割

---

**最終更新日**: 2026年4月6日
**作成理由**: 大きなSpecファイルがセッションコンテキストを圧迫し、セッションが短くなる問題を解決するため

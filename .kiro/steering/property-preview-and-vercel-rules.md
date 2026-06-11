---
inclusion: manual
---



# property-preview と vercel.json の設計ルール

## ⚠️ 絶対に守るべきルール

---

## 🔴 /property-preview/:slug の設計（2026年5月の事故から）

### 背景

`/property-preview/:slug` は2つの用途がある：

1. **Googleクローラー向け**：SEO用HTMLをバックエンドから返す（`/api/property-preview/html/:slug`）
2. **通常ブラウザ向け**：Reactアプリ（`index.html`）を返してプレビューを表示する

### 🚨 2026年5月15日の事故

`vercel.json` の rewrite で `/property-preview/:slug` を**全アクセス**バックエンドのSEO用HTMLに転送していた。

- SEO用HTMLは `default-src 'self'` のCSPを持つ最小限のHTML
- ブラウザで開くと外部への接続（バックエンドAPI・Google Maps）が全てブロックされる
- 「読み込みに失敗しました」と表示されてプレビューが見えなくなった

### ✅ 正しい vercel.json の設定

```json
{
  "source": "/property-preview/:slug",
  "has": [
    {
      "type": "header",
      "key": "user-agent",
      "value": ".*(Googlebot|bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp|Slack|Discordbot|TelegramBot|crawler|spider|bot).*"
    }
  ],
  "destination": "https://sateituikyaku-admin-backend.vercel.app/api/property-preview/html/:slug"
}
```

**クローラーのみ** バックエンドのSEO用HTMLに転送する。通常ブラウザは `/(.*) → /index.html` のルールでReactアプリが返る。

### ❌ 絶対にやってはいけない設定

```json
{ "source": "/property-preview/:slug", "destination": "https://...backend.../api/property-preview/html/:slug" }
```

`has` 条件なしで全アクセスをバックエンドに転送すると、ブラウザでCSP違反が発生してプレビューが壊れる。

---

## 🔴 vercel.json の rewrite を変更する際のルール

### チェックリスト

- [ ] `has` 条件なしで外部URLにrewriteしていないか？
- [ ] ブラウザアクセスとクローラーアクセスを区別しているか？
- [ ] 変更後にブラウザで実際にアクセスして動作確認したか？

### 原則

**外部バックエンドURLへのrewriteは必ず `has` 条件（User-Agent等）で対象を絞る。**

条件なしで外部URLにrewriteすると、そのURLが返すHTMLのCSPがブラウザに適用されてしまい、Reactアプリが動かなくなる。

---

## 🔴 公開ページ（認証不要）のフロントエンド実装ルール

### 背景

`/property-preview/:slug`、`/tateuri`、`/fukuoka-tateuri` などの公開ページは認証不要。

### ✅ 正しい実装

```typescript
// ✅ 公開ページでは fetch を直接使う（api インスタンスを使わない）
const BACKEND_URL = import.meta.env.MODE === 'production'
  ? 'https://sateituikyaku-admin-backend.vercel.app'
  : (import.meta.env.VITE_API_URL || 'http://localhost:3000');

const res = await fetch(`${BACKEND_URL}/api/property-preview/${slug}`, {
  method: 'GET',
  mode: 'cors',
});
```

### ❌ やってはいけない実装

```typescript
// ❌ 公開ページで api インスタンスを使う
import api from '../services/api';
api.get(`/api/property-preview/${slug}`);
```

`api` インスタンスは認証ロジック・リトライロジックが入っており、コールドスタート時に失敗しやすい。

### App.tsx の checkAuth スキップ

公開ページでは `checkAuth()` と `warmupApi()` をスキップする：

```typescript
const PUBLIC_PATHS = [
  '/property-preview/',
  '/public/',
  '/tateuri',
  '/fukuoka-tateuri',
  '/floor-plan-compare',
  '/login',
  '/auth/callback',
];

const isPublicPage = PUBLIC_PATHS.some(p => location.pathname.startsWith(p));

useEffect(() => {
  if (isPublicPage) return; // 公開ページではスキップ
  checkAuth();
  warmupApi();
}, [checkAuth, isPublicPage]);
```

---

## 🔴 スクレイピング結果のプレビューURL（他社物件配信）

### 設計

- 他社物件配信のスクレイピング → Railwayの `/scrape-preview` エンドポイントを使用
- DBに `is_tateuri=false` で保存 → 建売専門HPには**絶対に表示されない**
- `preview_url` が返ってくるのでプレビュー確認ボタンが使える

### 建売専門HPとの分離

| | 建売専門HP | 他社物件配信 |
|---|---|---|
| Railwayエンドポイント | `/scrape` | `/scrape-preview` |
| `is_tateuri` | `true` | `false` |
| 建売専門HPに表示 | ✅ される | ❌ されない |
| プレビューURL | ✅ 生成 | ✅ 生成 |

**この分離を壊してはいけない。**

---

## 📝 変更履歴

| 日付 | 変更内容 | 結果 |
|------|---------|------|
| 2026-05-15 | vercel.jsonのrewriteで全アクセスをバックエンドSEO用HTMLに転送 | ❌ CSP違反でプレビュー表示不可 |
| 2026-05-15 | has条件でクローラーのみバックエンドに転送するよう修正 | ✅ 復旧 |
| 2026-05-15 | 他社物件配信を /scrape-preview エンドポイントに分離 | ✅ 建売専門HPと完全独立 |
| 2026-05-15 | 公開ページでcheckAuth/warmupApiをスキップ | ✅ コールドスタート問題解消 |

---

**最終更新日**: 2026年5月15日
**作成理由**: property-previewのCSP違反事故と、他社物件配信・建売専門HPの混在問題の再発防止

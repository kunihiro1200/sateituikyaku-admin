import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EmailService } from './EmailService';

interface TateuriProperty {
  slug: string;
  title: string | null;
  price: string | null;
  address: string | null;
  source_url: string;
}

interface PriceChangeResult {
  slug: string;
  title: string | null;
  address: string | null;
  oldPrice: string | null;
  newPrice: string | null;
  source_url: string;
}

interface SoldOutResult {
  slug: string;
  title: string | null;
  address: string | null;
  price: string | null;
  source_url: string;
}

/**
 * 建売専門HP掲載物件の価格変動チェックサービス
 * 毎日スクレイピングして値下げを検知し、メール通知する
 */
export class TateuriPriceCheckService {
  private supabase: SupabaseClient;
  private emailService: EmailService;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    this.emailService = new EmailService();
  }

  /**
   * 掲載中の全物件を再スクレイピングして価格変動をチェック
   */
  async checkPrices(): Promise<{ checked: number; changed: number; errors: number }> {
    console.log('[TateuriPriceCheck] 価格チェック開始');

    // 掲載中の建売物件を全件取得
    const { data: properties, error } = await this.supabase
      .from('property_previews')
      .select('slug, title, price, address, source_url')
      .eq('is_tateuri', true)
      .eq('is_active', true);

    if (error) {
      console.error('[TateuriPriceCheck] DB取得エラー:', error);
      throw error;
    }

    if (!properties || properties.length === 0) {
      console.log('[TateuriPriceCheck] 掲載中の物件なし');
      return { checked: 0, changed: 0, errors: 0 };
    }

    console.log(`[TateuriPriceCheck] ${properties.length}件をチェック`);

    const scrapeApiUrl = process.env.SCRAPE_API_URL || 'http://localhost:8765';
    const priceChanges: PriceChangeResult[] = [];
    const soldOuts: SoldOutResult[] = [];
    let errors = 0;

    for (const property of properties as TateuriProperty[]) {
      if (!property.source_url) {
        console.warn(`[TateuriPriceCheck] source_url なし: ${property.slug}`);
        continue;
      }

      try {
        // 再スクレイピング
        const res = await fetch(`${scrapeApiUrl}/scrape`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: property.source_url, is_tateuri: true, update_only: true }),
          signal: AbortSignal.timeout(30000),
        });

        // 404 or ページが存在しない → 売却済みとして自動削除
        if (res.status === 404 || res.status === 410) {
          console.log(`[TateuriPriceCheck] 売却済み検知（${res.status}）: ${property.slug}`);
          await this.supabase
            .from('property_previews')
            .update({ is_active: false })
            .eq('slug', property.slug);

          soldOuts.push({
            slug: property.slug,
            title: property.title,
            address: property.address,
            price: property.price,
            source_url: property.source_url,
          });
          continue;
        }

        if (!res.ok) {
          console.warn(`[TateuriPriceCheck] スクレイピング失敗 ${property.slug}: ${res.status}`);
          errors++;
          continue;
        }

        const result = await res.json();

        // スクレイピングサーバーが sold_out フラグを返す場合
        if (!result.success || !result.data) {
          console.warn(`[TateuriPriceCheck] データ取得失敗 ${property.slug}`);
          errors++;
          continue;
        }

        if (result.data.sold_out === true) {
          console.log(`[TateuriPriceCheck] 売却済み検知（sold_out flag）: ${property.slug}`);
          await this.supabase
            .from('property_previews')
            .update({ is_active: false })
            .eq('slug', property.slug);

          soldOuts.push({
            slug: property.slug,
            title: property.title,
            address: property.address,
            price: property.price,
            source_url: property.source_url,
          });
          continue;
        }

        const newPrice = result.data.price || null;
        const oldPrice = property.price;

        // 価格が変わっていたらDBを更新
        if (newPrice !== oldPrice) {
          console.log(`[TateuriPriceCheck] 価格変動検知: ${property.slug} ${oldPrice} → ${newPrice}`);

          await this.supabase
            .from('property_previews')
            .update({
              price: newPrice,
              title: result.data.title || property.title,
              updated_at: new Date().toISOString(),
            })
            .eq('slug', property.slug);

          priceChanges.push({
            slug: property.slug,
            title: property.title,
            address: property.address,
            oldPrice,
            newPrice,
            source_url: property.source_url,
          });
        }
      } catch (err: any) {
        console.error(`[TateuriPriceCheck] エラー ${property.slug}:`, err.message);
        errors++;
      }
    }

    // 値下げ or 売却済みがあればメール通知
    const priceDowns = priceChanges.filter(c => isPriceDown(c.oldPrice, c.newPrice));
    if (priceDowns.length > 0 || soldOuts.length > 0) {
      await this.sendNotification(priceDowns, soldOuts);
    }

    console.log(`[TateuriPriceCheck] 完了: チェック=${properties.length}件, 値下げ=${priceDowns.length}件, 売却済み=${soldOuts.length}件, エラー=${errors}件`);
    return { checked: properties.length, changed: priceChanges.length, errors };
  }

  /**
   * 値下げ・売却済み通知メールをまとめて送信
   */
  private async sendNotification(priceDowns: PriceChangeResult[], soldOuts: SoldOutResult[]): Promise<void> {
    const notifyEmail = process.env.TATEURI_NOTIFY_EMAIL || 'tenant@ifoo-oita.com';
    const sections: string[] = [];

    if (priceDowns.length > 0) {
      const lines = priceDowns.map(c => {
        const title = cleanTitle(c.title) || c.address || '物件';
        return [
          `■ ${title}`,
          `  住所: ${c.address || '不明'}`,
          `  変更前: ${c.oldPrice || '不明'}`,
          `  変更後: ${c.newPrice || '不明'}`,
          `  URL: https://sateituikyaku-admin-frontend.vercel.app/property-preview/${c.slug}`,
        ].join('\n');
      });
      sections.push(`【値下げ物件 ${priceDowns.length}件】\n${lines.join('\n\n')}`);
    }

    if (soldOuts.length > 0) {
      const lines = soldOuts.map(c => {
        const title = cleanTitle(c.title) || c.address || '物件';
        return [
          `■ ${title}`,
          `  住所: ${c.address || '不明'}`,
          `  価格: ${c.price || '不明'}`,
          `  ※ 掲載から自動削除しました`,
          `  元URL: ${c.source_url}`,
        ].join('\n');
      });
      sections.push(`【売却済み（自動削除）${soldOuts.length}件】\n${lines.join('\n\n')}`);
    }

    const subject = [
      priceDowns.length > 0 ? `値下げ${priceDowns.length}件` : '',
      soldOuts.length > 0 ? `売却済み${soldOuts.length}件` : '',
    ].filter(Boolean).join('・');

    const body = [
      `建売専門HPの物件に変動がありました。`,
      ``,
      ...sections,
      ``,
      `管理画面: https://sateituikyaku-admin-frontend.vercel.app/tateuri/manage`,
    ].join('\n');

    try {
      await this.emailService.sendEmail({
        to: [notifyEmail],
        subject: `【建売専門HP】${subject}`,
        body,
      });
      console.log(`[TateuriPriceCheck] 通知メール送信完了`);
    } catch (err: any) {
      console.error('[TateuriPriceCheck] メール送信エラー:', err.message);
    }
  }
}

/**
 * 価格文字列から数値を抽出（万円単位）
 * 例: "3,790万円" → 3790
 */
function parsePrice(price: string | null): number | null {
  if (!price) return null;
  const match = price.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*万/);
  if (match) return parseFloat(match[1]);
  return null;
}

/**
 * 値下げかどうか判定
 */
function isPriceDown(oldPrice: string | null, newPrice: string | null): boolean {
  const old = parsePrice(oldPrice);
  const next = parsePrice(newPrice);
  if (old === null || next === null) return false;
  return next < old;
}

/**
 * タイトルのクリーニング
 */
function cleanTitle(title: string | null): string {
  return (title || '').replace(/\[\d+\].+$/, '').trim();
}

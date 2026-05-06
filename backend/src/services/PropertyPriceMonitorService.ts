import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

interface PriceChange {
  buyerNumber: string;
  buyerName: string;
  propertyUrl: string;
  previousPrice: number | null;
  currentPrice: number | null;
  changeType: 'price_down' | 'price_up' | 'sold' | 'deleted' | 'new';
  changeAmount?: number;
  changePercent?: number;
}

interface ScrapingResult {
  price?: number;
  status: 'available' | 'sold' | 'deleted';
}

export class PropertyPriceMonitorService {
  private supabase = createClient(supabaseUrl, supabaseServiceKey);
  private scrapingServerUrl = process.env.SCRAPING_SERVER_URL || 'https://sateituikyaku-scrape-server-production.up.railway.app';

  /**
   * 全買主の建売専門HPをチェックして価格変動を検知
   */
  async checkAllPriceChanges(): Promise<PriceChange[]> {
    console.log('[PropertyPriceMonitor] 価格変動チェック開始');

    // 建売専門HPが設定されている買主を取得
    const { data: buyers, error } = await this.supabase
      .from('buyers')
      .select('buyer_number, name, athome_url')
      .not('athome_url', 'is', null)
      .neq('athome_url', '');

    if (error) {
      console.error('[PropertyPriceMonitor] 買主取得エラー:', error);
      throw error;
    }

    if (!buyers || buyers.length === 0) {
      console.log('[PropertyPriceMonitor] 建売専門HPが設定されている買主が見つかりません');
      return [];
    }

    console.log(`[PropertyPriceMonitor] ${buyers.length}件の買主をチェック`);

    const allChanges: PriceChange[] = [];

    for (const buyer of buyers) {
      try {
        const changes = await this.checkBuyerPriceChanges(
          buyer.buyer_number,
          buyer.name,
          buyer.athome_url
        );
        allChanges.push(...changes);
      } catch (error) {
        console.error(`[PropertyPriceMonitor] 買主 ${buyer.name} のチェックエラー:`, error);
        // エラーが発生しても他の買主のチェックは続行
      }
    }

    console.log(`[PropertyPriceMonitor] 価格変動チェック完了: ${allChanges.length}件の変更`);
    return allChanges;
  }

  /**
   * 特定の買主の価格変動をチェック
   */
  private async checkBuyerPriceChanges(
    buyerNumber: string,
    buyerName: string,
    propertyUrl: string
  ): Promise<PriceChange[]> {
    console.log(`[PropertyPriceMonitor] 買主 ${buyerName} (${propertyUrl}) をチェック`);

    // 最新の価格情報を取得
    const { data: latestHistory } = await this.supabase
      .from('property_price_history')
      .select('*')
      .eq('buyer_number', buyerNumber)
      .eq('property_url', propertyUrl)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    // スクレイピングサーバーで現在の価格を取得
    const currentData = await this.scrapePropertyPrice(propertyUrl);

    // 価格履歴に保存
    await this.supabase.from('property_price_history').insert({
      buyer_number: buyerNumber,
      property_url: propertyUrl,
      price: currentData.price || null,
      status: currentData.status,
    });

    // 変動を検知
    const changes: PriceChange[] = [];

    if (!latestHistory) {
      // 初回チェック
      if (currentData.price) {
        changes.push({
          buyerNumber,
          buyerName,
          propertyUrl,
          previousPrice: null,
          currentPrice: currentData.price,
          changeType: 'new',
        });
      }
    } else {
      // 価格変動をチェック
      const previousPrice = latestHistory.price;
      const currentPrice = currentData.price;

      if (currentData.status === 'deleted') {
        changes.push({
          buyerNumber,
          buyerName,
          propertyUrl,
          previousPrice,
          currentPrice: null,
          changeType: 'deleted',
        });
      } else if (currentData.status === 'sold') {
        changes.push({
          buyerNumber,
          buyerName,
          propertyUrl,
          previousPrice,
          currentPrice,
          changeType: 'sold',
        });
      } else if (previousPrice && currentPrice && previousPrice !== currentPrice) {
        const changeAmount = currentPrice - previousPrice;
        const changePercent = (changeAmount / previousPrice) * 100;

        changes.push({
          buyerNumber,
          buyerName,
          propertyUrl,
          previousPrice,
          currentPrice,
          changeType: changeAmount < 0 ? 'price_down' : 'price_up',
          changeAmount,
          changePercent,
        });
      }
    }

    return changes;
  }

  /**
   * スクレイピングサーバーで物件価格を取得
   */
  private async scrapePropertyPrice(url: string): Promise<ScrapingResult> {
    try {
      console.log(`[PropertyPriceMonitor] スクレイピング開始: ${url}`);

      const response = await axios.post(
        `${this.scrapingServerUrl}/scrape`,
        { url },
        { timeout: 60000 } // 60秒タイムアウト
      );

      const data = response.data?.data || response.data;

      // 価格を抽出
      let price: number | undefined;
      if (data.price_numeric) {
        // スクレイピングサーバーが数値化した価格
        price = data.price_numeric;
      } else if (data.price) {
        // 価格文字列から数値を抽出
        price = this.extractPrice(data.price);
      }

      // ステータスを判定
      let status: 'available' | 'sold' | 'deleted' = 'available';
      if (response.status === 404 || data.error) {
        status = 'deleted';
      } else if (data.is_sold || data.sold || data.status === 'sold') {
        status = 'sold';
      }

      console.log(`[PropertyPriceMonitor] スクレイピング完了: 価格=${price}, ステータス=${status}`);

      return { price, status };
    } catch (error: any) {
      console.error('[PropertyPriceMonitor] スクレイピングエラー:', error.message);

      // 404エラーの場合は削除と判定
      if (error.response?.status === 404) {
        return { status: 'deleted' };
      }

      // その他のエラーは再スロー
      throw error;
    }
  }

  /**
   * 価格文字列から数値を抽出
   * 例: "3,980万円" → 39800000
   */
  private extractPrice(priceText: string): number | undefined {
    // "3,980万円" のようなパターンをマッチ
    const match = priceText.match(/([0-9,]+)万円/);
    if (match) {
      const manYen = parseFloat(match[1].replace(/,/g, ''));
      return Math.round(manYen * 10000);
    }

    // "39,800,000円" のようなパターンをマッチ
    const match2 = priceText.match(/([0-9,]+)円/);
    if (match2) {
      return parseInt(match2[1].replace(/,/g, ''), 10);
    }

    return undefined;
  }

  /**
   * 価格変動をメールで通知
   */
  async sendPriceChangeNotification(changes: PriceChange[]): Promise<void> {
    if (changes.length === 0) {
      console.log('[PropertyPriceMonitor] 通知する変更がありません');
      return;
    }

    console.log(`[PropertyPriceMonitor] ${changes.length}件の変更を通知`);

    const emailBody = this.buildEmailBody(changes);

    // メール送信（既存のメール送信サービスを使用）
    const { EmailService } = await import('./EmailService');
    const emailService = new EmailService();

    await emailService.sendEmail({
      to: ['tenant@ifoo-oita.com'],
      subject: `【価格変動通知】建売専門HP 価格変動 ${changes.length}件`,
      body: emailBody,
    });

    console.log('[PropertyPriceMonitor] メール送信完了');
  }

  /**
   * メール本文を生成
   */
  private buildEmailBody(changes: PriceChange[]): string {
    let body = '建売専門HPの価格変動をお知らせします。\n\n';
    body += `変更件数: ${changes.length}件\n`;
    body += '=' .repeat(60) + '\n\n';

    for (const change of changes) {
      body += `買主名: ${change.buyerName}\n`;
      body += `物件URL: ${change.propertyUrl}\n`;

      switch (change.changeType) {
        case 'price_down':
          body += `変更内容: 値下げ 🔽\n`;
          body += `前回価格: ${this.formatPrice(change.previousPrice!)}円\n`;
          body += `現在価格: ${this.formatPrice(change.currentPrice!)}円\n`;
          body += `値下げ額: ${this.formatPrice(Math.abs(change.changeAmount!))}円 (${change.changePercent!.toFixed(1)}%)\n`;
          break;

        case 'price_up':
          body += `変更内容: 値上げ 🔼\n`;
          body += `前回価格: ${this.formatPrice(change.previousPrice!)}円\n`;
          body += `現在価格: ${this.formatPrice(change.currentPrice!)}円\n`;
          body += `値上げ額: ${this.formatPrice(change.changeAmount!)}円 (+${change.changePercent!.toFixed(1)}%)\n`;
          break;

        case 'sold':
          body += `変更内容: 売却済み ✅\n`;
          if (change.previousPrice) {
            body += `最終価格: ${this.formatPrice(change.previousPrice)}円\n`;
          }
          break;

        case 'deleted':
          body += `変更内容: 物件削除 ❌\n`;
          if (change.previousPrice) {
            body += `最終価格: ${this.formatPrice(change.previousPrice)}円\n`;
          }
          break;

        case 'new':
          body += `変更内容: 新規追加 🆕\n`;
          body += `価格: ${this.formatPrice(change.currentPrice!)}円\n`;
          break;
      }

      body += '\n' + '-'.repeat(60) + '\n\n';
    }

    body += '\n※このメールは自動送信されています。\n';

    return body;
  }

  /**
   * 価格をフォーマット（3桁区切り）
   */
  private formatPrice(price: number): string {
    return price.toLocaleString('ja-JP');
  }
}

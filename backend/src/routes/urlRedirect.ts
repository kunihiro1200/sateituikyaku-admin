import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

/**
 * 短縮URLのリダイレクト先を取得するAPI
 * フロントエンドからのCORS問題を回避するため
 */
router.get('/resolve', async (req: Request, res: Response) => {
  const urlParam = req.query.url;
  
  if (!urlParam || typeof urlParam !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  try {
    console.log('🔗 Resolving shortened URL:', urlParam);
    
    // GETリクエストでリダイレクトを追跡して最終URLを取得
    const response = await axios.get(urlParam, {
      maxRedirects: 10,
      validateStatus: (status) => status >= 200 && status < 400,
      // レスポンスボディは不要なので最小限に
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; URLResolver/1.0)',
      },
    });
    
    // リダイレクト後の最終URLを複数の方法で取得
    const redirectedUrl = 
      response.request?.res?.responseUrl ||    // Node.js http module
      response.request?._redirectable?._currentUrl ||  // follow-redirects module
      response.request?.responseURL ||         // XMLHttpRequest style
      urlParam;
    
    console.log('✅ Redirected URL:', redirectedUrl);
    
    res.json({
      originalUrl: urlParam,
      redirectedUrl: redirectedUrl,
    });
  } catch (error: any) {
    // リダイレクトエラーでもLocationヘッダーから取得を試みる
    if (error.response?.headers?.location) {
      const locationUrl = error.response.headers.location;
      console.log('↪️ Got redirect from error response Location header:', locationUrl);
      return res.json({
        originalUrl: urlParam,
        redirectedUrl: locationUrl,
      });
    }
    
    // axiosのリダイレクト追跡で最終URLが取れる場合
    if (error.request?._redirectable?._currentUrl) {
      const fallbackUrl = error.request._redirectable._currentUrl;
      console.log('↪️ Got redirect from _redirectable:', fallbackUrl);
      return res.json({
        originalUrl: urlParam,
        redirectedUrl: fallbackUrl,
      });
    }
    
    console.error('❌ Error resolving URL:', error.message);
    res.status(500).json({
      error: 'Failed to resolve URL',
      message: error.message,
    });
  }
});

export default router;

// Vercel serverless function entry point (TypeScript)
// This file directly imports and runs the Express app

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel環境であることを明示
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

let app: any;

async function getApp() {
  if (!app) {
    const appModule = await import('../src/index');
    app = appModule.default;
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const expressApp = await getApp();
    return expressApp(req, res);
  } catch (error: any) {
    console.error('Error in Vercel handler:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

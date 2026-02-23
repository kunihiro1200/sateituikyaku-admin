// Vercel serverless function entry point (TypeScript)
// Minimal test version to debug 404 errors

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`📥 ${req.method} ${req.url}`);
  console.log('🔍 Query:', req.query);
  console.log('🔍 Path:', req.url);
  
  // Simple test response
  return res.status(200).json({
    message: 'Vercel function is working!',
    method: req.method,
    url: req.url,
    query: req.query,
    timestamp: new Date().toISOString()
  });
}

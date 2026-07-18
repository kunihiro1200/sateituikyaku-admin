"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = createRateLimiter;
const supabase_js_1 = require("@supabase/supabase-js");
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
/**
 * Rate limiter middleware using Supabase for storage
 * Tracks requests by IP address
 */
function createRateLimiter(config) {
    return async (req, res, next) => {
        try {
            // Get client IP address
            const ip = req.ip || req.socket.remoteAddress || 'unknown';
            // Create a unique key for this IP and endpoint
            const key = `rate_limit:${req.path}:${ip}`;
            const now = Date.now();
            const windowStart = now - config.windowMs;
            // Clean up old entries and count recent requests
            const { data: recentRequests, error: fetchError } = await supabase
                .from('rate_limit_log')
                .select('id')
                .eq('key', key)
                .gte('timestamp', new Date(windowStart).toISOString());
            if (fetchError) {
                console.error('Rate limiter fetch error:', fetchError);
                // On error, allow the request to proceed
                return next();
            }
            const requestCount = recentRequests?.length || 0;
            // Check if rate limit exceeded
            if (requestCount >= config.maxRequests) {
                return res.status(429).json({
                    success: false,
                    message: 'リクエストが多すぎます。しばらく時間をおいてから再度お試しください。',
                    retryAfter: Math.ceil(config.windowMs / 1000 / 60) // minutes
                });
            }
            // Log this request
            const { error: insertError } = await supabase
                .from('rate_limit_log')
                .insert({
                key,
                ip,
                path: req.path,
                timestamp: new Date(now).toISOString()
            });
            if (insertError) {
                console.error('Rate limiter insert error:', insertError);
                // On error, allow the request to proceed
            }
            // Clean up old entries (older than window)
            await supabase
                .from('rate_limit_log')
                .delete()
                .eq('key', key)
                .lt('timestamp', new Date(windowStart).toISOString());
            next();
        }
        catch (error) {
            console.error('Rate limiter error:', error);
            // On error, allow the request to proceed
            next();
        }
    };
}

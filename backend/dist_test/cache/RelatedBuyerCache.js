"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.relatedBuyerCache = exports.RelatedBuyerCache = void 0;
/**
 * Simple in-memory cache for related buyers
 * TTL: 5 minutes (300000 ms)
 */
class RelatedBuyerCache {
    constructor() {
        this.cache = new Map();
        this.TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
    }
    /**
     * Get cached related buyers for a buyer ID
     * @param buyerId - The buyer ID
     * @returns Cached related buyers or null if not found/expired
     */
    get(buyerId) {
        const entry = this.cache.get(buyerId);
        if (!entry) {
            console.log(`[Cache] MISS for buyer ${buyerId}`);
            return null;
        }
        const now = Date.now();
        const age = now - entry.timestamp;
        if (age > this.TTL) {
            console.log(`[Cache] EXPIRED for buyer ${buyerId} (age: ${age}ms)`);
            this.cache.delete(buyerId);
            return null;
        }
        console.log(`[Cache] HIT for buyer ${buyerId} (age: ${age}ms)`);
        return entry.data;
    }
    /**
     * Set cached related buyers for a buyer ID
     * @param buyerId - The buyer ID
     * @param data - The related buyers data
     */
    set(buyerId, data) {
        const entry = {
            data,
            timestamp: Date.now()
        };
        this.cache.set(buyerId, entry);
        console.log(`[Cache] SET for buyer ${buyerId} (${data.length} related buyers)`);
    }
    /**
     * Invalidate cache for a specific buyer ID
     * @param buyerId - The buyer ID
     */
    invalidate(buyerId) {
        const deleted = this.cache.delete(buyerId);
        if (deleted) {
            console.log(`[Cache] INVALIDATED for buyer ${buyerId}`);
        }
    }
    /**
     * Invalidate all cache entries
     */
    invalidateAll() {
        const size = this.cache.size;
        this.cache.clear();
        console.log(`[Cache] INVALIDATED ALL (${size} entries cleared)`);
    }
    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        for (const [buyerId, entry] of this.cache.entries()) {
            const age = now - entry.timestamp;
            if (age > this.TTL) {
                this.cache.delete(buyerId);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`[Cache] CLEANUP: Removed ${cleaned} expired entries`);
        }
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            ttl: this.TTL
        };
    }
}
exports.RelatedBuyerCache = RelatedBuyerCache;
// Singleton instance
exports.relatedBuyerCache = new RelatedBuyerCache();
// Run cleanup every minute
setInterval(() => {
    exports.relatedBuyerCache.cleanup();
}, 60 * 1000);

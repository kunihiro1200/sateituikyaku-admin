with open('backend/src/services/BuyerService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. ファイル先頭のimport直後にモジュールレベルキャッシュを追加
old_imports_end = """import { STATUS_DEFINITIONS } from '../config/buyer-status-definitions';"""

new_imports_end = """import { STATUS_DEFINITIONS } from '../config/buyer-status-definitions';

// モジュールレベルのキャッシュ（Vercelサーバーレス環境でもインスタンス間で共有される）
// インスタンス変数だとリクエストごとにリセットされるため、モジュールレベルに移動
let _moduleLevelStatusCache: {
  buyers: any[];
  computedAt: number;
} | null = null;
const _MODULE_STATUS_CACHE_TTL = 10 * 60 * 1000; // 10分"""

text = text.replace(old_imports_end, new_imports_end)

# 2. クラス内のインスタンス変数定義を削除（コメントごと）
old_instance_cache = """  // ステータス計算結果のキャッシュ（TTL: 10分）
  private statusCache: {
    buyers: any[];
    computedAt: number;
  } | null = null;
  private readonly STATUS_CACHE_TTL = 10 * 60 * 1000; // 10分"""

new_instance_cache = """  // ステータス計算結果のキャッシュはモジュールレベル変数 _moduleLevelStatusCache を使用
  // （Vercelサーバーレス環境ではインスタンス変数はリクエストごとにリセットされるため）"""

text = text.replace(old_instance_cache, new_instance_cache)

# 3. fetchAllBuyersWithStatus内のthis.statusCache参照をモジュール変数に変更
old_fetch = """  private async fetchAllBuyersWithStatus(): Promise<any[]> {
    const now = Date.now();
    if (this.statusCache && (now - this.statusCache.computedAt) < this.STATUS_CACHE_TTL) {
      return this.statusCache.buyers;
    }

    const allBuyers = await this.fetchAllBuyers();

    const buyers = allBuyers.map(buyer => {
      try {
        const statusResult = calculateBuyerStatus(buyer);
        return { ...buyer, calculated_status: statusResult.status, status_priority: statusResult.priority };
      } catch {
        return { ...buyer, calculated_status: '', status_priority: 999 };
      }
    });

    this.statusCache = { buyers, computedAt: now };
    return buyers;
  }"""

new_fetch = """  private async fetchAllBuyersWithStatus(): Promise<any[]> {
    const now = Date.now();
    if (_moduleLevelStatusCache && (now - _moduleLevelStatusCache.computedAt) < _MODULE_STATUS_CACHE_TTL) {
      return _moduleLevelStatusCache.buyers;
    }

    const allBuyers = await this.fetchAllBuyers();

    const buyers = allBuyers.map(buyer => {
      try {
        const statusResult = calculateBuyerStatus(buyer);
        return { ...buyer, calculated_status: statusResult.status, status_priority: statusResult.priority };
      } catch {
        return { ...buyer, calculated_status: '', status_priority: 999 };
      }
    });

    _moduleLevelStatusCache = { buyers, computedAt: now };
    return buyers;
  }"""

text = text.replace(old_fetch, new_fetch)

# 4. getStatusCategoriesOnly内のthis.statusCache参照を修正
old_from_cache = """    const fromCache = !!(this.statusCache && (now - this.statusCache.computedAt) < this.STATUS_CACHE_TTL);"""
new_from_cache = """    const fromCache = !!(_moduleLevelStatusCache && (now - _moduleLevelStatusCache.computedAt) < _MODULE_STATUS_CACHE_TTL);"""

text = text.replace(old_from_cache, new_from_cache)

# 5. syncボタン押下時のキャッシュ無効化（もしあれば）を確認・修正
# this.statusCache = null のような箇所を探す
if 'this.statusCache = null' in text:
    text = text.replace('this.statusCache = null', '_moduleLevelStatusCache = null')
    print('Found and replaced: this.statusCache = null')

if 'this.statusCache = null;' in text:
    text = text.replace('this.statusCache = null;', '_moduleLevelStatusCache = null;')
    print('Found and replaced: this.statusCache = null;')

with open('backend/src/services/BuyerService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
print('変更内容:')
print('1. statusCacheをモジュールレベル変数に移動（Vercelサーバーレス対応）')
print('2. fetchAllBuyersWithStatus内の参照を更新')
print('3. getStatusCategoriesOnly内の参照を更新')

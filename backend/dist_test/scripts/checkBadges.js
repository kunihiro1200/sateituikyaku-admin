"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// .envファイルを読み込む
dotenv.config({ path: path.join(__dirname, '../../.env') });
async function checkBadges() {
    const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    console.log('Checking property counts...\n');
    // atbb_statusの種類を確認
    const { data: allData, error } = await supabase
        .from('property_listings')
        .select('atbb_status, property_type');
    if (error) {
        console.error('Error:', error);
        process.exit(1);
    }
    console.log('Total properties:', allData?.length);
    // atbb_statusの種類
    const statuses = [...new Set(allData?.map(d => d.atbb_status) || [])];
    console.log('\natbb_statusの種類:');
    for (const status of statuses) {
        const count = allData?.filter(d => d.atbb_status === status).length || 0;
        console.log(`  ${status || '(null)'}: ${count}件`);
    }
    // 成約済み以外の件数（atbb_statusで判定）
    const notSeiyakuCount = allData?.filter(d => d.atbb_status !== '成約済み' &&
        d.atbb_status !== '成約済' &&
        d.atbb_status !== null).length || 0;
    console.log(`\n成約済み以外: ${notSeiyakuCount}件`);
    // 公開中の件数
    const koukaiCount = allData?.filter(d => d.atbb_status === '公開中').length || 0;
    console.log(`公開中: ${koukaiCount}件`);
    process.exit(0);
}
checkBadges();

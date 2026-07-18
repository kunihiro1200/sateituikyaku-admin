"use strict";
/**
 * 座標の妥当性を検証し、問題がある場合は自動修正するスクリプト
 *
 * 検証内容:
 * 1. 逆ジオコーディングで座標から住所を取得
 * 2. 元の住所と比較して、大きく異なる場合は警告
 * 3. 住所を再ジオコーディングして座標を修正
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const supabase_js_1 = require("@supabase/supabase-js");
const axios_1 = __importDefault(require("axios"));
// .envファイルを直接読み込む
const envPath = path_1.default.join(__dirname, '../../.env');
const envContent = fs_1.default.readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');
let googleMapsApiKey = '';
for (const line of envLines) {
    if (line.startsWith('GOOGLE_MAPS_API_KEY=')) {
        googleMapsApiKey = line.split('=')[1].trim();
        break;
    }
}
// 他の環境変数は通常通り読み込む
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env.local'), override: true });
/**
 * 逆ジオコーディング: 座標から住所を取得
 */
async function reverseGeocode(lat, lng) {
    try {
        const response = await axios_1.default.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                latlng: `${lat},${lng}`,
                key: googleMapsApiKey,
                language: 'ja',
                region: 'jp',
            },
        });
        if (response.data.status === 'OK' && response.data.results.length > 0) {
            return response.data.results[0].formatted_address;
        }
        return null;
    }
    catch (error) {
        console.error('逆ジオコーディングエラー:', error);
        return null;
    }
}
/**
 * ジオコーディング: 住所から座標を取得
 */
async function geocode(address, sellerPrefix) {
    try {
        // AAプレフィックスの場合は「大分県」を自動追加
        let fullAddress = address;
        if (!address.includes('大分県') && (!sellerPrefix || sellerPrefix === 'AA')) {
            fullAddress = `大分県${address}`;
        }
        const response = await axios_1.default.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: fullAddress,
                key: googleMapsApiKey,
                language: 'ja',
                region: 'jp',
            },
        });
        if (response.data.status === 'OK' && response.data.results.length > 0) {
            const location = response.data.results[0].geometry.location;
            return { lat: location.lat, lng: location.lng };
        }
        return null;
    }
    catch (error) {
        console.error('ジオコーディングエラー:', error);
        return null;
    }
}
/**
 * Haversine公式で2点間の距離を計算（km）
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球の半径（km）
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}
/**
 * 住所の類似度を簡易的にチェック
 */
function isSimilarAddress(address1, address2) {
    // 「大分県」「日本」「〒」などのプレフィックスを削除
    const clean1 = address1.replace(/^(日本、)?〒\d{3}-\d{4}\s*/, '').replace(/^大分県/, '');
    const clean2 = address2.replace(/^(日本、)?〒\d{3}-\d{4}\s*/, '').replace(/^大分県/, '');
    // 市区町村名が一致するか確認
    const city1 = clean1.match(/^[^市区町村]+[市区町村]/)?.[0];
    const city2 = clean2.match(/^[^市区町村]+[市区町村]/)?.[0];
    if (city1 !== city2) {
        return false;
    }
    // 町名が含まれているか確認（簡易的）
    const parts1 = clean1.split(/[0-9０-９]/)[0]; // 番地の前まで
    const parts2 = clean2.split(/[0-9０-９]/)[0];
    // 一方が他方に含まれているか
    return parts1.includes(parts2) || parts2.includes(parts1);
}
/**
 * 座標を検証
 */
async function validateCoordinates(sellerNumber, propertyAddress, latitude, longitude) {
    console.log(`\n検証中: ${sellerNumber} - ${propertyAddress}`);
    // 1. 逆ジオコーディング: 座標から住所を取得
    const reverseAddress = await reverseGeocode(latitude, longitude);
    if (!reverseAddress) {
        console.log('  ⚠️ 逆ジオコーディング失敗');
        return {
            sellerNumber,
            propertyAddress,
            currentLat: latitude,
            currentLng: longitude,
            reverseGeocodedAddress: '取得失敗',
            isValid: false,
        };
    }
    console.log(`  現在の座標が示す住所: ${reverseAddress}`);
    // 2. 住所の類似度をチェック
    const isSimilar = isSimilarAddress(propertyAddress, reverseAddress);
    if (isSimilar) {
        console.log('  ✅ 座標は正しい');
        return {
            sellerNumber,
            propertyAddress,
            currentLat: latitude,
            currentLng: longitude,
            reverseGeocodedAddress: reverseAddress,
            isValid: true,
        };
    }
    console.log('  ⚠️ 座標が住所と一致しない可能性があります');
    // 3. 住所を再ジオコーディング
    const sellerPrefix = sellerNumber.match(/^[A-Z]+/)?.[0];
    const newCoords = await geocode(propertyAddress, sellerPrefix);
    if (!newCoords) {
        console.log('  ❌ 再ジオコーディング失敗');
        return {
            sellerNumber,
            propertyAddress,
            currentLat: latitude,
            currentLng: longitude,
            reverseGeocodedAddress: reverseAddress,
            isValid: false,
        };
    }
    // 4. 距離を計算
    const distance = calculateDistance(latitude, longitude, newCoords.lat, newCoords.lng);
    console.log(`  距離: ${distance.toFixed(2)}km`);
    // 5. 新しい座標の逆ジオコーディング
    const newReverseAddress = await reverseGeocode(newCoords.lat, newCoords.lng);
    console.log(`  新しい座標が示す住所: ${newReverseAddress}`);
    // 6. 閾値チェック（1km以上ずれている場合は要修正）
    if (distance > 1.0) {
        console.log('  ❌ 座標が1km以上ずれています（修正推奨）');
        return {
            sellerNumber,
            propertyAddress,
            currentLat: latitude,
            currentLng: longitude,
            reverseGeocodedAddress: reverseAddress,
            isValid: false,
            distance,
            suggestedLat: newCoords.lat,
            suggestedLng: newCoords.lng,
            suggestedAddress: newReverseAddress || undefined,
        };
    }
    console.log('  ✅ 座標は許容範囲内');
    return {
        sellerNumber,
        propertyAddress,
        currentLat: latitude,
        currentLng: longitude,
        reverseGeocodedAddress: reverseAddress,
        isValid: true,
        distance,
    };
}
/**
 * メイン処理
 */
async function main() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Supabase環境変数が設定されていません');
        process.exit(1);
    }
    if (!googleMapsApiKey) {
        console.error('❌ GOOGLE_MAPS_API_KEY が設定されていません');
        process.exit(1);
    }
    const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    console.log('=== 座標検証・修正スクリプト ===');
    console.log('');
    // コマンドライン引数で売主番号を指定可能
    const targetSellerNumber = process.argv[2];
    let query = supabase
        .from('sellers')
        .select('seller_number, property_address, latitude, longitude')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);
    if (targetSellerNumber) {
        console.log(`対象: ${targetSellerNumber}`);
        query = query.eq('seller_number', targetSellerNumber);
    }
    else {
        console.log('対象: 全売主（座標が設定されているもの）');
        // 最新100件に制限（全件チェックする場合はこの行を削除）
        query = query.order('created_at', { ascending: false }).limit(100);
    }
    const { data: sellers, error } = await query;
    if (error) {
        console.error('❌ データ取得エラー:', error);
        process.exit(1);
    }
    if (!sellers || sellers.length === 0) {
        console.log('対象データが見つかりませんでした');
        process.exit(0);
    }
    console.log(`検証対象: ${sellers.length}件`);
    console.log('');
    const results = [];
    const invalidResults = [];
    for (let i = 0; i < sellers.length; i++) {
        const seller = sellers[i];
        // レート制限対策（200ms待機）
        if (i > 0) {
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
        const result = await validateCoordinates(seller.seller_number, seller.property_address, seller.latitude, seller.longitude);
        results.push(result);
        if (!result.isValid && result.suggestedLat && result.suggestedLng) {
            invalidResults.push(result);
        }
    }
    // 結果サマリー
    console.log('\n');
    console.log('=== 検証結果サマリー ===');
    console.log(`総数: ${results.length}件`);
    console.log(`正常: ${results.filter((r) => r.isValid).length}件`);
    console.log(`要修正: ${invalidResults.length}件`);
    console.log('');
    if (invalidResults.length > 0) {
        console.log('=== 修正が必要な売主 ===');
        for (const result of invalidResults) {
            console.log(`\n${result.sellerNumber} - ${result.propertyAddress}`);
            console.log(`  現在の座標: ${result.currentLat}, ${result.currentLng}`);
            console.log(`  現在の座標が示す住所: ${result.reverseGeocodedAddress}`);
            console.log(`  推奨座標: ${result.suggestedLat}, ${result.suggestedLng}`);
            console.log(`  推奨座標が示す住所: ${result.suggestedAddress}`);
            console.log(`  距離: ${result.distance?.toFixed(2)}km`);
            console.log(`  現在のURL: https://www.google.com/maps?q=${result.currentLat},${result.currentLng}`);
            console.log(`  修正後URL: https://www.google.com/maps?q=${result.suggestedLat},${result.suggestedLng}`);
        }
        console.log('\n');
        console.log('=== 自動修正 ===');
        console.log('上記の座標を自動修正しますか？ (y/N)');
        // 標準入力から確認を取得
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question('', async (answer) => {
            if (answer.toLowerCase() === 'y') {
                console.log('\n修正を実行します...');
                for (const result of invalidResults) {
                    console.log(`\n修正中: ${result.sellerNumber}`);
                    const { error: updateError } = await supabase
                        .from('sellers')
                        .update({
                        latitude: result.suggestedLat,
                        longitude: result.suggestedLng,
                    })
                        .eq('seller_number', result.sellerNumber);
                    if (updateError) {
                        console.log(`  ❌ 更新失敗: ${updateError.message}`);
                    }
                    else {
                        console.log(`  ✅ 更新成功`);
                    }
                }
                console.log('\n✅ 全ての修正が完了しました');
            }
            else {
                console.log('\n修正をキャンセルしました');
            }
            rl.close();
            process.exit(0);
        });
    }
    else {
        console.log('✅ 全ての座標が正常です');
        process.exit(0);
    }
}
main().catch((error) => {
    console.error('❌ 実行中にエラーが発生しました:', error);
    process.exit(1);
});

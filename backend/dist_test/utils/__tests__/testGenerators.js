"use strict";
/**
 * fast-check用のカスタムArbitraryジェネレーター
 * プロパティベーステストで使用するランダムデータ生成
 */
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
exports.dateRangeArbitrary = exports.paginationArbitrary = exports.searchQueryArbitrary = exports.lossFactorsArbitrary = exports.propertyDataArbitrary = exports.valuationArbitrary = exports.activityArbitrary = exports.activityTypeArbitrary = exports.sellerArbitrary = exports.meetingStatusArbitrary = exports.exclusionActionArbitrary = exports.pinrichStatusArbitrary = exports.mailStatusArbitrary = exports.appraisalMethodArbitrary = exports.contactMethodArbitrary = exports.sellerSituationArbitrary = exports.structureArbitrary = exports.confidenceArbitrary = exports.sellerStatusArbitrary = exports.propertyTypeArbitrary = exports.addressArbitrary = exports.emailArbitrary = exports.phoneNumberArbitrary = exports.sellerNumberArbitrary = void 0;
const fc = __importStar(require("fast-check"));
const types_1 = require("../../types");
/**
 * 売主番号を生成（AA + 5桁の数字）
 */
const sellerNumberArbitrary = () => {
    return fc.integer({ min: 1, max: 99999 }).map(num => `AA${num.toString().padStart(5, '0')}`);
};
exports.sellerNumberArbitrary = sellerNumberArbitrary;
/**
 * 日本の電話番号を生成
 */
const phoneNumberArbitrary = () => {
    return fc.oneof(
    // 携帯電話
    fc.tuple(fc.constantFrom('090', '080', '070'), fc.integer({ min: 1000, max: 9999 }), fc.integer({ min: 1000, max: 9999 })).map(([prefix, mid, last]) => `${prefix}-${mid}-${last}`), 
    // 固定電話
    fc.tuple(fc.integer({ min: 1, max: 99 }), fc.integer({ min: 100, max: 9999 }), fc.integer({ min: 1000, max: 9999 })).map(([area, mid, last]) => `0${area}-${mid}-${last}`));
};
exports.phoneNumberArbitrary = phoneNumberArbitrary;
/**
 * メールアドレスを生成
 */
const emailArbitrary = () => {
    return fc.tuple(fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 3, maxLength: 10 }), fc.constantFrom('gmail.com', 'yahoo.co.jp', 'example.com', 'test.jp')).map(([local, domain]) => `${local}@${domain}`);
};
exports.emailArbitrary = emailArbitrary;
/**
 * 日本の住所を生成
 */
const addressArbitrary = () => {
    const prefectures = ['東京都', '大阪府', '神奈川県', '愛知県', '福岡県', '北海道'];
    const cities = ['中央区', '港区', '新宿区', '渋谷区', '豊島区'];
    return fc.tuple(fc.constantFrom(...prefectures), fc.constantFrom(...cities), fc.integer({ min: 1, max: 9 }), fc.integer({ min: 1, max: 30 }), fc.integer({ min: 1, max: 20 })).map(([pref, city, chome, banchi, go]) => `${pref}${city}${chome}-${banchi}-${go}`);
};
exports.addressArbitrary = addressArbitrary;
/**
 * 物件種別を生成
 */
const propertyTypeArbitrary = () => {
    return fc.constantFrom('detached_house', 'land', 'apartment');
};
exports.propertyTypeArbitrary = propertyTypeArbitrary;
/**
 * 売主ステータスを生成
 */
const sellerStatusArbitrary = () => {
    return fc.constantFrom(types_1.SellerStatus.FOLLOWING_UP, types_1.SellerStatus.APPOINTMENT_SCHEDULED, types_1.SellerStatus.VISITED, types_1.SellerStatus.EXCLUSIVE_CONTRACT, types_1.SellerStatus.GENERAL_CONTRACT, types_1.SellerStatus.CONTRACTED, types_1.SellerStatus.OTHER_DECISION, types_1.SellerStatus.FOLLOW_UP_NOT_NEEDED, types_1.SellerStatus.LOST);
};
exports.sellerStatusArbitrary = sellerStatusArbitrary;
/**
 * 確度を生成
 */
const confidenceArbitrary = () => {
    return fc.constantFrom(types_1.ConfidenceLevel.A, types_1.ConfidenceLevel.B, types_1.ConfidenceLevel.B_PRIME, types_1.ConfidenceLevel.C, types_1.ConfidenceLevel.D, types_1.ConfidenceLevel.E, types_1.ConfidenceLevel.DUPLICATE);
};
exports.confidenceArbitrary = confidenceArbitrary;
/**
 * 構造を生成
 */
const structureArbitrary = () => {
    return fc.constantFrom('wood', 'light_steel', 'steel', 'other');
};
exports.structureArbitrary = structureArbitrary;
/**
 * 売主状況を生成
 */
const sellerSituationArbitrary = () => {
    return fc.constantFrom('occupied', 'vacant', 'rented', 'old_house', 'vacant_land');
};
exports.sellerSituationArbitrary = sellerSituationArbitrary;
/**
 * 連絡方法を生成
 */
const contactMethodArbitrary = () => {
    return fc.constantFrom('email', 'smail', 'phone');
};
exports.contactMethodArbitrary = contactMethodArbitrary;
/**
 * 査定方法を生成
 */
const appraisalMethodArbitrary = () => {
    return fc.constantFrom('email', 'mail', 'unreachable');
};
exports.appraisalMethodArbitrary = appraisalMethodArbitrary;
/**
 * 郵送ステータスを生成
 */
const mailStatusArbitrary = () => {
    return fc.constantFrom('pending', 'sent');
};
exports.mailStatusArbitrary = mailStatusArbitrary;
/**
 * Pinrichステータスを生成
 */
const pinrichStatusArbitrary = () => {
    return fc.constantFrom('distributing', 'closed');
};
exports.pinrichStatusArbitrary = pinrichStatusArbitrary;
/**
 * 除外アクションを生成
 */
const exclusionActionArbitrary = () => {
    return fc.constantFrom('exclude_if_unreachable', 'exclude_without_action');
};
exports.exclusionActionArbitrary = exclusionActionArbitrary;
/**
 * 打合せステータスを生成
 */
const meetingStatusArbitrary = () => {
    return fc.constantFrom('pending', 'completed');
};
exports.meetingStatusArbitrary = meetingStatusArbitrary;
/**
 * 売主データを生成
 */
const sellerArbitrary = () => {
    return fc.record({
        name: fc.string({ minLength: 2, maxLength: 50 }),
        phoneNumber: (0, exports.phoneNumberArbitrary)(),
        email: fc.option((0, exports.emailArbitrary)(), { nil: undefined }),
        address: (0, exports.addressArbitrary)(),
        requestorAddress: fc.option((0, exports.addressArbitrary)(), { nil: undefined }),
        status: (0, exports.sellerStatusArbitrary)(),
        confidence: (0, exports.confidenceArbitrary)(),
        nextCallDate: fc.option(fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }), { nil: undefined }),
        unreachable: fc.option(fc.boolean(), { nil: undefined }),
        contactMethod: fc.option((0, exports.contactMethodArbitrary)(), { nil: undefined }),
        valuationMethod: fc.option((0, exports.appraisalMethodArbitrary)(), { nil: undefined }),
        mailingStatus: fc.option((0, exports.mailStatusArbitrary)(), { nil: undefined }),
        pinrichStatus: fc.option((0, exports.pinrichStatusArbitrary)(), { nil: undefined }),
        exclusionAction: fc.option((0, exports.exclusionActionArbitrary)(), { nil: undefined }),
    });
};
exports.sellerArbitrary = sellerArbitrary;
/**
 * 活動種別を生成
 */
const activityTypeArbitrary = () => {
    return fc.constantFrom('phone', 'email', 'sms', 'visit', 'other');
};
exports.activityTypeArbitrary = activityTypeArbitrary;
/**
 * 活動データを生成
 */
const activityArbitrary = () => {
    return fc.record({
        sellerId: fc.uuid(),
        activityType: (0, exports.activityTypeArbitrary)(),
        timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
        performedBy: fc.uuid(),
        performedByEmail: (0, exports.emailArbitrary)(),
        notes: fc.option(fc.string({ minLength: 10, maxLength: 500 }), { nil: undefined }),
    });
};
exports.activityArbitrary = activityArbitrary;
/**
 * 査定データを生成
 */
const valuationArbitrary = () => {
    return fc.record({
        sellerId: fc.uuid(),
        amount1: fc.integer({ min: 1000000, max: 100000000 }), // 100万円〜1億円
        amount2: fc.integer({ min: 1000000, max: 100000000 }),
        amount3: fc.integer({ min: 1000000, max: 100000000 }),
        calculationMethod: fc.constantFrom('automatic', 'manual', 'post_visit'),
        calculationBasis: fc.string({ minLength: 10, maxLength: 200 }),
        isPostVisit: fc.boolean(),
    });
};
exports.valuationArbitrary = valuationArbitrary;
/**
 * 物件データを生成（査定計算用）
 */
const propertyDataArbitrary = () => {
    return fc.record({
        propertyType: (0, exports.propertyTypeArbitrary)(),
        landArea: fc.double({ min: 50, max: 1000, noNaN: true }),
        buildingArea: fc.option(fc.double({ min: 30, max: 500, noNaN: true }), { nil: undefined }),
        structure: fc.option((0, exports.structureArbitrary)(), { nil: undefined }),
        buildYear: fc.option(fc.integer({ min: 1950, max: 2024 }), { nil: undefined }),
        location: (0, exports.addressArbitrary)(),
    });
};
exports.propertyDataArbitrary = propertyDataArbitrary;
/**
 * 損失要因を生成（複数選択）
 */
const lossFactorsArbitrary = () => {
    const allFactors = [
        '知り合い', '価格が高い', '決定権者の把握', '連絡不足', '購入物件の紹介',
        '購入希望者がいる', '以前つきあいがあった不動産', 'ヒアリング不足',
        '担当者の対応が良い', '査定書郵送', '１番電話のスピード', '対応スピード',
        '買取保証', '追客電話の対応', '説明が丁寧', '詳細な調査',
        '不誠実・やるべきことをしない', '定期的な追客電話', 'HPの口コミ',
        '売買に強い', '仲介手数料のサービス', '仲介手数料以外のサービス',
        '妥当な査定額', '定期的なメール配信', '提案力', '熱意', 'その他'
    ];
    return fc.array(fc.constantFrom(...allFactors), { minLength: 1, maxLength: 5 });
};
exports.lossFactorsArbitrary = lossFactorsArbitrary;
/**
 * 検索クエリを生成
 */
const searchQueryArbitrary = () => {
    return fc.oneof(fc.string({ minLength: 2, maxLength: 10 }), // 一般的な検索文字列
    (0, exports.phoneNumberArbitrary)().map(phone => phone.substring(0, 8)), // 電話番号の一部
    (0, exports.addressArbitrary)().map(addr => addr.substring(0, 5)));
};
exports.searchQueryArbitrary = searchQueryArbitrary;
/**
 * ページネーションパラメータを生成
 */
const paginationArbitrary = () => {
    return fc.record({
        page: fc.integer({ min: 1, max: 100 }),
        limit: fc.integer({ min: 10, max: 100 }),
    });
};
exports.paginationArbitrary = paginationArbitrary;
/**
 * 日付範囲を生成
 */
const dateRangeArbitrary = () => {
    return fc.tuple(fc.date({ min: new Date('2024-01-01'), max: new Date('2025-06-30') }), fc.date({ min: new Date('2025-07-01'), max: new Date('2025-12-31') })).map(([start, end]) => ({ start, end }));
};
exports.dateRangeArbitrary = dateRangeArbitrary;

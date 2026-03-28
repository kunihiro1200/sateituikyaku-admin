/**
 * emailTemplates ルートのユニットテスト
 * タスク 2.1: GET /api/email-templates/property-non-report エンドポイントのテスト
 * Requirements: 1.3, 1.4
 */

// Supabase 設定をモック化（環境変数なしでも動作するように）
jest.mock('../../config/supabase', () => ({
  supabase: {},
  supabaseAdmin: {},
}));

// モック関数を先に定義
const mockGetPropertyNonReportTemplates = jest.fn();
const mockGetPropertyTemplates = jest.fn();
const mockGetSellerTemplates = jest.fn();
const mockGetTemplates = jest.fn();
const mockGetTemplateById = jest.fn();
const mockGetTemplatePreview = jest.fn();
const mockMergePlaceholders = jest.fn();
const mockValidatePlaceholders = jest.fn();
const mockMergeMultipleProperties = jest.fn();
const mockMergeAngleBracketPlaceholders = jest.fn();
const mockMergePropertyTemplate = jest.fn();

// EmailTemplateService をモック化
jest.mock('../../services/EmailTemplateService', () => ({
  EmailTemplateService: jest.fn().mockImplementation(() => ({
    getPropertyNonReportTemplates: mockGetPropertyNonReportTemplates,
    getPropertyTemplates: mockGetPropertyTemplates,
    getSellerTemplates: mockGetSellerTemplates,
    getTemplates: mockGetTemplates,
    getTemplateById: mockGetTemplateById,
    getTemplatePreview: mockGetTemplatePreview,
    mergePlaceholders: mockMergePlaceholders,
    validatePlaceholders: mockValidatePlaceholders,
    mergeMultipleProperties: mockMergeMultipleProperties,
    mergeAngleBracketPlaceholders: mockMergeAngleBracketPlaceholders,
    mergePropertyTemplate: mockMergePropertyTemplate,
  })),
}));

// StaffManagementService をモック化
jest.mock('../../services/StaffManagementService', () => ({
  StaffManagementService: jest.fn().mockImplementation(() => ({})),
}));

// SellerService をモック化
jest.mock('../../services/SellerService.supabase', () => ({
  SellerService: jest.fn().mockImplementation(() => ({})),
}));

import request from 'supertest';
import express from 'express';
import emailTemplatesRouter from '../emailTemplates';

// テスト用 Express アプリ
const app = express();
app.use(express.json());
app.use('/api/email-templates', emailTemplatesRouter);

describe('GET /api/email-templates/property-non-report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('正常系: テンプレート一覧を JSON で返す', async () => {
    // モックデータ
    const mockTemplates = [
      {
        id: 'property_sheet_1',
        name: '内覧案内',
        description: '内覧案内',
        subject: '内覧のご案内',
        body: '本文',
        placeholders: [],
      },
      {
        id: 'property_sheet_2',
        name: '価格変更通知',
        description: '価格変更通知',
        subject: '価格変更のお知らせ',
        body: '本文',
        placeholders: [],
      },
    ];

    mockGetPropertyNonReportTemplates.mockResolvedValue(mockTemplates);

    const res = await request(app).get('/api/email-templates/property-non-report');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockTemplates);
    expect(mockGetPropertyNonReportTemplates).toHaveBeenCalledTimes(1);
  });

  it('異常系: Google Sheets API 失敗時に HTTP 500 を返す', async () => {
    // Google Sheets API エラーをシミュレート
    mockGetPropertyNonReportTemplates.mockRejectedValue(
      new Error('Google Sheets API connection failed')
    );

    const res = await request(app).get('/api/email-templates/property-non-report');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('message', 'Google Sheets API connection failed');
  });

  it('正常系: テンプレートが0件の場合は空配列を返す', async () => {
    mockGetPropertyNonReportTemplates.mockResolvedValue([]);

    const res = await request(app).get('/api/email-templates/property-non-report');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const googleapis_1 = require("googleapis");
const GoogleAuthService_1 = require("./GoogleAuthService");
const BaseRepository_1 = require("../repositories/BaseRepository");
/**
 * Gmail APIを使用してメールを送信するサービス
 * 会社アカウント（tenant@ifoo-oita.com）のOAuth2トークンを使用
 */
class EmailService extends BaseRepository_1.BaseRepository {
    constructor() {
        super();
        this.googleAuthService = new GoogleAuthService_1.GoogleAuthService();
    }
    /**
     * メールを送信する
     * @param options 送信オプション（宛先、件名、本文）
     */
    async sendEmail(options) {
        const { to, subject, body } = options;
        if (!to || to.length === 0) {
            console.warn('[EmailService] No recipients specified, skipping email send');
            return;
        }
        // 有効なメールアドレスのみフィルタリング
        const validRecipients = to.filter(email => email && email.includes('@'));
        if (validRecipients.length === 0) {
            console.warn('[EmailService] No valid email addresses found, skipping email send');
            return;
        }
        try {
            const authClient = await this.googleAuthService.getAuthenticatedClient();
            const gmail = googleapis_1.google.gmail({ version: 'v1', auth: authClient });
            // RFC 2822形式のメールを作成
            const toHeader = validRecipients.join(', ');
            const rawMessage = [
                'From: tenant@ifoo-oita.com',
                `To: ${toHeader}`,
                `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
                'MIME-Version: 1.0',
                'Content-Type: text/plain; charset=UTF-8',
                'Content-Transfer-Encoding: base64',
                '',
                Buffer.from(body).toString('base64'),
            ].join('\r\n');
            const encodedMessage = Buffer.from(rawMessage)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
            await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage,
                },
            });
            console.log(`[EmailService] Email sent successfully to: ${toHeader}`);
        }
        catch (error) {
            // メール送信失敗はカレンダー登録の成功に影響させない（ログのみ）
            console.error('[EmailService] Failed to send email:', {
                to: validRecipients,
                subject,
                error: error.message,
            });
            throw error;
        }
    }
    /**
     * 買主へのメール送信（HTML対応、改行を<br>に変換、添付ファイル対応）
     */
    async sendBuyerEmail(params) {
        try {
            const authClient = await this.googleAuthService.getAuthenticatedClient();
            const gmail = googleapis_1.google.gmail({ version: 'v1', auth: authClient });
            const from = params.from || 'tenant@ifoo-oita.com';
            // URLをリンク化する関数（<a>タグで囲まれていないURLのみ対象）
            const urlToLink = (inputText) => inputText.replace(/(https?:\/\/[^\s\u3000\u3001\u3002\uff01\uff09\u300d\u300f\u3011\u3015\u3017\u3019\u301b\u301f\uff3d\uff5d\u300b\u300f]+)/g, (url, _group1, offset) => {
                // 既に<a href="...">の中にあるURLはスキップ
                const before = inputText.slice(0, offset);
                const lastAnchorOpen = before.lastIndexOf('<a ');
                const lastAnchorClose = before.lastIndexOf('</a>');
                if (lastAnchorOpen > lastAnchorClose) {
                    return url; // <a>タグの中にあるのでそのまま返す
                }
                return `<a href="${url}">${url}</a>`;
            });
            // 常にURLをリンク化する
            const linkedBody = urlToLink(params.body);
            // HTMLタグ（<br>以外）が含まれているかチェック
            const containsStructuralHtml = /<img|<div|<p|<span|<table|<td|<!DOCTYPE/i.test(linkedBody);
            let htmlBody;
            if (containsStructuralHtml) {
                // 構造的なHTMLが含まれている場合はそのまま使用（改行変換しない）
                htmlBody = linkedBody;
            }
            else {
                // プレーンテキスト（または<br>のみ）の場合は改行を<br>に変換
                htmlBody = linkedBody.replace(/\n/g, '<br>');
            }
            const encodedSubject = /^[\x00-\x7F]*$/.test(params.subject)
                ? params.subject
                : `=?UTF-8?B?${Buffer.from(params.subject, 'utf-8').toString('base64')}?=`;
            const files = params.attachments || [];
            let rawMessage;
            if (files.length === 0) {
                // 添付なし: シンプルな text/html メッセージ（base64エンコード）
                const htmlBodyBase64 = Buffer.from(htmlBody, 'utf-8').toString('base64');
                const messageParts = [
                    `From: ${from}`,
                    `To: ${params.to}`,
                    `Subject: ${encodedSubject}`,
                    'MIME-Version: 1.0',
                    'Content-Type: text/html; charset=utf-8',
                    'Content-Transfer-Encoding: base64',
                    '',
                    htmlBodyBase64,
                ];
                rawMessage = messageParts.join('\n');
            }
            else {
                // 添付あり: multipart/mixed メッセージ（base64エンコード）
                const htmlBodyBase64 = Buffer.from(htmlBody, 'utf-8').toString('base64');
                const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                const parts = [
                    `From: ${from}`,
                    `To: ${params.to}`,
                    `Subject: ${encodedSubject}`,
                    'MIME-Version: 1.0',
                    `Content-Type: multipart/mixed; boundary="${boundary}"`,
                    '',
                    `--${boundary}`,
                    'Content-Type: text/html; charset=utf-8',
                    'Content-Transfer-Encoding: base64',
                    '',
                    htmlBodyBase64,
                ];
                for (const file of files) {
                    const encodedFilename = `=?UTF-8?B?${Buffer.from(file.originalname, 'utf-8').toString('base64')}?=`;
                    const fileBase64 = file.buffer.toString('base64');
                    parts.push(`--${boundary}`, `Content-Type: ${file.mimetype || 'application/octet-stream'}`, `Content-Disposition: attachment; filename="${encodedFilename}"`, 'Content-Transfer-Encoding: base64', '', fileBase64);
                }
                parts.push(`--${boundary}--`);
                rawMessage = parts.join('\n');
            }
            const encodedMessage = Buffer.from(rawMessage)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: { raw: encodedMessage },
            });
            console.log(`[EmailService] Buyer email sent successfully to: ${params.to}`);
            return { messageId: response.data.id || '', success: true };
        }
        catch (error) {
            console.error('[EmailService] sendBuyerEmail エラー:', {
                to: params.to,
                subject: params.subject,
                bodyLength: params.body?.length || 0,
                attachmentsCount: params.attachments?.length || 0,
                errorMessage: error.message,
                errorStack: error.stack,
                errorCode: error.code,
                errorDetails: error.response?.data,
            });
            return { messageId: '', success: false, error: error.message };
        }
    }
}
exports.EmailService = EmailService;

"use strict";
/**
 * Amazon S3 Client
 * AWS SDK for Amazon S3のラッパー
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmazonS3Client = void 0;
exports.getS3Client = getS3Client;
const phone_1 = require("../../types/phone");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Amazon S3 Client クラス
 */
class AmazonS3Client {
    constructor() {
        this.useMock = process.env.USE_AWS_MOCK === 'true' || !process.env.AWS_ACCESS_KEY_ID;
        if (this.useMock) {
            logger_1.default.info('Amazon S3: Using mock implementation');
            this.client = null;
        }
        else {
            try {
                // 実際のAWS SDKクライアント初期化
                // const credentials = getAWSCredentials();
                // this.client = new S3Client(credentials);
                logger_1.default.info('Amazon S3: Using real AWS SDK');
            }
            catch (error) {
                logger_1.default.error('Failed to initialize Amazon S3 client', error);
                throw new phone_1.AWSConnectionError('Failed to initialize Amazon S3', 's3', error);
            }
        }
    }
    /**
     * ファイルをアップロード
     */
    async uploadFile(params) {
        if (this.useMock) {
            return this.mockUploadFile(params);
        }
        try {
            // 実際のAWS SDK呼び出し
            // const command = new PutObjectCommand({
            //   Bucket: params.bucket,
            //   Key: params.key,
            //   Body: params.body,
            //   ContentType: params.contentType,
            //   Metadata: params.metadata,
            //   ServerSideEncryption: 'AES256',
            // });
            // 
            // await this.client.send(command);
            // return `s3://${params.bucket}/${params.key}`;
            throw new Error('Real AWS SDK not implemented yet');
        }
        catch (error) {
            logger_1.default.error('Failed to upload file to S3', { error, params });
            throw new phone_1.AWSConnectionError('Failed to upload file to S3', 's3', error);
        }
    }
    /**
     * ファイルをダウンロード
     */
    async downloadFile(bucket, key) {
        if (this.useMock) {
            return this.mockDownloadFile(bucket, key);
        }
        try {
            // 実際のAWS SDK呼び出し
            // const command = new GetObjectCommand({
            //   Bucket: bucket,
            //   Key: key,
            // });
            // 
            // const response = await this.client.send(command);
            // const stream = response.Body as Readable;
            // return await streamToBuffer(stream);
            throw new Error('Real AWS SDK not implemented yet');
        }
        catch (error) {
            logger_1.default.error('Failed to download file from S3', { error, bucket, key });
            throw new phone_1.AWSConnectionError('Failed to download file from S3', 's3', error);
        }
    }
    /**
     * Presigned URLを生成（ダウンロード用）
     */
    async getPresignedUrl(params) {
        if (this.useMock) {
            return this.mockGetPresignedUrl(params);
        }
        try {
            // 実際のAWS SDK呼び出し
            // const command = new GetObjectCommand({
            //   Bucket: params.bucket,
            //   Key: params.key,
            // });
            // 
            // const url = await getSignedUrl(this.client, command, {
            //   expiresIn: params.expiresIn || 3600,
            // });
            // 
            // return url;
            throw new Error('Real AWS SDK not implemented yet');
        }
        catch (error) {
            logger_1.default.error('Failed to generate presigned URL', { error, params });
            throw new phone_1.AWSConnectionError('Failed to generate presigned URL', 's3', error);
        }
    }
    /**
     * ファイルを削除
     */
    async deleteFile(bucket, key) {
        if (this.useMock) {
            return this.mockDeleteFile(bucket, key);
        }
        try {
            // 実際のAWS SDK呼び出し
            // const command = new DeleteObjectCommand({
            //   Bucket: bucket,
            //   Key: key,
            // });
            // 
            // await this.client.send(command);
            throw new Error('Real AWS SDK not implemented yet');
        }
        catch (error) {
            logger_1.default.error('Failed to delete file from S3', { error, bucket, key });
            throw new phone_1.AWSConnectionError('Failed to delete file from S3', 's3', error);
        }
    }
    /**
     * ファイルをコピー
     */
    async copyFile(params) {
        if (this.useMock) {
            return this.mockCopyFile(params);
        }
        try {
            // 実際のAWS SDK呼び出し
            // const command = new CopyObjectCommand({
            //   CopySource: `${params.sourceBucket}/${params.sourceKey}`,
            //   Bucket: params.destinationBucket,
            //   Key: params.destinationKey,
            // });
            // 
            // await this.client.send(command);
            // return `s3://${params.destinationBucket}/${params.destinationKey}`;
            throw new Error('Real AWS SDK not implemented yet');
        }
        catch (error) {
            logger_1.default.error('Failed to copy file in S3', { error, params });
            throw new phone_1.AWSConnectionError('Failed to copy file in S3', 's3', error);
        }
    }
    /**
     * ファイルの存在確認
     */
    async fileExists(bucket, key) {
        if (this.useMock) {
            return this.mockFileExists(bucket, key);
        }
        try {
            // 実際のAWS SDK呼び出し
            // const command = new HeadObjectCommand({
            //   Bucket: bucket,
            //   Key: key,
            // });
            // 
            // await this.client.send(command);
            return true;
        }
        catch (error) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
                return false;
            }
            logger_1.default.error('Failed to check file existence in S3', { error, bucket, key });
            throw new phone_1.AWSConnectionError('Failed to check file existence in S3', 's3', error);
        }
    }
    /**
     * バケット内のファイル一覧を取得
     */
    async listFiles(bucket, prefix, maxKeys = 1000) {
        if (this.useMock) {
            return this.mockListFiles(bucket, prefix, maxKeys);
        }
        try {
            // 実際のAWS SDK呼び出し
            // const command = new ListObjectsV2Command({
            //   Bucket: bucket,
            //   Prefix: prefix,
            //   MaxKeys: maxKeys,
            // });
            // 
            // const response = await this.client.send(command);
            // return (response.Contents || []).map(obj => obj.Key!);
            throw new Error('Real AWS SDK not implemented yet');
        }
        catch (error) {
            logger_1.default.error('Failed to list files in S3', { error, bucket, prefix });
            throw new phone_1.AWSConnectionError('Failed to list files in S3', 's3', error);
        }
    }
    /**
     * 接続テスト
     */
    async testConnection(bucket) {
        if (this.useMock) {
            return true;
        }
        try {
            // 実際のAWS SDK呼び出し
            // const command = new HeadBucketCommand({ Bucket: bucket });
            // await this.client.send(command);
            return true;
        }
        catch (error) {
            logger_1.default.error('Amazon S3 connection test failed', { error, bucket });
            return false;
        }
    }
    // ============================================================================
    // モック実装（開発・テスト用）
    // ============================================================================
    mockUploadFile(params) {
        logger_1.default.info('[MOCK] Uploading file to S3', {
            bucket: params.bucket,
            key: params.key,
            size: typeof params.body === 'string' ? params.body.length : params.body.length,
        });
        return Promise.resolve(`s3://${params.bucket}/${params.key}`);
    }
    mockDownloadFile(bucket, key) {
        logger_1.default.info('[MOCK] Downloading file from S3', { bucket, key });
        // モックの音声データ（空のバッファ）
        return Promise.resolve(Buffer.from('mock-audio-data'));
    }
    mockGetPresignedUrl(params) {
        logger_1.default.info('[MOCK] Generating presigned URL', params);
        const expiresIn = params.expiresIn || 3600;
        const expiryTime = Date.now() + expiresIn * 1000;
        return Promise.resolve(`https://mock-s3.amazonaws.com/${params.bucket}/${params.key}?expires=${expiryTime}&signature=mock-signature`);
    }
    mockDeleteFile(bucket, key) {
        logger_1.default.info('[MOCK] Deleting file from S3', { bucket, key });
        return Promise.resolve();
    }
    mockCopyFile(params) {
        logger_1.default.info('[MOCK] Copying file in S3', params);
        return Promise.resolve(`s3://${params.destinationBucket}/${params.destinationKey}`);
    }
    mockFileExists(bucket, key) {
        logger_1.default.info('[MOCK] Checking file existence in S3', { bucket, key });
        // モックでは常に存在すると仮定
        return Promise.resolve(true);
    }
    mockListFiles(bucket, prefix, maxKeys = 1000) {
        logger_1.default.info('[MOCK] Listing files in S3', { bucket, prefix, maxKeys });
        // モックのファイルリスト
        const mockFiles = [
            `${prefix || 'recordings'}/call-001.mp3`,
            `${prefix || 'recordings'}/call-002.mp3`,
            `${prefix || 'recordings'}/call-003.mp3`,
        ];
        return Promise.resolve(mockFiles.slice(0, maxKeys));
    }
}
exports.AmazonS3Client = AmazonS3Client;
// シングルトンインスタンス
let s3ClientInstance = null;
/**
 * Amazon S3 Clientのシングルトンインスタンスを取得
 */
function getS3Client() {
    if (!s3ClientInstance) {
        s3ClientInstance = new AmazonS3Client();
    }
    return s3ClientInstance;
}
exports.default = AmazonS3Client;

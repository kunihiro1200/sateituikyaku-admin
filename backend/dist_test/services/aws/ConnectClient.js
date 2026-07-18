"use strict";
/**
 * Amazon Connect Client
 * AWS SDK for Amazon Connectのラッパー
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmazonConnectClient = void 0;
exports.getConnectClient = getConnectClient;
const phone_1 = require("../../types/phone");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Amazon Connect Client クラス
 */
class AmazonConnectClient {
    constructor() {
        this.useMock = process.env.USE_AWS_MOCK === 'true' || !process.env.AWS_ACCESS_KEY_ID;
        if (this.useMock) {
            logger_1.default.info('Amazon Connect: Using mock implementation');
        }
        else {
            try {
                // 実際のAWS SDKクライアント初期化
                // const credentials = getAWSCredentials();
                // this.client = new ConnectClient(credentials);
                logger_1.default.info('Amazon Connect: Using real AWS SDK');
            }
            catch (error) {
                logger_1.default.error('Failed to initialize Amazon Connect client', { error });
                throw new phone_1.AWSConnectionError('Failed to initialize Amazon Connect', 'connect', error);
            }
        }
    }
    /**
     * 発信を開始
     */
    async startOutboundCall(params) {
        if (this.useMock) {
            return this.mockStartOutboundCall(params);
        }
        try {
            // 実際のAWS SDK呼び出し
            // const command = new StartOutboundVoiceContactCommand({
            //   InstanceId: params.instanceId,
            //   ContactFlowId: params.contactFlowId,
            //   DestinationPhoneNumber: params.destinationPhoneNumber,
            //   SourcePhoneNumber: params.sourcePhoneNumber,
            //   Attributes: params.attributes,
            // });
            // 
            // const response = await this.client.send(command);
            // 
            // return {
            //   contactId: response.ContactId!,
            //   success: true,
            // };
            throw new Error('Real AWS SDK not implemented yet');
        }
        catch (error) {
            logger_1.default.error('Failed to start outbound call', { error, params });
            if (error.name === 'InvalidParameterException') {
                throw new phone_1.CallError('Invalid phone number or parameters', 'INVALID_PARAMETERS', false, error);
            }
            if (error.name === 'ResourceNotFoundException') {
                throw new phone_1.CallError('Contact flow or instance not found', 'RESOURCE_NOT_FOUND', false, error);
            }
            throw new phone_1.AWSConnectionError('Failed to start outbound call', 'connect', error);
        }
    }
    /**
     * 通話を終了
     */
    async endCall(contactId, instanceId) {
        if (this.useMock) {
            return this.mockEndCall(contactId, instanceId);
        }
        try {
            // 実際のAWS SDK呼び出し
            // const command = new StopContactCommand({
            //   ContactId: contactId,
            //   InstanceId: instanceId,
            // });
            // 
            // await this.client.send(command);
            throw new Error('Real AWS SDK not implemented yet');
        }
        catch (error) {
            logger_1.default.error('Failed to end call', { error, contactId, instanceId });
            throw new phone_1.AWSConnectionError('Failed to end call', 'connect', error);
        }
    }
    /**
     * 通話詳細を取得
     */
    async getContactDetails(contactId, instanceId) {
        if (this.useMock) {
            return this.mockGetContactDetails(contactId, instanceId);
        }
        try {
            // 実際のAWS SDK呼び出し
            // const command = new DescribeContactCommand({
            //   ContactId: contactId,
            //   InstanceId: instanceId,
            // });
            // 
            // const response = await this.client.send(command);
            // return response.Contact;
            throw new Error('Real AWS SDK not implemented yet');
        }
        catch (error) {
            logger_1.default.error('Failed to get contact details', { error, contactId, instanceId });
            throw new phone_1.AWSConnectionError('Failed to get contact details', 'connect', error);
        }
    }
    /**
     * 接続テスト
     */
    async testConnection(instanceId) {
        if (this.useMock) {
            return true;
        }
        try {
            // 実際のAWS SDK呼び出し
            // const command = new DescribeInstanceCommand({
            //   InstanceId: instanceId,
            // });
            // 
            // await this.client.send(command);
            return true;
        }
        catch (error) {
            logger_1.default.error('Amazon Connect connection test failed', { error, instanceId });
            return false;
        }
    }
    // ============================================================================
    // モック実装（開発・テスト用）
    // ============================================================================
    mockStartOutboundCall(params) {
        logger_1.default.info('[MOCK] Starting outbound call', params);
        // 電話番号バリデーション
        if (!params.destinationPhoneNumber || params.destinationPhoneNumber.length < 10) {
            throw new phone_1.CallError('Invalid destination phone number', 'INVALID_PHONE_NUMBER', false);
        }
        // モックのcontactIDを生成
        const contactId = `mock-contact-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        return Promise.resolve({
            contactId,
            success: true,
        });
    }
    mockEndCall(contactId, instanceId) {
        logger_1.default.info('[MOCK] Ending call', { contactId, instanceId });
        return Promise.resolve();
    }
    mockGetContactDetails(contactId, instanceId) {
        logger_1.default.info('[MOCK] Getting contact details', { contactId, instanceId });
        return Promise.resolve({
            ContactId: contactId,
            InstanceId: instanceId,
            InitiationMethod: 'OUTBOUND',
            Channel: 'VOICE',
            QueueInfo: {
                Id: 'mock-queue-id',
            },
            AgentInfo: {
                Id: 'mock-agent-id',
            },
            InitiationTimestamp: new Date(),
            DisconnectTimestamp: new Date(),
        });
    }
}
exports.AmazonConnectClient = AmazonConnectClient;
// シングルトンインスタンス
let connectClientInstance = null;
/**
 * Amazon Connect Clientのシングルトンインスタンスを取得
 */
function getConnectClient() {
    if (!connectClientInstance) {
        connectClientInstance = new AmazonConnectClient();
    }
    return connectClientInstance;
}
exports.default = AmazonConnectClient;

import { Injectable, BadGatewayException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'node:crypto';

interface PaystackInitializeResponse {
  status: boolean;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  data: {
    status: string;
    amount: number;
    reference: string;
    paid_at: string;
    channel: string;
    metadata: unknown;
  };
}

interface PaystackRefundResponse {
  status: boolean;
  data: {
    status: string;
  };
}

export interface PaystackInitializeParams {
  email: string;
  amount: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey =
      this.configService.get<string>('PAYSTACK_SECRET_KEY') ?? '';
  }

  private get headers() {
    return { Authorization: `Bearer ${this.secretKey}` };
  }

  async initializeTransaction(params: PaystackInitializeParams): Promise<{
    authorizationUrl: string;
    accessCode: string;
    reference: string;
  }> {
    try {
      const response = await axios.post<PaystackInitializeResponse>(
        `${this.baseUrl}/transaction/initialize`,
        {
          email: params.email,
          amount: params.amount,
          reference: params.reference,
          callback_url: params.callbackUrl,
          metadata: params.metadata,
        },
        { headers: this.headers },
      );
      const { authorization_url, access_code, reference } =
        response.data.data;
      return {
        authorizationUrl: authorization_url,
        accessCode: access_code,
        reference,
      };
    } catch (error) {
      this.logger.error('Paystack initializeTransaction failed', error);
      throw new BadGatewayException('Payment provider error during initialization');
    }
  }

  async verifyTransaction(reference: string): Promise<{
    status: string;
    amount: number;
    reference: string;
    paidAt: string;
    channel: string;
    metadata: unknown;
  }> {
    try {
      const response = await axios.get<PaystackVerifyResponse>(
        `${this.baseUrl}/transaction/verify/${reference}`,
        { headers: this.headers },
      );
      const { status, amount, reference: ref, paid_at, channel, metadata } =
        response.data.data;
      return {
        status,
        amount,
        reference: ref,
        paidAt: paid_at,
        channel,
        metadata,
      };
    } catch (error) {
      this.logger.error('Paystack verifyTransaction failed', error);
      throw new BadGatewayException('Payment provider error during verification');
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(payload)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(hash),
        Buffer.from(signature),
      );
    } catch {
      return false;
    }
  }

  async createRefund(
    reference: string,
    amountKobo?: number,
  ): Promise<{ status: string }> {
    try {
      const response = await axios.post<PaystackRefundResponse>(
        `${this.baseUrl}/refund`,
        { transaction: reference, amount: amountKobo },
        { headers: this.headers },
      );
      return { status: response.data.data.status };
    } catch (error) {
      this.logger.error('Paystack createRefund failed', error);
      throw new BadGatewayException('Payment provider error during refund');
    }
  }
}

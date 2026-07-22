import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsMessage {
  to: string;
  text: string;
}

/**
 * Thin abstraction over whatever SMS gateway the school system uses.
 * Most Iranian providers (Kavenegar, Ghasedak, ippanel, ...) expose a
 * simple REST endpoint that takes { to, text } (or similar) and an API
 * key header/query param — this implementation covers that shape
 * generically via env vars, so switching providers is a config change,
 * not a code change. If a provider needs a different request shape
 * (e.g. a numeric "pattern" or "template" ID instead of raw text),
 * override `buildRequestBody` below.
 */
@Injectable()
export class SmsProviderService {
  private readonly logger = new Logger(SmsProviderService.name);
  private readonly apiUrl: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly senderNumber: string | undefined;
  private readonly requestTimeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('SMS_API_URL');
    this.apiKey = this.configService.get<string>('SMS_API_KEY');
    this.senderNumber = this.configService.get<string>('SMS_SENDER_NUMBER');
    // Sprint 3 Phase 2 — reliability hardening: a hung gateway used to
    // keep this request (and the BullMQ worker processing it) open
    // indefinitely, since fetch() has no timeout of its own. A worker
    // stuck like that also can't pick up its next job, and if the whole
    // process is eventually killed mid-request, the queued job is left
    // in a state where BullMQ may retry it -- risking a duplicate SMS if
    // the original request actually reached the gateway before the kill.
    // Bounding the request lets it fail fast and predictably instead.
    this.requestTimeoutMs = this.configService.get<number>('SMS_REQUEST_TIMEOUT_MS') ?? 10_000;
  }

  async send(message: SmsMessage): Promise<{ success: boolean; providerRef?: string }> {
    if (!this.apiUrl || !this.apiKey) {
      this.logger.warn(
        `SMS_API_URL/SMS_API_KEY not configured — logging instead of sending: to=${message.to} text=${message.text}`,
      );
      return { success: true, providerRef: 'unconfigured-noop' };
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.apiKey,
        },
        body: JSON.stringify(this.buildRequestBody(message)),
        // AbortSignal.timeout() (Node >= 17.3, available on the node:20
        // base image this project builds on) aborts the underlying
        // fetch if it hasn't settled within requestTimeoutMs, without
        // needing a manually-managed AbortController + setTimeout pair.
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`SMS gateway responded ${response.status}: ${body}`);
        return { success: false };
      }

      const data = await response.json();
      return { success: true, providerRef: data?.messageId ?? data?.id };
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'TimeoutError';
      this.logger.error(
        isTimeout
          ? `SMS gateway request timed out after ${this.requestTimeoutMs}ms`
          : `SMS gateway request failed: ${(error as Error).message}`,
      );
      return { success: false };
    }
  }

  private buildRequestBody(message: SmsMessage): Record<string, unknown> {
    return {
      sender: this.senderNumber,
      receptor: message.to,
      message: message.text,
    };
  }
}


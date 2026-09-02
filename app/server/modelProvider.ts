import { GoogleGenAI } from '@google/genai';
import type { InferenceReceipt } from '../src/types';

export interface GenerateTextParams {
  operation?: string;
  systemPrompt?: string;
  userPrompt: string;
  jsonMode?: boolean;
  temperature?: number;
  model?: string;
}

export interface GenerateTextResult {
  text: string;
  rawOutput?: any;
  usedFallbackModel?: boolean;
  providerName?: string;
  receipt?: InferenceReceipt;
}

export interface HermesGenerateTextResult extends GenerateTextResult {
  readonly text: string;
  readonly receipt: InferenceReceipt;
}

export interface ReceiptBearingGenerateTextParams extends GenerateTextParams {
  readonly operation: string;
}

export interface ReceiptBearingModelProvider {
  readonly name: string;
  isAvailable(): boolean;
  generateText(params: ReceiptBearingGenerateTextParams): Promise<HermesGenerateTextResult>;
}

/** Transitional provider contract for the legacy receipt-optional Gemini path. */
export interface ModelProvider {
  name: string;
  isAvailable(): boolean;
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
}

interface HermesProviderOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  requestIdFactory?: () => string;
}

const HERMES_REQUEST_SCHEMA = 'hermes.inference.request.v1';
const HERMES_RESPONSE_SCHEMA = 'hermes.inference.response.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Hermes receipt ${field} must be a non-empty string.`);
  }
  return value.trim();
}

export class HermesProvider implements ReceiptBearingModelProvider {
  readonly name = 'Hermes';
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestIdFactory: () => string;

  constructor(options: HermesProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.HERMES_API_URL ?? '').replace(/\/+$/, '');
    this.apiKey = options.apiKey ?? process.env.HERMES_API_KEY ?? '';
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.requestIdFactory = options.requestIdFactory ?? (() => globalThis.crypto.randomUUID());
  }

  isAvailable(): boolean {
    return Boolean(this.baseUrl && this.apiKey && this.fetchImpl);
  }

  async generateText(params: GenerateTextParams): Promise<HermesGenerateTextResult> {
    if (!this.isAvailable()) {
      throw new Error('Hermes inference is unavailable because its endpoint or API key is not configured.');
    }

    const operation = requireNonEmptyString(params.operation, 'operation');
    const requestId = requireNonEmptyString(this.requestIdFactory(), 'request_id');
    const messages = [];
    if (params.systemPrompt !== undefined) {
      messages.push({ role: 'system', content: params.systemPrompt });
    }
    messages.push({ role: 'user', content: params.userPrompt });

    const options: Record<string, unknown> = {
      response_format: params.jsonMode ? 'json' : 'text',
    };
    if (typeof params.temperature === 'number') {
      options.temperature = params.temperature;
    }

    const response = await this.fetchImpl(`${this.baseUrl}/v1/inference`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schema: HERMES_REQUEST_SCHEMA,
        request_id: requestId,
        operation,
        messages,
        options,
      }),
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error(`Hermes inference returned invalid JSON (HTTP ${response.status}).`);
    }

    if (!response.ok) {
      const error = isRecord(body) && isRecord(body.error) ? body.error : null;
      const code = error && typeof error.code === 'string' ? ` ${error.code}` : '';
      const message = error && typeof error.message === 'string'
        ? `: ${error.message}`
        : '';
      throw new Error(`Hermes inference failed (HTTP ${response.status}${code})${message}`);
    }

    if (!isRecord(body) || !hasExactKeys(body, [
      'schema',
      'request_id',
      'status',
      'output',
      'execution',
    ])) {
      throw new Error('Hermes inference response does not match the closed response envelope.');
    }
    if (body.schema !== HERMES_RESPONSE_SCHEMA) {
      throw new Error('Hermes inference response schema is unsupported.');
    }
    if (body.request_id !== requestId) {
      throw new Error('Hermes inference receipt request_id does not match the request.');
    }
    if (body.status !== 'completed') {
      throw new Error('Hermes inference response status must be completed.');
    }
    if (!isRecord(body.output) || !hasExactKeys(body.output, ['text'])) {
      throw new Error('Hermes inference output is malformed.');
    }
    const text = requireNonEmptyString(body.output.text, 'output.text');
    if (!isRecord(body.execution) || !hasExactKeys(body.execution, [
      'provider',
      'model',
      'fallback_used',
      'fallback_index',
      'attempt_count',
    ])) {
      throw new Error('Hermes inference execution receipt is malformed.');
    }

    const actualProvider = requireNonEmptyString(body.execution.provider, 'provider');
    const actualModel = requireNonEmptyString(body.execution.model, 'model');
    const fallbackUsed = body.execution.fallback_used;
    const fallbackIndex = body.execution.fallback_index;
    const routeAttemptCount = body.execution.attempt_count;
    if (typeof fallbackUsed !== 'boolean') {
      throw new Error('Hermes receipt fallback_used must be a boolean.');
    }
    if (!Number.isInteger(fallbackIndex) || (fallbackIndex as number) < 0) {
      throw new Error('Hermes receipt fallback_index must be a non-negative integer.');
    }
    if (fallbackUsed !== ((fallbackIndex as number) > 0)) {
      throw new Error('Hermes receipt fallback metadata is inconsistent.');
    }
    if (
      !Number.isInteger(routeAttemptCount)
      || (routeAttemptCount as number) < (fallbackIndex as number) + 1
    ) {
      throw new Error('Hermes receipt attempt_count is inconsistent with its route index.');
    }

    const receipt: InferenceReceipt = Object.freeze({
      broker: 'Hermes',
      requestId,
      operation,
      actualProvider,
      actualModel,
      fallbackUsed,
      fallbackIndex: fallbackIndex as number,
      routeAttemptCount: routeAttemptCount as number,
    });
    return Object.freeze({ text, receipt });
  }
}

export class GeminiProvider implements ModelProvider {
  name = 'Gemini';
  private client: GoogleGenAI | null = null;
  private clientInitialized = false;

  private getClient(): GoogleGenAI | null {
    if (!this.clientInitialized) {
      this.clientInitialized = true;
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        this.client = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
      }
    }
    return this.client;
  }

  isAvailable(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const ai = this.getClient();
    if (!ai) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    // Build unique list of model candidates with primary model first
    const primaryModel = params.model || 'gemini-3.7-flash';
    const fallbackList = [
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ];
    const candidateModels = Array.from(new Set([primaryModel, ...fallbackList]));

    let lastError: any = null;

    for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
      const currentModel = candidateModels[mIdx];
      const maxAttempts = 2;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const config: any = {};
          if (params.systemPrompt) {
            config.systemInstruction = params.systemPrompt;
          }
          if (params.jsonMode) {
            config.responseMimeType = 'application/json';
          }
          if (typeof params.temperature === 'number') {
            config.temperature = params.temperature;
          }

          const response = await ai.models.generateContent({
            model: currentModel,
            contents: params.userPrompt,
            config,
          });

          if (response && typeof response.text === 'string') {
            let outputText = response.text.trim();
            // If jsonMode was requested, clean markdown code blocks if present
            if (params.jsonMode) {
              if (outputText.startsWith('```json')) {
                outputText = outputText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
              } else if (outputText.startsWith('```')) {
                outputText = outputText.replace(/^```\s*/, '').replace(/\s*```$/, '');
              }
            }

            return {
              text: outputText,
              rawOutput: response,
              usedFallbackModel: mIdx > 0,
              providerName: `Gemini (${currentModel})`,
            };
          }
        } catch (err: any) {
          lastError = err;
          const errMsg = err?.message || String(err);
          const isOverloadedOrUnavailable =
            err?.status === 'UNAVAILABLE' ||
            err?.code === 503 ||
            errMsg.includes('503') ||
            errMsg.includes('high demand') ||
            errMsg.includes('UNAVAILABLE') ||
            errMsg.includes('Resource has been exhausted') ||
            errMsg.includes('429');

          const isNotFoundOrDeprecated =
            err?.status === 'NOT_FOUND' ||
            err?.code === 404 ||
            errMsg.includes('404') ||
            errMsg.includes('no longer available') ||
            errMsg.includes('not found');

          console.warn(`[GeminiProvider] Attempt ${attempt + 1}/${maxAttempts} failed on ${currentModel}: ${errMsg}`);

          // If the model is 404/deprecated or unavailable/overloaded, immediately pivot to the next candidate model
          if ((isNotFoundOrDeprecated || isOverloadedOrUnavailable) && mIdx < candidateModels.length - 1) {
            console.info(`[GeminiProvider] ${currentModel} failed (${isNotFoundOrDeprecated ? 'deprecated/not found' : 'busy/unavailable'}). Switching to fallback candidate ${candidateModels[mIdx + 1]}...`);
            break; // Break inner retry loop and proceed to next candidate model
          }

          // Otherwise, apply a brief exponential backoff with jitter before retrying
          if (attempt < maxAttempts - 1 && !isNotFoundOrDeprecated) {
            const backoffMs = 400 * Math.pow(2, attempt) + Math.random() * 200;
            await new Promise((r) => setTimeout(r, backoffMs));
          }
        }
      }
    }

    throw lastError || new Error('All Gemini model provider attempts exhausted.');
  }
}

// Singleton provider instance
let defaultProvider: ModelProvider | null = null;

export function getModelProvider(): ModelProvider {
  if (!defaultProvider) {
    defaultProvider = new GeminiProvider();
  }
  return defaultProvider;
}

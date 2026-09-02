export interface GenerateTextParams {
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
  providerName: string;
}

export interface ModelProvider {
  name: string;
  isAvailable(): boolean;
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
}

import { GoogleGenAI } from '@google/genai';

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

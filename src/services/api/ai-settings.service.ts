import { apiClient } from '../../lib/api-client';
import type {
  AIActiveSetting,
  AIActiveSettingUpdateInput,
  IAISettingsService,
} from '../contracts/ai-settings.contracts';

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function unwrapPayload(value: unknown): Record<string, unknown> {
  const record = toRecord(value);
  if (!record) {
    return {};
  }

  const nestedData = toRecord(record.data);
  if (nestedData) {
    return nestedData;
  }

  const nestedResult = toRecord(record.result);
  if (nestedResult) {
    return nestedResult;
  }

  return record;
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function mapSettingDto(value: unknown): AIActiveSetting {
  const payload = unwrapPayload(value);

  return {
    id: String(payload.id ?? ''),
    system_prompt: readString(payload.system_prompt),
    openai_api_key: readString(payload.openai_api_key),
    model_name: readString(payload.model_name),
    temperature: readNumber(payload.temperature, 0),
    max_tokens: Math.max(1, Math.round(readNumber(payload.max_tokens, 1))),
    is_active: readBoolean(payload.is_active, true),
    created_at: readString(payload.created_at) || undefined,
    updated_at: readString(payload.updated_at) || undefined,
  };
}

function toPatchPayload(input: AIActiveSettingUpdateInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (typeof input.system_prompt !== 'undefined') {
    payload.system_prompt = input.system_prompt;
  }

  if (typeof input.openai_api_key !== 'undefined') {
    payload.openai_api_key = input.openai_api_key;
  }

  if (typeof input.model_name !== 'undefined') {
    payload.model_name = input.model_name;
  }

  if (typeof input.temperature !== 'undefined') {
    payload.temperature = Number(input.temperature);
  }

  if (typeof input.max_tokens !== 'undefined') {
    payload.max_tokens = Math.max(1, Math.round(Number(input.max_tokens)));
  }

  return payload;
}

export const apiAISettingsService: IAISettingsService = {
  async getActiveSetting(): Promise<AIActiveSetting> {
    const { data } = await apiClient.get<unknown>('/api/ai-settings/active/');
    return mapSettingDto(data);
  },

  async createOrUpdateActiveSetting(
    input: AIActiveSettingUpdateInput,
  ): Promise<AIActiveSetting> {
    const { data } = await apiClient.post<unknown>(
      '/api/ai-settings/active/',
      toPatchPayload(input),
    );
    return mapSettingDto(data);
  },

  async updateActiveSetting(
    input: AIActiveSettingUpdateInput,
  ): Promise<AIActiveSetting> {
    const { data } = await apiClient.patch<unknown>(
      '/api/ai-settings/active/',
      toPatchPayload(input),
    );
    return mapSettingDto(data);
  },
};

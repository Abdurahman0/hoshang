export interface AIActiveSetting {
  id: string;
  system_prompt: string;
  openai_api_key: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AIActiveSettingUpdateInput {
  system_prompt?: string;
  openai_api_key?: string;
  model_name?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface IAISettingsService {
  getActiveSetting(): Promise<AIActiveSetting>;
  createOrUpdateActiveSetting(
    input: AIActiveSettingUpdateInput,
  ): Promise<AIActiveSetting>;
  updateActiveSetting(input: AIActiveSettingUpdateInput): Promise<AIActiveSetting>;
}

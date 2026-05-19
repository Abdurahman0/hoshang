import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import AppIcon from '../../../components/shared/icons/AppIcon';
import {
  EmptyState,
  LoadingState,
  PageCard,
  PageHeader,
  PageLayout,
  PageSection,
} from '../../../components/shared/page';
import { useAuth } from '../../../auth';
import { formatLocalizedDate } from '../../../i18n/date-format';
import { apiClient } from '../../../lib/api-client';
import type { AIActiveSetting } from '../../../services/contracts';

interface FormState {
  systemPrompt: string;
  openaiApiKey: string;
  modelName: string;
  temperature: string;
  maxTokens: string;
}

const inputClassName = [
  'w-full rounded-lg border border-border-soft/60 bg-surface-card px-3.5 py-2.5 text-sm font-medium text-text-primary',
  'placeholder:text-text-muted outline-none transition duration-fast',
  'focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
  'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ');

const labelClassName =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted';

function readHttpStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const source = error as {
    status?: unknown;
    response?: { status?: unknown };
  };

  const responseStatus = Number(source.response?.status);
  if (Number.isFinite(responseStatus)) {
    return responseStatus;
  }

  const status = Number(source.status);
  return Number.isFinite(status) ? status : null;
}

function createFormState(setting: AIActiveSetting | null): FormState {
  if (!setting) {
    return {
      systemPrompt: '',
      openaiApiKey: '',
      modelName: 'gpt-4.1',
      temperature: '0.7',
      maxTokens: '500',
    };
  }

  return {
    systemPrompt: setting.system_prompt ?? '',
    openaiApiKey: setting.openai_api_key ?? '',
    modelName: setting.model_name ?? 'gpt-4.1',
    temperature: String(setting.temperature ?? 0.7),
    maxTokens: String(setting.max_tokens ?? 500),
  };
}

function normalizeUnitRangeValue(value: string, fallback = 0.7): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, parsed));
}

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

function AiSettingsPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission, hasRole } = useAuth();
  const canManageAISettings =
    hasRole('developer') || hasPermission('can_manage_ai_settings');
  const locale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';

  const [setting, setSetting] = useState<AIActiveSetting | null>(null);
  const [form, setForm] = useState<FormState>(() => createFormState(null));
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadActiveSetting() {
      setIsLoading(true);
      setHasError(false);
      setFieldError(null);
      setSaveMessage(null);

      try {
        const { data } = await apiClient.get<unknown>('/api/ai-settings/active/');
        const activeSetting = mapSettingDto(data);
        if (!isActive) {
          return;
        }

        setSetting(activeSetting);
        setForm(createFormState(activeSetting));
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (readHttpStatusCode(error) === 404) {
          setHasError(false);
          setSetting(null);
          setForm(createFormState(null));
          return;
        }

        setHasError(true);
        setSetting(null);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadActiveSetting();

    return () => {
      isActive = false;
    };
  }, []);

  const canSubmit = useMemo(() => {
    return (
      form.systemPrompt.trim().length > 0 &&
      form.openaiApiKey.trim().length > 0 &&
      form.modelName.trim().length > 0 &&
      form.temperature.trim().length > 0 &&
      form.maxTokens.trim().length > 0
    );
  }, [form]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageAISettings || isSaving) {
      return;
    }

    setFieldError(null);
    setSaveMessage(null);

    const temperature = Number(form.temperature);
    const maxTokens = Number(form.maxTokens);

    if (!form.systemPrompt.trim() || !form.modelName.trim() || !form.openaiApiKey.trim()) {
      setFieldError(t('aiSettings.form.requiredError'));
      return;
    }

    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 1) {
      setFieldError(t('aiSettings.form.temperatureError'));
      return;
    }

    if (!Number.isFinite(maxTokens) || maxTokens < 1) {
      setFieldError(t('aiSettings.form.maxTokensError', { defaultValue: 'Max tokens must be at least 1.' }));
      return;
    }

    setIsSaving(true);
    try {
      const { data } = await apiClient.post<unknown>('/api/ai-settings/active/', {
        system_prompt: form.systemPrompt.trim(),
        openai_api_key: form.openaiApiKey.trim(),
        model_name: form.modelName.trim(),
        temperature,
        max_tokens: Math.round(maxTokens),
      });
      const updated = mapSettingDto(data);

      setSetting(updated);
      setForm(createFormState(updated));
      setSaveMessage(
        t('aiSettings.form.saved', {
          defaultValue: 'AI settings were updated successfully.',
        }),
      );
    } catch (error) {
      setFieldError(
        error instanceof Error
          ? error.message
          : t('aiSettings.form.saveError'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  const header = (
    <PageHeader
      eyebrow={t('aiSettings.eyebrow')}
      title={t('aiSettings.title')}
      subtitle={t('aiSettings.subtitle')}
      actions={
        <div className="flex w-full flex-wrap items-center gap-2 min-[768px]:w-auto">
          <span className="inline-flex min-h-8 items-center gap-2 rounded-pill bg-primary/12 px-3 text-[12px] font-semibold text-text-accent">
            <AppIcon name="ai-settings" className="h-3.5 w-3.5" aria-hidden="true" />
            {setting?.model_name ?? t('common.na')}
          </span>
          {setting?.is_active ? (
            <span className="inline-flex min-h-8 items-center gap-2 rounded-pill bg-success-bg px-3 text-[12px] font-semibold text-success">
              <AppIcon name="check-circle" className="h-3.5 w-3.5" aria-hidden="true" />
              {t('common.active')}
            </span>
          ) : null}
        </div>
      }
    />
  );

  if (isLoading) {
    return (
      <PageLayout header={header}>
        <PageSection>
          <PageCard>
            <LoadingState
              title={t('aiSettings.loadingTitle')}
              description={t('aiSettings.loadingDescription')}
            />
          </PageCard>
        </PageSection>
      </PageLayout>
    );
  }

  if (hasError) {
    return (
      <PageLayout header={header}>
        <PageSection>
          <PageCard>
            <EmptyState
              title={t('aiSettings.errorTitle')}
              description={t('aiSettings.errorDescription')}
            />
          </PageCard>
        </PageSection>
      </PageLayout>
    );
  }

  return (
    <PageLayout header={header}>
      <PageSection>
        <PageCard>
          <form className="grid gap-3" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label className={labelClassName} htmlFor="ai-setting-model-name">
                  {t('aiSettings.form.modelName')}
                </label>
                <input
                  id="ai-setting-model-name"
                  type="text"
                  value={form.modelName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, modelName: event.target.value }))
                  }
                  className={inputClassName}
                  placeholder="gpt-4.1"
                  disabled={isSaving || !canManageAISettings}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <label className={labelClassName} htmlFor="ai-setting-api-key">
                  {t('aiSettings.form.openAIApiKey', { defaultValue: 'OpenAI API key' })}
                </label>
                <div className="relative">
                  <input
                    id="ai-setting-api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={form.openaiApiKey}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, openaiApiKey: event.target.value }))
                    }
                    className={`${inputClassName} pr-12`}
                    disabled={isSaving || !canManageAISettings}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted transition duration-fast hover:bg-surface-subtle hover:text-text-primary"
                    onClick={() => setShowApiKey((value) => !value)}
                    aria-label={showApiKey ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
                    disabled={isSaving || !canManageAISettings}
                  >
                    {showApiKey ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-1.5">
              <label className={labelClassName} htmlFor="ai-setting-system-prompt">
                {t('aiSettings.form.systemPrompt')}
              </label>
              <textarea
                id="ai-setting-system-prompt"
                value={form.systemPrompt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, systemPrompt: event.target.value }))
                }
                className={[inputClassName, 'min-h-[220px] resize-y leading-6'].join(' ')}
                placeholder={t('aiSettings.form.systemPromptPlaceholder')}
                disabled={isSaving || !canManageAISettings}
                required
              />
              <p className="m-0 text-[12px] leading-5 text-text-secondary">
                {t('aiSettings.form.systemPromptHint')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label className={labelClassName} htmlFor="ai-setting-temperature">
                  {t('aiSettings.form.temperature')}
                </label>
                <input
                  id="ai-setting-temperature-range"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={normalizeUnitRangeValue(form.temperature, 0.7)}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, temperature: event.target.value }))
                  }
                  disabled={isSaving || !canManageAISettings}
                />
                <input
                  id="ai-setting-temperature"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={form.temperature}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, temperature: event.target.value }))
                  }
                  className={inputClassName}
                  disabled={isSaving || !canManageAISettings}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <label className={labelClassName} htmlFor="ai-setting-max-tokens">
                  {t('aiSettings.form.maxTokens', { defaultValue: 'Max tokens' })}
                </label>
                <input
                  id="ai-setting-max-tokens"
                  type="number"
                  min={1}
                  step={1}
                  value={form.maxTokens}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, maxTokens: event.target.value }))
                  }
                  className={inputClassName}
                  disabled={isSaving || !canManageAISettings}
                  required
                />
              </div>
            </div>

            <div className="rounded-lg bg-surface-subtle/80 px-3 py-2.5 text-sm text-text-secondary">
              {t('aiSettings.detail.updatedAt')}: {' '}
              {setting
                ? formatLocalizedDate(setting.updated_at, i18n.language, {
                    locale,
                    withYear: true,
                    withTime: true,
                    shortMonth: true,
                    fallback: t('common.na'),
                  })
                : t('common.na')}
            </div>

            {fieldError ? (
              <p className="m-0 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger">
                {fieldError}
              </p>
            ) : null}

            {saveMessage ? (
              <p className="m-0 rounded-lg bg-success-bg px-3 py-2 text-sm font-medium text-success">
                {saveMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-surface-subtle px-4 text-sm font-semibold text-text-secondary transition duration-fast hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  setForm(createFormState(setting));
                  setFieldError(null);
                  setSaveMessage(null);
                }}
                disabled={isSaving}
              >
                {t('common.reset', { defaultValue: 'Reset' })}
              </button>
              <button
                type="submit"
                className="ml-auto inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canSubmit || isSaving || !canManageAISettings}
              >
                {isSaving
                  ? t('aiSettings.form.saving')
                  : t('aiSettings.form.editSubmit')}
              </button>
            </div>
          </form>
        </PageCard>
      </PageSection>
    </PageLayout>
  );
}

export default AiSettingsPage;

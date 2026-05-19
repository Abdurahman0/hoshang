import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DateRangePicker,
  FilterBar,
  FilterSelect,
  StatusBadge,
  type DataTableColumn,
} from '../../../components/shared/data';
import AppIcon from '../../../components/shared/icons/AppIcon';
import {
  EmptyState,
  LoadingState,
  PageCard,
  PageHeader,
  PageLayout,
  PageSection,
} from '../../../components/shared/page';
import { formatLocalizedDate } from '../../../i18n/date-format';
import { apiClient } from '../../../lib/api-client';

interface LogActor {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'developer' | 'admin' | 'operator';
  is_active: boolean;
  date_joined: string;
}

type TargetType = 'Lead' | 'User' | 'AIConfig';
type LogAction = 'create' | 'update' | 'delete' | 'status_change';

interface AuditLog {
  id: number;
  actor: LogActor | null;
  target_type: TargetType;
  target_id: string;
  target_repr: string;
  action: LogAction;
  field_changes: Record<string, { old: string | number | boolean | null; new: string | number | boolean | null }>;
  created_at: string;
}

const labelClassName =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted';

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeActor(value: unknown): LogActor | null {
  const dto = toRecord(value);
  if (!dto) {
    return null;
  }

  const id = Number(dto.id);
  if (!Number.isFinite(id)) {
    return null;
  }

  return {
    id,
    username: String(dto.username ?? ''),
    first_name: String(dto.first_name ?? ''),
    last_name: String(dto.last_name ?? ''),
    email: String(dto.email ?? ''),
    role: String(dto.role ?? 'operator') as LogActor['role'],
    is_active: Boolean(dto.is_active),
    date_joined: String(dto.date_joined ?? ''),
  };
}

function normalizeLog(value: unknown): AuditLog | null {
  const dto = toRecord(value);
  if (!dto) {
    return null;
  }

  const id = Number(dto.id);
  const targetType = String(dto.target_type ?? '') as TargetType;
  const action = String(dto.action ?? '') as LogAction;
  if (!Number.isFinite(id) || !targetType || !action) {
    return null;
  }

  const fieldChanges = toRecord(dto.field_changes) ?? {};

  return {
    id,
    actor: normalizeActor(dto.actor),
    target_type: targetType,
    target_id: String(dto.target_id ?? ''),
    target_repr: String(dto.target_repr ?? ''),
    action,
    field_changes: fieldChanges as AuditLog['field_changes'],
    created_at: String(dto.created_at ?? ''),
  };
}

function normalizeLogList(value: unknown): AuditLog[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeLog).filter((item): item is AuditLog => item !== null);
}

function extractApiErrorMessage(error: unknown, fallback: string): string {
  const topLevel = toRecord(error);
  const response = toRecord(topLevel?.response);
  const data = response?.data;
  const dataRecord = toRecord(data);

  const detail = dataRecord?.detail;
  if (typeof detail === 'string' && detail.trim().length > 0) {
    return detail;
  }

  return fallback;
}

function formatDateTime(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const locale = language === 'ru' ? 'ru-RU' : 'uz-UZ';
  return formatLocalizedDate(date, language, {
    locale,
    withYear: true,
    withTime: true,
    shortMonth: true,
  });
}

function LogsPage() {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<'all' | TargetType>('all');
  const [actorFilter, setActorFilter] = useState<'all' | string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const targetTypeLabelByKey: Record<TargetType, string> = {
    Lead: i18n.language === 'ru' ? 'Лид' : 'Lid',
    User: i18n.language === 'ru' ? 'Пользователь' : 'Foydalanuvchi',
    AIConfig: i18n.language === 'ru' ? 'AI sozlamasi' : 'AI sozlamasi',
  };

  const actionLabelByKey: Record<LogAction, string> = {
    create: i18n.language === 'ru' ? 'Создание' : 'Yaratish',
    update: i18n.language === 'ru' ? 'Обновление' : 'Yangilash',
    delete: i18n.language === 'ru' ? 'Удаление' : "O'chirish",
    status_change: i18n.language === 'ru' ? 'Смена статуса' : 'Status almashinuvi',
  };

  useEffect(() => {
    let isActive = true;

    async function loadLogs() {
      setIsLoading(true);
      setHasError(false);
      setPageError(null);

      try {
        const params: Record<string, string> = {};
        if (targetType !== 'all') {
          params.target_type = targetType;
        }
        if (actorFilter !== 'all') {
          params.actor = actorFilter;
        }
        if (dateFrom) {
          params.date_from = dateFrom;
        }
        if (dateTo) {
          params.date_to = dateTo;
        }

        const { data } = await apiClient.get<unknown>('/api/logs/', { params });
        if (!isActive) {
          return;
        }

        setLogs(normalizeLogList(data));
      } catch (error) {
        if (!isActive) {
          return;
        }

        setLogs([]);
        setHasError(true);
        setPageError(
          extractApiErrorMessage(
            error,
            i18n.language === 'ru'
              ? 'Не удалось загрузить журналы.'
              : "Jurnallarni yuklab bo'lmadi.",
          ),
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadLogs();

    return () => {
      isActive = false;
    };
  }, [actorFilter, dateFrom, dateTo, i18n.language, targetType]);

  const actorOptions = useMemo(() => {
    const uniqueActors = Array.from(
      new Map(
        logs
          .filter((log) => log.actor !== null)
          .map((log) => [log.actor!.id, log.actor!]),
      ).values(),
    );

    return [
      { value: 'all', label: i18n.language === 'ru' ? 'Все пользователи' : 'Barcha foydalanuvchilar' },
      ...uniqueActors.map((actor) => ({
        value: String(actor.id),
        label: `${actor.username} (${actor.role})`,
      })),
    ];
  }, [i18n.language, logs]);

  const columns = useMemo<DataTableColumn<AuditLog>[]>(
    () => [
      {
        key: 'created_at',
        label: t('logs.columns.createdAt'),
        render: (log) => (
          <span className="text-sm text-text-secondary">
            {formatDateTime(log.created_at, i18n.language)}
          </span>
        ),
      },
      {
        key: 'actor',
        label: i18n.language === 'ru' ? 'Пользователь' : 'Foydalanuvchi',
        render: (log) => (
          <div className="grid gap-0.5">
            <span className="text-sm font-semibold text-text-primary">
              {log.actor?.username ?? t('common.na')}
            </span>
            <span className="text-[12px] text-text-secondary">
              {log.actor?.role ?? t('common.na')}
            </span>
          </div>
        ),
      },
      {
        key: 'target_type',
        label: i18n.language === 'ru' ? 'Тип цели' : 'Nishon turi',
        render: (log) => (
          <StatusBadge
            status={log.target_type}
            tone="accent"
            label={targetTypeLabelByKey[log.target_type] ?? log.target_type}
          />
        ),
      },
      {
        key: 'target_repr',
        label: i18n.language === 'ru' ? 'Цель' : 'Nishon',
        render: (log) => <span className="text-sm text-text-primary">{log.target_repr}</span>,
      },
      {
        key: 'action',
        label: i18n.language === 'ru' ? 'Действие' : 'Harakat',
        render: (log) => (
          <StatusBadge
            status={log.action}
            label={actionLabelByKey[log.action] ?? log.action}
          />
        ),
      },
    ],
    [actionLabelByKey, i18n.language, t, targetTypeLabelByKey],
  );

  const header = (
    <PageHeader
      eyebrow={t('routes.logs.title')}
      title={t('routes.logs.title')}
      subtitle={t('routes.logs.description')}
      actions={
        <span className="inline-flex min-h-8 items-center gap-2 rounded-pill bg-primary/12 px-3 text-[12px] font-semibold text-text-accent">
          <AppIcon name="logs" className="h-3.5 w-3.5" aria-hidden="true" />
          {logs.length} {i18n.language === 'ru' ? 'записей' : 'yozuv'}
        </span>
      }
    />
  );

  return (
    <PageLayout header={header}>
      <PageSection>
        <FilterBar>
          <label className="grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_180px]">
            <span className={labelClassName}>{i18n.language === 'ru' ? 'Тип цели' : 'Nishon turi'}</span>
            <FilterSelect
              value={targetType}
              options={[
                { value: 'all', label: i18n.language === 'ru' ? 'Все типы' : 'Barcha turlar' },
                { value: 'Lead', label: targetTypeLabelByKey.Lead },
                { value: 'User', label: targetTypeLabelByKey.User },
                { value: 'AIConfig', label: targetTypeLabelByKey.AIConfig },
              ]}
              onChange={(value) => setTargetType(value as typeof targetType)}
            />
          </label>

          <label className="grid min-w-[min(220px,100%)] flex-[1_1_220px] gap-1.5 min-[640px]:flex-[0_1_220px]">
            <span className={labelClassName}>{i18n.language === 'ru' ? 'Пользователь' : 'Foydalanuvchi'}</span>
            <FilterSelect
              value={actorFilter}
              options={actorOptions}
              onChange={(value) => setActorFilter(value)}
            />
          </label>

          <label className="grid min-w-[min(300px,100%)] flex-[1_1_300px] gap-1.5 min-[640px]:flex-[0_1_320px]">
            <span className={labelClassName}>{t('dashboard.filters.customRange')}</span>
            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChange={({ dateFrom: nextFrom, dateTo: nextTo }) => {
                setDateFrom(nextFrom);
                setDateTo(nextTo);
              }}
            />
          </label>
        </FilterBar>

        <PageCard>
          {isLoading ? (
            <LoadingState
              title={i18n.language === 'ru' ? 'Загрузка журналов' : 'Jurnallar yuklanmoqda'}
              description={i18n.language === 'ru' ? 'Подождите, данные обновляются.' : "Iltimos kuting, ma'lumotlar yangilanmoqda."}
            />
          ) : hasError ? (
            <EmptyState
              title={i18n.language === 'ru' ? 'Журналы недоступны' : 'Jurnallar mavjud emas'}
              description={pageError ?? (i18n.language === 'ru' ? 'Не удалось загрузить журналы.' : "Jurnallarni yuklab bo'lmadi.")}
            />
          ) : logs.length === 0 ? (
            <EmptyState
              title={i18n.language === 'ru' ? 'Журналы не найдены' : 'Jurnallar topilmadi'}
              description={i18n.language === 'ru' ? 'Измените фильтры и попробуйте снова.' : "Filterlarni o'zgartirib qayta urinib ko'ring."}
            />
          ) : (
            <DataTable
              data={logs}
              columns={columns}
              rowKey={(row) => String(row.id)}
            />
          )}
        </PageCard>
      </PageSection>
    </PageLayout>
  );
}

export default LogsPage;

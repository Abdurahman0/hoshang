import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../auth';
import {
  DataTable,
  DateRangePicker,
  FilterBar,
  FilterSelect,
  SearchInput,
  StatusBadge,
  type DataTableColumn,
} from '../../../components/shared/data';
import AppIcon from '../../../components/shared/icons/AppIcon';
import {
  ConfirmActionModal,
  EmptyState,
  LoadingState,
  PageCard,
  PageHeader,
  PageLayout,
  PageSection,
} from '../../../components/shared/page';
import { formatLocalizedDate } from '../../../i18n/date-format';

type LeadStatus = string;

type Branch = 'center' | 'family' | 'qoyliq';

interface Lead {
  id: number;
  client_name: string;
  phone: string;
  branch: Branch;
  reason: string;
  status: LeadStatus;
  source: string;
  external_user_id: string;
  external_thread_id: string;
  last_ai_reply: string;
  created_by_ai: boolean;
  created_at: string;
  updated_at: string;
}

interface LeadStatusOption {
  value: LeadStatus;
  label: string;
}

interface LeadStatusCatalogItem {
  id: number;
  code: LeadStatus;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface LeadStatusFormState {
  code: string;
  label: string;
  sort_order: string;
  is_active: boolean;
}

interface LeadFilters {
  status: LeadStatus | 'all';
  branch: Branch | 'all';
  search: string;
  date_from: string;
  date_to: string;
}

interface LeadFormState {
  client_name: string;
  phone: string;
  branch: Branch;
  reason: string;
  status: LeadStatus;
}

type LeadsTableView = 'leads' | 'lead_statuses';

const FALLBACK_STATUS_OPTIONS: LeadStatusOption[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

const DEFAULT_STATUS_LABELS: Record<string, string> = {
  new: 'Yangi',
  contacted: "Bog'lanildi",
  in_progress: 'Jarayonda',
  follow_up: "Qayta bog'lanish",
  won: 'Yutildi',
  lost: "Yo'qotildi",
};

const labelClassName =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted';

const inputClassName = [
  'w-full rounded-lg border border-border-soft/60 bg-surface-card px-3.5 py-2.5 text-sm font-medium text-text-primary',
  'placeholder:text-text-muted outline-none transition duration-fast',
  'focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
].join(' ');

const STATUS_CODE_SLUG_REGEX = /^[a-zA-Z0-9_-]+$/;

function toStatusCodeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/-+/g, '-')
    .replace(/^[_-]+|[_-]+$/g, '');
}

function normalizeLead(value: unknown): Lead | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const dto = value as Record<string, unknown>;

  const id = Number(dto.id);
  const status = String(dto.status ?? '') as LeadStatus;
  const branch = String(dto.branch ?? '') as Branch;

  if (!Number.isFinite(id) || !status || !branch) {
    return null;
  }

  return {
    id,
    client_name: String(dto.client_name ?? ''),
    phone: String(dto.phone ?? ''),
    branch,
    reason: String(dto.reason ?? ''),
    status,
    source: String(dto.source ?? ''),
    external_user_id: String(dto.external_user_id ?? ''),
    external_thread_id: String(dto.external_thread_id ?? ''),
    last_ai_reply: String(dto.last_ai_reply ?? ''),
    created_by_ai: Boolean(dto.created_by_ai),
    created_at: String(dto.created_at ?? ''),
    updated_at: String(dto.updated_at ?? ''),
  };
}

function normalizeLeadList(value: unknown): Lead[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeLead)
    .filter((lead): lead is Lead => lead !== null);
}

function normalizeStatusOptions(value: unknown): LeadStatusOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null;
      }

      const dto = item as Record<string, unknown>;
      const optionValue = String(dto.value ?? '');
      const label = String(dto.label ?? '');

      if (!optionValue || !label) {
        return null;
      }

      return {
        value: optionValue as LeadStatus,
        label,
      };
    })
    .filter((option): option is LeadStatusOption => option !== null);
}

function normalizeLeadStatusCatalog(value: unknown): LeadStatusCatalogItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null;
      }

      const dto = item as Record<string, unknown>;
      const id = Number(dto.id);
      const code = String(dto.code ?? '') as LeadStatus;
      const label = String(dto.label ?? '');
      const sortOrder = Number(dto.sort_order);

      if (!Number.isFinite(id) || !code || !label || !Number.isFinite(sortOrder)) {
        return null;
      }

      return {
        id,
        code,
        label,
        sort_order: Math.round(sortOrder),
        is_active: Boolean(dto.is_active),
        created_at: String(dto.created_at ?? ''),
        updated_at: String(dto.updated_at ?? ''),
      };
    })
    .filter((item): item is LeadStatusCatalogItem => item !== null);
}

function sortLeadStatusCatalog(items: LeadStatusCatalogItem[]): LeadStatusCatalogItem[] {
  return [...items].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return left.code.localeCompare(right.code);
  });
}

function createLeadStatusFormState(
  item: LeadStatusCatalogItem | null,
  nextSortOrder = 1,
): LeadStatusFormState {
  if (!item) {
    return {
      code: '',
      label: '',
      sort_order: String(nextSortOrder),
      is_active: true,
    };
  }

  return {
    code: item.code,
    label: item.label,
    sort_order: String(item.sort_order),
    is_active: item.is_active,
  };
}

function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const source = error as {
    message?: unknown;
    response?: { data?: unknown };
  };

  const responseData = source.response?.data;
  if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
    const record = responseData as Record<string, unknown>;

    if (typeof record.detail === 'string' && record.detail.trim().length > 0) {
      return record.detail;
    }

    const firstField = Object.values(record).find((entry) => {
      if (typeof entry === 'string' && entry.trim().length > 0) {
        return true;
      }
      return Array.isArray(entry) && typeof entry[0] === 'string';
    });

    if (typeof firstField === 'string') {
      return firstField;
    }

    if (Array.isArray(firstField) && typeof firstField[0] === 'string') {
      return String(firstField[0]);
    }
  }

  if (typeof source.message === 'string' && source.message.trim().length > 0) {
    return source.message;
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

function createLeadForm(lead: Lead | null): LeadFormState {
  if (!lead) {
    return {
      client_name: '',
      phone: '',
      branch: 'center',
      reason: '',
      status: 'new',
    };
  }

  return {
    client_name: lead.client_name,
    phone: lead.phone,
    branch: lead.branch,
    reason: lead.reason,
    status: lead.status,
  };
}

function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { hasRole } = useAuth();
  const canManageLeadStatuses = hasRole('developer') || hasRole('admin');

  const branchLabels: Record<Branch, string> = {
    center: i18n.language === 'ru' ? 'Центр' : 'Center',
    family: i18n.language === 'ru' ? 'Family' : 'Family',
    qoyliq: i18n.language === 'ru' ? 'Ada / Qoyliq' : 'Ada / Qoyliq',
  };

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLeadsLoading, setIsLeadsLoading] = useState(true);
  const [hasLeadsError, setHasLeadsError] = useState(false);

  const [statusOptions, setStatusOptions] = useState<LeadStatusOption[]>(
    FALLBACK_STATUS_OPTIONS,
  );
  const [leadStatusCatalog, setLeadStatusCatalog] = useState<LeadStatusCatalogItem[]>([]);
  const [isLeadStatusCatalogLoading, setIsLeadStatusCatalogLoading] = useState(false);
  const [leadStatusCatalogError, setLeadStatusCatalogError] = useState<string | null>(null);
  const [leadStatusSearch, setLeadStatusSearch] = useState('');
  const [leadStatusActiveFilter, setLeadStatusActiveFilter] =
    useState<'all' | 'active' | 'inactive'>('all');
  const [isLeadStatusModalOpen, setIsLeadStatusModalOpen] = useState(false);
  const [leadStatusModalMode, setLeadStatusModalMode] = useState<'create' | 'edit'>('create');
  const [editingLeadStatusId, setEditingLeadStatusId] = useState<number | null>(null);
  const [leadStatusForm, setLeadStatusForm] = useState<LeadStatusFormState>(
    createLeadStatusFormState(null),
  );
  const [isLeadStatusCodeManuallyEdited, setIsLeadStatusCodeManuallyEdited] = useState(false);
  const [isLeadStatusSaving, setIsLeadStatusSaving] = useState(false);
  const [leadStatusFormError, setLeadStatusFormError] = useState<string | null>(null);
  const [deletingLeadStatusId, setDeletingLeadStatusId] = useState<number | null>(null);
  const [deletingLeadStatusCandidate, setDeletingLeadStatusCandidate] =
    useState<LeadStatusCatalogItem | null>(null);
  const [deleteLeadStatusError, setDeleteLeadStatusError] = useState<string | null>(null);

  const [filters, setFilters] = useState<LeadFilters>({
    status: 'all',
    branch: 'all',
    search: '',
    date_from: '',
    date_to: '',
  });
  const [tableView, setTableView] = useState<LeadsTableView>('leads');

  const [isLeadViewOpen, setIsLeadViewOpen] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [leadModalMode, setLeadModalMode] = useState<'create' | 'edit'>('edit');
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isLeadDetailLoading, setIsLeadDetailLoading] = useState(false);
  const [leadDetailError, setLeadDetailError] = useState<string | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<number | null>(null);
  const [deletingLeadCandidate, setDeletingLeadCandidate] = useState<Lead | null>(null);
  const [deleteLeadError, setDeleteLeadError] = useState<string | null>(null);

  const [form, setForm] = useState<LeadFormState>(() => createLeadForm(null));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const statusLabelByKey = useMemo<Record<string, string>>(() => {
    const resolved: Record<string, string> = {
      new: i18n.language === 'ru' ? 'Новый' : DEFAULT_STATUS_LABELS.new,
      contacted: i18n.language === 'ru' ? 'Связались' : DEFAULT_STATUS_LABELS.contacted,
      in_progress: i18n.language === 'ru' ? 'В работе' : DEFAULT_STATUS_LABELS.in_progress,
      follow_up:
        i18n.language === 'ru' ? 'Повторный контакт' : DEFAULT_STATUS_LABELS.follow_up,
      won: i18n.language === 'ru' ? 'Успешно' : DEFAULT_STATUS_LABELS.won,
      lost: i18n.language === 'ru' ? 'Потерян' : DEFAULT_STATUS_LABELS.lost,
    };

    statusOptions.forEach((option) => {
      resolved[option.value] = option.label;
    });

    return resolved;
  }, [i18n.language, statusOptions]);

  useEffect(() => {
    let isActive = true;

    async function loadStatuses() {
      try {
        const { data } = await apiClient.get<unknown>('/api/leads/statuses/');
        if (!isActive) {
          return;
        }

        const nextOptions = normalizeStatusOptions(data);
        if (nextOptions.length > 0) {
          setStatusOptions(nextOptions);
        }
      } catch {
        if (!isActive) {
          return;
        }

        setStatusOptions(FALLBACK_STATUS_OPTIONS);
      }
    }

    void loadStatuses();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!canManageLeadStatuses) {
      setTableView('leads');
      return;
    }

    let isActive = true;

    async function loadLeadStatusCatalog() {
      setIsLeadStatusCatalogLoading(true);
      setLeadStatusCatalogError(null);

      try {
        const { data } = await apiClient.get<unknown>('/api/lead-statuses/');
        if (!isActive) {
          return;
        }

        setLeadStatusCatalog(sortLeadStatusCatalog(normalizeLeadStatusCatalog(data)));
      } catch (error) {
        if (!isActive) {
          return;
        }

        setLeadStatusCatalog([]);
        setLeadStatusCatalogError(
          extractApiErrorMessage(
            error,
            i18n.language === 'ru'
              ? 'Не удалось загрузить статусы лидов.'
              : "Lid statuslarini yuklab bo'lmadi.",
          ),
        );
      } finally {
        if (isActive) {
          setIsLeadStatusCatalogLoading(false);
        }
      }
    }

    void loadLeadStatusCatalog();

    return () => {
      isActive = false;
    };
  }, [canManageLeadStatuses, i18n.language]);

  useEffect(() => {
    let isActive = true;

    async function loadLeads() {
      setIsLeadsLoading(true);
      setHasLeadsError(false);

      try {
        const params: Record<string, string> = {};

        if (filters.status !== 'all') {
          params.status = filters.status;
        }

        if (filters.branch !== 'all') {
          params.branch = filters.branch;
        }

        const query = filters.search.trim();
        if (query) {
          params.search = query;
        }

        if (filters.date_from) {
          params.date_from = filters.date_from;
        }

        if (filters.date_to) {
          params.date_to = filters.date_to;
        }

        const { data } = await apiClient.get<unknown>('/api/leads/', { params });
        if (!isActive) {
          return;
        }

        setLeads(normalizeLeadList(data));
      } catch {
        if (!isActive) {
          return;
        }

        setLeads([]);
        setHasLeadsError(true);
      } finally {
        if (isActive) {
          setIsLeadsLoading(false);
        }
      }
    }

    void loadLeads();

    return () => {
      isActive = false;
    };
  }, [filters]);

  const summary = useMemo(() => {
    const total = leads.length;
    const byStatus = leads.reduce(
      (acc, lead) => {
        if (lead.status === 'new') {
          acc.new += 1;
        } else if (lead.status === 'won') {
          acc.won += 1;
        } else if (lead.status === 'lost') {
          acc.lost += 1;
        }
        return acc;
      },
      { new: 0, won: 0, lost: 0 },
    );

    return {
      total,
      newLeads: byStatus.new,
      won: byStatus.won,
      lost: byStatus.lost,
    };
  }, [leads]);

  const filteredLeadStatusCatalog = useMemo(() => {
    const query = leadStatusSearch.trim().toLowerCase();

    return sortLeadStatusCatalog(leadStatusCatalog).filter((item) => {
      if (leadStatusActiveFilter === 'active' && !item.is_active) {
        return false;
      }

      if (leadStatusActiveFilter === 'inactive' && item.is_active) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [item.code, item.label].join(' ').toLowerCase().includes(query);
    });
  }, [leadStatusActiveFilter, leadStatusCatalog, leadStatusSearch]);

  const normalizedLeadStatusCode = leadStatusForm.code.trim().toLowerCase();
  const isLeadStatusCodeValid = STATUS_CODE_SLUG_REGEX.test(normalizedLeadStatusCode);

  const leadStatusColumns = useMemo<DataTableColumn<LeadStatusCatalogItem>[]>(
    () => [
      {
        key: 'code',
        label: i18n.language === 'ru' ? 'Код' : 'Kod',
        render: (item) => <span className='font-semibold text-text-primary'>{item.code}</span>,
      },
      {
        key: 'label',
        label: i18n.language === 'ru' ? 'Название' : 'Nomi',
        render: (item) => <span className='text-sm text-text-primary'>{item.label}</span>,
      },
      {
        key: 'sort_order',
        label: i18n.language === 'ru' ? 'Порядок' : 'Tartib',
        render: (item) => <span className='text-sm text-text-secondary'>{item.sort_order}</span>,
      },
      {
        key: 'active',
        label: t('users.columns.status'),
        render: (item) => (
          <StatusBadge
            status={item.is_active ? 'active' : 'inactive'}
            label={item.is_active ? t('common.active') : t('common.inactive')}
            tone={item.is_active ? 'success' : 'neutral'}
          />
        ),
      },
      {
        key: 'actions',
        label: t('users.columns.actions'),
        align: 'right',
        render: (item) => (
          <div className='flex items-center justify-end gap-1.5'>
            <button
              type='button'
              className='inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-subtle text-text-primary transition duration-fast hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60'
              onClick={(event) => {
                event.stopPropagation();
                void openLeadStatusEditModal(item.id);
              }}
              disabled={isLeadStatusSaving || deletingLeadStatusId === item.id}
              aria-label={t('users.actions.edit')}
            >
              <AppIcon name='edit' className='h-3.5 w-3.5' aria-hidden='true' />
            </button>
            <button
              type='button'
              className='inline-flex h-8 w-8 items-center justify-center rounded-lg bg-danger-bg text-danger transition duration-fast hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60'
              onClick={(event) => {
                event.stopPropagation();
                setDeleteLeadStatusError(null);
                setDeletingLeadStatusCandidate(item);
              }}
              disabled={isLeadStatusSaving || deletingLeadStatusId === item.id}
              aria-label={t('common.delete')}
            >
              {deletingLeadStatusId === item.id ? (
                <AppIcon name='refresh-cw' className='h-3.5 w-3.5' aria-hidden='true' />
              ) : (
                <AppIcon name='trash' className='h-3.5 w-3.5' aria-hidden='true' />
              )}
            </button>
          </div>
        ),
      },
    ],
    [deletingLeadStatusId, i18n.language, isLeadStatusSaving, t],
  );

  const columns = useMemo<DataTableColumn<Lead>[]>(
    () => [
      {
        key: 'id',
        label: 'ID',
        render: (lead) => (
          <span className='font-semibold text-text-primary'>#{lead.id}</span>
        ),
      },
      {
        key: 'client',
        label: t('leads.contact'),
        render: (lead) => (
          <div className='grid min-w-0 gap-0.5'>
            <span className='max-w-[220px] overflow-hidden text-ellipsis text-sm font-semibold text-text-primary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]'>
              {lead.client_name}
            </span>
            <span className='max-w-[220px] overflow-hidden text-ellipsis text-[12px] text-text-secondary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]'>{lead.phone}</span>
          </div>
        ),
      },
      {
        key: 'branch',
        label: i18n.language === 'ru' ? 'Филиал' : 'Filial',
        render: (lead) => (
          <span className='text-sm font-semibold text-text-primary'>
            {branchLabels[lead.branch]}
          </span>
        ),
      },
      {
        key: 'status',
        label: t('leads.status'),
        render: (lead) => (
          <StatusBadge
            status={lead.status}
            label={statusLabelByKey[lead.status] ?? lead.status}
          />
        ),
      },
      {
        key: 'reason',
        label: i18n.language === 'ru' ? 'Причина' : 'Sabab',
        render: (lead) => (
          <span className='block max-w-[260px] overflow-hidden text-ellipsis text-sm text-text-secondary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]'>
            {lead.reason}
          </span>
        ),
      },
      {
        key: 'created_at',
        label: t('leads.detail.created'),
        render: (lead) => (
          <span className='text-sm text-text-secondary'>
            {formatDateTime(lead.created_at, i18n.language)}
          </span>
        ),
      },
      {
        key: 'updated_at',
        label: t('leads.detail.updated'),
        render: (lead) => (
          <span className='text-sm text-text-secondary'>
            {formatDateTime(lead.updated_at, i18n.language)}
          </span>
        ),
      },
      {
        key: 'actions',
        label: t('users.columns.actions'),
        align: 'right',
        render: (lead) => (
          <div className='flex items-center justify-end gap-1.5'>
            <button
              type='button'
              className='inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-subtle text-text-primary transition duration-fast hover:bg-surface-muted'
              onClick={(event) => {
                event.stopPropagation();
                void handleOpenLeadModal(lead.id);
              }}
              aria-label={t('users.actions.edit')}
            >
              <AppIcon name='edit' className='h-3.5 w-3.5' aria-hidden='true' />
            </button>
            <button
              type='button'
              className='inline-flex h-8 w-8 items-center justify-center rounded-lg bg-danger-bg text-danger transition duration-fast hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60'
              onClick={(event) => {
                event.stopPropagation();
                setDeleteLeadError(null);
                setDeletingLeadCandidate(lead);
              }}
              disabled={deletingLeadId === lead.id}
              aria-label={t('common.delete')}
            >
              {deletingLeadId === lead.id ? (
                <AppIcon name='refresh-cw' className='h-3.5 w-3.5' aria-hidden='true' />
              ) : (
                <AppIcon name='trash' className='h-3.5 w-3.5' aria-hidden='true' />
              )}
            </button>
          </div>
        ),
      },
    ],
    [branchLabels, deletingLeadId, i18n.language, statusLabelByKey, t],
  );

  async function loadLeadDetails(leadId: number) {
    setSelectedLeadId(leadId);
    setIsLeadDetailLoading(true);
    setLeadDetailError(null);

    try {
      const { data } = await apiClient.get<unknown>(`/api/leads/${leadId}/`);
      const lead = normalizeLead(data);

      if (!lead) {
        throw new Error('Invalid lead response');
      }

      setSelectedLead(lead);
      setForm(createLeadForm(lead));
    } catch {
      setSelectedLead(null);
      setLeadDetailError(
        i18n.language === 'ru'
          ? 'Не удалось загрузить детали лида.'
          : "Lid tafsilotlarini yuklab bo'lmadi.",
      );
    } finally {
      setIsLeadDetailLoading(false);
    }
  }

  async function handleOpenLeadViewModal(leadId: number) {
    setLeadModalMode('edit');
    setIsLeadViewOpen(true);
    setSaveError(null);
    await loadLeadDetails(leadId);
  }

  async function handleOpenLeadModal(leadId: number) {
    setLeadModalMode('edit');
    setIsLeadModalOpen(true);
    setSaveError(null);
    await loadLeadDetails(leadId);
  }

  function openCreateLeadModal() {
    const initialStatus = statusOptions[0]?.value ?? 'new';
    setLeadModalMode('create');
    setSelectedLeadId(null);
    setSelectedLead(null);
    setLeadDetailError(null);
    setSaveError(null);
    setForm({
      ...createLeadForm(null),
      status: initialStatus,
    });
    setIsLeadModalOpen(true);
  }

  function handleLeadViewChange() {
    if (!selectedLead) {
      return;
    }

    setLeadModalMode('edit');
    setForm(createLeadForm(selectedLead));
    setIsLeadViewOpen(false);
    setIsLeadModalOpen(true);
    setSaveError(null);
  }

  function handleCloseLeadViewModal() {
    setIsLeadViewOpen(false);
    setSelectedLeadId(null);
    setSelectedLead(null);
    setLeadDetailError(null);
    setSaveError(null);
    setLeadModalMode('edit');
    setForm(createLeadForm(null));
  }

  function handleCloseLeadModal() {
    if (isSaving) {
      return;
    }

    setIsLeadModalOpen(false);
    setLeadModalMode('edit');
    setSelectedLeadId(null);
    setSelectedLead(null);
    setLeadDetailError(null);
    setSaveError(null);
    setForm(createLeadForm(null));
  }

  async function handleDeleteLead(leadId: number) {
    setDeletingLeadId(leadId);
    try {
      await apiClient.delete(`/api/leads/${leadId}/`);
      setLeads((current) => current.filter((lead) => lead.id !== leadId));
      if (selectedLeadId === leadId) {
        handleCloseLeadModal();
        handleCloseLeadViewModal();
      }
    } finally {
      setDeletingLeadId(null);
    }
  }

  function closeDeleteLeadModal() {
    if (deletingLeadId !== null) {
      return;
    }

    setDeletingLeadCandidate(null);
    setDeleteLeadError(null);
  }

  async function confirmDeleteLead() {
    if (!deletingLeadCandidate) {
      return;
    }

    try {
      setDeleteLeadError(null);
      await handleDeleteLead(deletingLeadCandidate.id);
      setDeletingLeadCandidate(null);
    } catch (error) {
      setDeleteLeadError(
        extractApiErrorMessage(
          error,
          i18n.language === 'ru' ? 'Не удалось удалить лид.' : "Lidni o'chirib bo'lmadi.",
        ),
      );
    }
  }

  function handleResetFilters() {
    setFilters({
      status: 'all',
      branch: 'all',
      search: '',
      date_from: '',
      date_to: '',
    });
  }

  function handleResetLeadStatusFilters() {
    setLeadStatusSearch('');
    setLeadStatusActiveFilter('all');
  }

  async function handleSaveLead() {
    const payload = {
      client_name: form.client_name.trim(),
      phone: form.phone.trim(),
      branch: form.branch,
      reason: form.reason.trim(),
      status: form.status,
    };

    if (!payload.client_name || !payload.phone) {
      setSaveError(
        i18n.language === 'ru'
          ? 'Заполните обязательные поля.'
          : "Majburiy maydonlarni to'ldiring.",
      );
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      if (leadModalMode === 'edit' && !selectedLeadId) {
        throw new Error('Missing lead id');
      }

      const { data } =
        leadModalMode === 'create'
          ? await apiClient.post<unknown>('/api/leads/', payload)
          : await apiClient.patch<unknown>(`/api/leads/${selectedLeadId}/`, payload);

      const updatedLead = normalizeLead(data);
      if (!updatedLead) {
        throw new Error('Invalid lead response');
      }

      if (leadModalMode === 'create') {
        setLeads((current) => [updatedLead, ...current]);
        setIsLeadModalOpen(false);
        setForm(createLeadForm(null));
      } else {
        setLeads((current) =>
          current.map((lead) =>
            lead.id === updatedLead.id ? updatedLead : lead,
          ),
        );
        setIsLeadModalOpen(false);
        setSelectedLeadId(null);
        setSelectedLead(null);
        setLeadDetailError(null);
        setForm(createLeadForm(null));
      }
    } catch {
      setSaveError(
        i18n.language === 'ru'
          ? 'Не удалось сохранить изменения.'
          : "O'zgarishlarni saqlab bo'lmadi.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function reloadStatusOptionsAndCatalog() {
    const [statusOptionsResponse, statusCatalogResponse] = await Promise.all([
      apiClient.get<unknown>('/api/leads/statuses/'),
      apiClient.get<unknown>('/api/lead-statuses/'),
    ]);

    const nextOptions = normalizeStatusOptions(statusOptionsResponse.data);
    if (nextOptions.length > 0) {
      setStatusOptions(nextOptions);
    } else {
      setStatusOptions(FALLBACK_STATUS_OPTIONS);
    }

    setLeadStatusCatalog(
      sortLeadStatusCatalog(normalizeLeadStatusCatalog(statusCatalogResponse.data)),
    );
  }

  function openLeadStatusCreateModal() {
    const nextSortOrder =
      leadStatusCatalog.length > 0
        ? Math.max(...leadStatusCatalog.map((item) => item.sort_order)) + 1
        : 1;

    setLeadStatusModalMode('create');
    setEditingLeadStatusId(null);
    setLeadStatusForm(createLeadStatusFormState(null, nextSortOrder));
    setIsLeadStatusCodeManuallyEdited(false);
    setLeadStatusFormError(null);
    setIsLeadStatusModalOpen(true);
  }

  async function openLeadStatusEditModal(statusId: number) {
    setLeadStatusModalMode('edit');
    setEditingLeadStatusId(statusId);
    setIsLeadStatusCodeManuallyEdited(true);
    setLeadStatusFormError(null);
    setIsLeadStatusSaving(true);

    try {
      const { data } = await apiClient.get<unknown>(`/api/lead-statuses/${statusId}/`);
      const item = normalizeLeadStatusCatalog([data])[0] ?? null;
      if (!item) {
        throw new Error('Invalid status payload');
      }

      setLeadStatusForm(createLeadStatusFormState(item));
      setIsLeadStatusModalOpen(true);
    } catch (error) {
      setLeadStatusFormError(
        extractApiErrorMessage(
          error,
          i18n.language === 'ru'
            ? 'Не удалось загрузить статус лидов.'
            : "Lid statusini yuklab bo'lmadi.",
        ),
      );
      setIsLeadStatusModalOpen(true);
    } finally {
      setIsLeadStatusSaving(false);
    }
  }

  function closeLeadStatusModal() {
    if (isLeadStatusSaving) {
      return;
    }

    setIsLeadStatusModalOpen(false);
    setLeadStatusFormError(null);
  }

  async function handleDeleteLeadStatus(statusId: number) {
    setDeletingLeadStatusId(statusId);
    try {
      await apiClient.delete(`/api/lead-statuses/${statusId}/`);
      await reloadStatusOptionsAndCatalog();
      setLeadStatusCatalogError(null);
    } catch (error) {
      setLeadStatusCatalogError(
        extractApiErrorMessage(
          error,
          i18n.language === 'ru'
            ? 'Не удалось удалить статус лидов.'
            : "Lid statusini o'chirib bo'lmadi.",
        ),
      );
      throw error;
    } finally {
      setDeletingLeadStatusId(null);
    }
  }

  function closeDeleteLeadStatusModal() {
    if (deletingLeadStatusId !== null) {
      return;
    }

    setDeletingLeadStatusCandidate(null);
    setDeleteLeadStatusError(null);
  }

  async function handleConfirmDeleteLeadStatus() {
    if (!deletingLeadStatusCandidate) {
      return;
    }

    try {
      setDeleteLeadStatusError(null);
      await handleDeleteLeadStatus(deletingLeadStatusCandidate.id);
      setDeletingLeadStatusCandidate(null);
    } catch (error) {
      setDeleteLeadStatusError(
        extractApiErrorMessage(
          error,
          i18n.language === 'ru'
            ? 'Не удалось удалить статус лидов.'
            : "Lid statusini o'chirib bo'lmadi.",
        ),
      );
    }
  }

  async function handleSubmitLeadStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLeadStatusSaving) {
      return;
    }

    setLeadStatusFormError(null);
    const normalizedCode = leadStatusForm.code.trim().toLowerCase();
    const payload = {
      code: normalizedCode,
      label: leadStatusForm.label.trim(),
      sort_order: Math.trunc(Number(leadStatusForm.sort_order)),
      is_active: leadStatusForm.is_active,
    };

    if (!payload.code) {
      setLeadStatusFormError(
        i18n.language === 'ru'
          ? 'Введите код статуса.'
          : 'Status kodini kiriting.',
      );
      return;
    }

    if (!STATUS_CODE_SLUG_REGEX.test(payload.code)) {
      setLeadStatusFormError(
        i18n.language === 'ru'
          ? 'Код должен быть slug: только буквы, цифры, "_" или "-".'
          : 'Kod slug bo‘lishi kerak: faqat harf, raqam, "_" yoki "-".',
      );
      return;
    }

    if (!payload.label) {
      setLeadStatusFormError(
        i18n.language === 'ru'
          ? 'Введите название статуса.'
          : 'Status nomini kiriting.',
      );
      return;
    }

    const duplicateCode = leadStatusCatalog.some((item) => {
      if (leadStatusModalMode === 'edit' && editingLeadStatusId && item.id === editingLeadStatusId) {
        return false;
      }

      return item.code.trim().toLowerCase() === payload.code;
    });

    if (duplicateCode) {
      setLeadStatusFormError(
        i18n.language === 'ru'
          ? 'Код статуса должен быть уникальным.'
          : 'Status kodi noyob bo‘lishi kerak.',
      );
      return;
    }

    if (!Number.isFinite(payload.sort_order) || payload.sort_order < 1) {
      setLeadStatusFormError(
        i18n.language === 'ru'
          ? 'Порядок должен быть числом.'
          : "Tartib maydoni raqam bo'lishi kerak.",
      );
      return;
    }

    setIsLeadStatusSaving(true);
    try {
      const maxSortOrder =
        leadStatusCatalog.length > 0
          ? Math.max(...leadStatusCatalog.map((item) => item.sort_order))
          : 0;

      if (leadStatusModalMode === 'create') {
        const conflictingStatus =
          leadStatusCatalog.find((item) => item.sort_order === payload.sort_order) ?? null;
        if (conflictingStatus) {
          await apiClient.patch(`/api/lead-statuses/${conflictingStatus.id}/`, {
            sort_order: maxSortOrder + 1,
          });
        }
        await apiClient.post('/api/lead-statuses/', payload);
      } else {
        if (!editingLeadStatusId) {
          throw new Error('Missing lead status id');
        }

        const currentStatus =
          leadStatusCatalog.find((item) => item.id === editingLeadStatusId) ?? null;
        const conflictingStatus =
          leadStatusCatalog.find(
            (item) =>
              item.id !== editingLeadStatusId && item.sort_order === payload.sort_order,
          ) ?? null;

        if (
          currentStatus &&
          conflictingStatus &&
          currentStatus.sort_order !== payload.sort_order
        ) {
          await apiClient.patch(`/api/lead-statuses/${conflictingStatus.id}/`, {
            sort_order: currentStatus.sort_order,
          });
        }

        await apiClient.patch(`/api/lead-statuses/${editingLeadStatusId}/`, payload);
      }

      await reloadStatusOptionsAndCatalog();
      setLeadStatusCatalogError(null);
      setIsLeadStatusModalOpen(false);
    } catch (error) {
      setLeadStatusFormError(
        extractApiErrorMessage(
          error,
          i18n.language === 'ru'
            ? 'Не удалось сохранить статус лидов.'
            : "Lid statusini saqlab bo'lmadi.",
        ),
      );
    } finally {
      setIsLeadStatusSaving(false);
    }
  }

  const header = (
    <PageHeader
      eyebrow={t('leads.pipelineEyebrow')}
      title={t('leads.title')}
      subtitle={t('leads.subtitle')}
      actions={
        tableView === 'lead_statuses' && canManageLeadStatuses ? (
          <div className='flex flex-wrap items-center gap-2'>
            <span className='inline-flex min-h-8 items-center gap-2 rounded-pill bg-primary/12 px-3 text-[12px] font-semibold text-text-accent'>
              <AppIcon name='activity' className='h-3.5 w-3.5' aria-hidden='true' />
              {leadStatusCatalog.length}{' '}
              {i18n.language === 'ru' ? 'статусов' : 'status'}
            </span>
            <span className='inline-flex min-h-8 items-center gap-2 rounded-pill bg-success-bg px-3 text-[12px] font-semibold text-success'>
              {i18n.language === 'ru' ? 'Активные' : 'Faol'}:{' '}
              {leadStatusCatalog.filter((item) => item.is_active).length}
            </span>
          </div>
        ) : (
          <div className='flex flex-wrap items-center gap-2'>
            <span className='inline-flex min-h-8 items-center gap-2 rounded-pill bg-primary/12 px-3 text-[12px] font-semibold text-text-accent'>
              <AppIcon name='activity' className='h-3.5 w-3.5' aria-hidden='true' />
              {summary.total} {t('leads.count')}
            </span>
            <span className='inline-flex min-h-8 items-center gap-2 rounded-pill bg-surface-subtle px-3 text-[12px] font-semibold text-text-primary'>
              {i18n.language === 'ru' ? 'Новый' : 'Yangi'}: {summary.newLeads}
            </span>
            <span className='inline-flex min-h-8 items-center gap-2 rounded-pill bg-success-bg px-3 text-[12px] font-semibold text-success'>
              {i18n.language === 'ru' ? 'Успешно' : 'Yutildi'}: {summary.won}
            </span>
            <span className='inline-flex min-h-8 items-center gap-2 rounded-pill bg-danger-bg px-3 text-[12px] font-semibold text-danger'>
              {i18n.language === 'ru' ? 'Потерян' : "Yo'qotildi"}: {summary.lost}
            </span>
          </div>
        )
      }
    />
  );

  return (
    <PageLayout header={header}>
      <PageSection>
        <PageCard allowOverflow>
          <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
            <div className='inline-flex items-center gap-1 rounded-full bg-surface-subtle p-1'>
              <button
                type='button'
                className={[
                  'inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold transition duration-fast',
                  tableView === 'leads'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-text-secondary hover:text-text-primary',
                ].join(' ')}
                onClick={() => setTableView('leads')}
              >
                {i18n.language === 'ru' ? 'Лиды' : 'Lidlar'}
              </button>
              <button
                type='button'
                className={[
                  'inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold transition duration-fast',
                  tableView === 'lead_statuses'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-text-secondary hover:text-text-primary',
                  !canManageLeadStatuses ? 'cursor-not-allowed opacity-50' : '',
                ].join(' ')}
                onClick={() => {
                  if (canManageLeadStatuses) {
                    setTableView('lead_statuses');
                  }
                }}
                disabled={!canManageLeadStatuses}
              >
                {i18n.language === 'ru' ? 'Статусы лидов' : 'Lid statuslari'}
              </button>
            </div>

            {tableView === 'lead_statuses' && canManageLeadStatuses ? (
              <button
                type='button'
                className='inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent'
                onClick={openLeadStatusCreateModal}
              >
                <AppIcon name='plus' className='h-4 w-4' aria-hidden='true' />
                {i18n.language === 'ru' ? 'New status' : 'Yangi status'}
              </button>
            ) : tableView === 'leads' ? (
              <button
                type='button'
                className='inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent'
                onClick={openCreateLeadModal}
              >
                <AppIcon name='plus' className='h-4 w-4' aria-hidden='true' />
                {i18n.language === 'ru' ? 'New lead' : 'Yangi lid'}
              </button>
            ) : null}
          </div>

          {tableView === 'lead_statuses' && canManageLeadStatuses ? (
            <>
              <FilterBar
                actions={
                  <button
                    type='button'
                    className='inline-flex min-h-9 items-center justify-center rounded-lg bg-surface-subtle px-3 text-sm font-semibold text-text-secondary transition duration-fast hover:bg-surface-muted hover:text-text-primary'
                    onClick={handleResetLeadStatusFilters}
                  >
                    {t('dashboard.filters.clearRange')}
                  </button>
                }
              >
                <SearchInput
                  value={leadStatusSearch}
                  onChange={setLeadStatusSearch}
                  placeholder={
                    i18n.language === 'ru'
                      ? 'Search by code or label...'
                      : "Kod yoki nomi bo'yicha qidiring..."
                  }
                />

                <label className='grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_180px]'>
                  <span className={labelClassName}>{t('users.filters.status')}</span>
                  <FilterSelect
                    value={leadStatusActiveFilter}
                    options={[
                      { value: 'all', label: t('users.filters.allStatuses') },
                      { value: 'active', label: t('common.active') },
                      { value: 'inactive', label: t('common.inactive') },
                    ]}
                    onChange={(value) =>
                      setLeadStatusActiveFilter(value as typeof leadStatusActiveFilter)
                    }
                  />
                </label>
              </FilterBar>

              <div className='mt-4'>
                {isLeadStatusCatalogLoading ? (
                  <LoadingState
                    title={i18n.language === 'ru' ? 'Loading statuses' : 'Statuslar yuklanmoqda'}
                    description={
                      i18n.language === 'ru'
                        ? 'Please wait while statuses are loading.'
                        : "Iltimos kuting, statuslar yuklanmoqda."
                    }
                  />
                ) : leadStatusCatalogError ? (
                  <EmptyState
                    title={i18n.language === 'ru' ? 'Statuses unavailable' : 'Statuslar mavjud emas'}
                    description={leadStatusCatalogError}
                  />
                ) : (
                  <DataTable
                    data={filteredLeadStatusCatalog}
                    columns={leadStatusColumns}
                    rowKey={(row) => String(row.id)}
                    emptyTitle={i18n.language === 'ru' ? 'No statuses found' : 'Statuslar topilmadi'}
                    emptyDescription={
                      i18n.language === 'ru'
                        ? 'Adjust filters and try again.'
                        : "Filterlarni o'zgartirib qayta urinib ko'ring."
                    }
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <FilterBar
                actions={
                  <button
                    type='button'
                    className='inline-flex min-h-9 items-center justify-center rounded-lg bg-surface-subtle px-3 text-sm font-semibold text-text-secondary transition duration-fast hover:bg-surface-muted hover:text-text-primary'
                    onClick={handleResetFilters}
                  >
                    {t('dashboard.filters.clearRange')}
                  </button>
                }
              >
                <SearchInput
                  value={filters.search}
                  onChange={(value) =>
                    setFilters((current) => ({ ...current, search: value }))
                  }
                  placeholder={t('leads.searchPlaceholder')}
                />

                <label className='grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_180px]'>
                  <span className={labelClassName}>{t('leads.status')}</span>
                  <FilterSelect
                    value={filters.status}
                    options={[
                      { value: 'all', label: t('leads.allStatuses') },
                      ...statusOptions.map((option) => ({
                        value: option.value,
                        label: statusLabelByKey[option.value] ?? option.label ?? option.value,
                      })),
                    ]}
                    onChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        status: value as LeadFilters['status'],
                      }))
                    }
                  />
                </label>

                <label className='grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_180px]'>
                  <span className={labelClassName}>
                    {i18n.language === 'ru' ? 'Филиал' : 'Filial'}
                  </span>
                  <FilterSelect
                    value={filters.branch}
                    options={[
                      {
                        value: 'all',
                        label:
                          i18n.language === 'ru'
                            ? 'Все филиалы'
                            : 'Barcha filiallar',
                      },
                      { value: 'center', label: branchLabels.center },
                      { value: 'family', label: branchLabels.family },
                      { value: 'qoyliq', label: branchLabels.qoyliq },
                    ]}
                    onChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        branch: value as LeadFilters['branch'],
                      }))
                    }
                  />
                </label>

                <label className='grid min-w-[min(300px,100%)] flex-[1_1_300px] gap-1.5 min-[640px]:flex-[0_1_320px]'>
                  <span className={labelClassName}>{t('dashboard.filters.customRange')}</span>
                  <DateRangePicker
                    dateFrom={filters.date_from}
                    dateTo={filters.date_to}
                    onChange={({ dateFrom, dateTo }) =>
                      setFilters((current) => ({
                        ...current,
                        date_from: dateFrom,
                        date_to: dateTo,
                      }))
                    }
                  />
                </label>
              </FilterBar>

              <div className='mt-4'>
                {isLeadsLoading ? (
                  <LoadingState
                    title={t('dashboard.loadingTitle')}
                    description={t('dashboard.loadingDescription')}
                  />
                ) : hasLeadsError ? (
                  <EmptyState
                    title={t('dashboard.errorTitle')}
                    description={t('dashboard.errorDescription')}
                  />
                ) : leads.length === 0 ? (
                  <EmptyState
                    title={t('leads.emptyTitle')}
                    description={t('leads.emptyDescription')}
                  />
                ) : (
                  <DataTable
                    data={leads}
                    columns={columns}
                    rowKey={(row) => String(row.id)}
                    onRowClick={(row) => {
                      void handleOpenLeadViewModal(row.id);
                    }}
                  />
                )}
              </div>
            </>
          )}
        </PageCard>
      </PageSection>

      {isLeadViewOpen ? (
        <div
          className='fixed inset-0 z-50 flex items-end justify-center bg-background-overlay/72 p-4 backdrop-blur-[2px] sm:items-center'
          onClick={handleCloseLeadViewModal}
          role='presentation'
        >
          <div
            className='w-[min(760px,calc(100vw-2rem))] rounded-[20px] border border-border-soft/60 bg-surface-card p-5 shadow-[0_32px_74px_-36px_rgba(15,23,42,0.58)]'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='mb-4 flex items-center justify-between gap-3'>
              <h2 className='m-0 text-lg font-semibold text-text-primary'>
                {leadModalMode === 'create'
                  ? i18n.language === 'ru'
                    ? 'Новый лид'
                    : 'Yangi lid'
                  : i18n.language === 'ru'
                    ? 'Детали лида'
                    : 'Lid tafsilotlari'}
                {leadModalMode === 'edit' && selectedLeadId ? ` #${selectedLeadId}` : ''}
              </h2>
              <button
                type='button'
                className='inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-subtle text-text-primary transition duration-fast hover:bg-surface-muted'
                onClick={handleCloseLeadViewModal}
              >
                <AppIcon name='close' className='h-4 w-4' aria-hidden='true' />
              </button>
            </div>

            {isLeadDetailLoading ? (
              <LoadingState
                title={t('leads.detail.loadingTitle')}
                description={t('leads.detail.loadingDescription')}
              />
            ) : leadDetailError ? (
              <EmptyState
                title={t('leads.detail.errorTitle')}
                description={leadDetailError}
              />
            ) : selectedLead ? (
              <div className='grid min-w-0 gap-3 rounded-xl bg-surface-subtle/70 p-4 text-sm text-text-secondary'>
                <div className='grid gap-1'>
                  <span className={labelClassName}>{t('leads.form.fullName')}</span>
                  <span className='font-semibold text-text-primary break-words'>{selectedLead.client_name}</span>
                </div>
                <div className='grid min-w-0 gap-1 sm:grid-cols-2'>
                  <div className='grid gap-1 min-w-0'>
                    <span className={labelClassName}>{t('leads.form.phone')}</span>
                    <span className='font-medium text-text-primary break-all'>{selectedLead.phone}</span>
                  </div>
                  <div className='grid gap-1'>
                    <span className={labelClassName}>{t('leads.form.status')}</span>
                    <StatusBadge
                      status={selectedLead.status}
                      label={statusLabelByKey[selectedLead.status] ?? selectedLead.status}
                    />
                  </div>
                </div>
                <div className='grid min-w-0 gap-1 sm:grid-cols-2'>
                  <div className='grid gap-1'>
                    <span className={labelClassName}>{i18n.language === 'ru' ? 'Филиал' : 'Filial'}</span>
                    <span className='font-medium text-text-primary'>{branchLabels[selectedLead.branch]}</span>
                  </div>
                  <div className='grid gap-1 min-w-0'>
                    <span className={labelClassName}>{i18n.language === 'ru' ? 'Источник' : 'Manba'}</span>
                    <span className='font-medium text-text-primary break-words'>{selectedLead.source}</span>
                  </div>
                </div>
                <div className='grid gap-1 min-w-0'>
                  <span className={labelClassName}>{i18n.language === 'ru' ? 'Причина' : 'Sabab'}</span>
                  <span className='text-text-primary break-words'>{selectedLead.reason}</span>
                </div>
                <div className='grid gap-1 min-w-0'>
                  <span className={labelClassName}>{i18n.language === 'ru' ? 'Последний ответ AI' : 'Oxirgi AI javobi'}</span>
                  <span className='text-text-primary break-words'>{selectedLead.last_ai_reply || t('common.na')}</span>
                </div>
              </div>
            ) : null}

            <div className='mt-4 flex items-center justify-end gap-2'>
              <button
                type='button'
                className='inline-flex min-h-10 items-center justify-center rounded-lg bg-surface-subtle px-4 text-sm font-semibold text-text-secondary transition duration-fast hover:bg-surface-muted'
                onClick={handleCloseLeadViewModal}
              >
                {t('common.cancel')}
              </button>
              <button
                type='button'
                className='inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent'
                onClick={handleLeadViewChange}
                disabled={!selectedLead}
              >
                {i18n.language === 'ru' ? 'Изменить' : "O'zgartirish"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isLeadModalOpen ? (
        <div
          className='fixed inset-0 z-50 flex items-end justify-center bg-background-overlay/72 p-4 backdrop-blur-[2px] sm:items-center'
          onClick={handleCloseLeadModal}
          role='presentation'
        >
          <div
            className='w-[min(760px,calc(100vw-2rem))] rounded-[20px] border border-border-soft/60 bg-surface-card p-5 shadow-[0_32px_74px_-36px_rgba(15,23,42,0.58)]'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='mb-4 flex items-center justify-between gap-3'>
              <h2 className='m-0 text-lg font-semibold text-text-primary'>
                {leadModalMode === 'create'
                  ? i18n.language === 'ru'
                    ? 'Новый лид'
                    : 'Yangi lid'
                  : i18n.language === 'ru'
                    ? 'Детали лида'
                    : 'Lid tafsilotlari'}
                {leadModalMode === 'edit' && selectedLeadId ? ` #${selectedLeadId}` : ''}
              </h2>
              <button
                type='button'
                className='inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-subtle text-text-primary transition duration-fast hover:bg-surface-muted'
                onClick={handleCloseLeadModal}
                disabled={isSaving}
              >
                <AppIcon name='close' className='h-4 w-4' aria-hidden='true' />
              </button>
            </div>

            <div>
              {isLeadDetailLoading ? (
                <LoadingState
                  title={t('leads.detail.loadingTitle')}
                  description={t('leads.detail.loadingDescription')}
                />
              ) : leadDetailError ? (
                <EmptyState
                  title={t('leads.detail.errorTitle')}
                  description={leadDetailError}
                />
              ) : leadModalMode === 'create' || selectedLead ? (
                <div className='grid min-w-0 gap-4'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  {leadModalMode === 'edit' && selectedLead ? (
                    <span className='text-sm text-text-secondary'>
                      {t('leads.source')}: {selectedLead.source} | AI:{' '}
                      {selectedLead.created_by_ai ? t('common.yes') : t('common.no')}
                    </span>
                  ) : <span />}
                  <StatusBadge
                    status={form.status}
                    label={statusLabelByKey[form.status] ?? form.status}
                  />
                </div>

                <div className='grid min-w-0 gap-3 sm:grid-cols-2'>
                  <label className='grid min-w-0 gap-1.5'>
                    <span className={labelClassName}>{t('leads.form.fullName')}</span>
                    <input
                      value={form.client_name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          client_name: event.target.value,
                        }))
                      }
                      className={inputClassName}
                      disabled={isSaving}
                    />
                  </label>
                  <label className='grid min-w-0 gap-1.5'>
                    <span className={labelClassName}>{t('leads.form.phone')}</span>
                    <input
                      value={form.phone}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      className={inputClassName}
                      disabled={isSaving}
                    />
                  </label>
                  <label className='grid min-w-0 gap-1.5'>
                    <span className={labelClassName}>
                      {i18n.language === 'ru' ? 'Филиал' : 'Filial'}
                    </span>
                    <FilterSelect
                      value={form.branch}
                      options={[
                        { value: 'center', label: branchLabels.center },
                        { value: 'family', label: branchLabels.family },
                        { value: 'qoyliq', label: branchLabels.qoyliq },
                      ]}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          branch: value as Branch,
                        }))
                      }
                      disabled={isSaving}
                    />
                  </label>
                  <label className='grid min-w-0 gap-1.5'>
                    <span className={labelClassName}>{t('leads.form.status')}</span>
                    <FilterSelect
                      value={form.status}
                      options={statusOptions.map((option) => ({
                        value: option.value,
                        label: statusLabelByKey[option.value] ?? option.label ?? option.value,
                      }))}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          status: value as LeadStatus,
                        }))
                      }
                      disabled={isSaving}
                    />
                  </label>
                </div>

                {leadModalMode === 'edit' ? (
                  <>
                    <label className='grid min-w-0 gap-1.5'>
                      <span className={labelClassName}>
                        {i18n.language === 'ru' ? 'Причина' : 'Sabab'}
                      </span>
                      <textarea
                        value={form.reason}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            reason: event.target.value,
                          }))
                        }
                        className={[inputClassName, 'min-h-[120px] resize-y leading-6'].join(
                          ' ',
                        )}
                        disabled={isSaving}
                      />
                    </label>

                    <div className='rounded-lg bg-surface-subtle/75 p-3'>
                      <p className='m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'>
                        {i18n.language === 'ru' ? 'Последний ответ AI' : 'Oxirgi AI javobi'}
                      </p>
                      <p className='m-0 mt-1 text-sm leading-6 text-text-secondary'>
                        {selectedLead?.last_ai_reply || t('common.na')}
                      </p>
                    </div>
                  </>
                ) : null}

                {saveError ? (
                  <p className='m-0 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger'>
                    {saveError}
                  </p>
                ) : null}

                <div className='flex items-center justify-end gap-2'>
                  <button
                    type='button'
                    className='inline-flex min-h-10 items-center justify-center rounded-lg bg-surface-subtle px-4 text-sm font-semibold text-text-secondary transition duration-fast hover:bg-surface-muted'
                    onClick={handleCloseLeadModal}
                    disabled={isSaving}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type='button'
                    className='inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent disabled:cursor-not-allowed disabled:opacity-60'
                    onClick={() => {
                      void handleSaveLead();
                    }}
                    disabled={isSaving}
                  >
                    {isSaving ? t('users.form.saving') : t('common.save')}
                  </button>
                </div>
                </div>
              ) : (
                <EmptyState
                  title={t('leads.detail.errorTitle')}
                  description={t('leads.detail.errorDescription')}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isLeadStatusModalOpen ? (
        <div
          className='fixed inset-0 z-50 flex items-end justify-center bg-background-overlay/72 p-4 backdrop-blur-[2px] sm:items-center'
          onClick={closeLeadStatusModal}
          role='presentation'
        >
          <div
            className='w-[min(620px,calc(100vw-2rem))] rounded-[20px] border border-border-soft/60 bg-surface-card p-5 shadow-[0_32px_74px_-36px_rgba(15,23,42,0.58)]'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='mb-4 flex items-center justify-between gap-3'>
              <h2 className='m-0 text-lg font-semibold text-text-primary'>
                {leadStatusModalMode === 'create'
                  ? i18n.language === 'ru'
                    ? 'New status'
                    : 'Yangi status'
                  : i18n.language === 'ru'
                    ? 'Edit status'
                    : 'Statusni tahrirlash'}
              </h2>
              <button
                type='button'
                className='inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-subtle text-text-primary transition duration-fast hover:bg-surface-muted'
                onClick={closeLeadStatusModal}
                disabled={isLeadStatusSaving}
              >
                <AppIcon name='close' className='h-4 w-4' aria-hidden='true' />
              </button>
            </div>

            <form className='grid min-w-0 gap-3' onSubmit={handleSubmitLeadStatus}>
              <div className='grid min-w-0 gap-3 sm:grid-cols-2'>
                <label className='grid min-w-0 gap-1.5'>
                  <span className={labelClassName}>{i18n.language === 'ru' ? 'Code' : 'Kod'}</span>
                  <input
                    className={inputClassName}
                    value={leadStatusForm.code}
                    onChange={(event) => {
                      const nextCode = event.target.value;
                      setIsLeadStatusCodeManuallyEdited(nextCode.trim().length > 0);
                      setLeadStatusForm((current) => ({
                        ...current,
                        code: nextCode,
                      }));
                    }}
                    placeholder={i18n.language === 'ru' ? 'Напр: archived' : "Masalan: archived"}
                    disabled={isLeadStatusSaving}
                    required
                  />
                  {leadStatusForm.code.trim().length > 0 && !isLeadStatusCodeValid ? (
                    <span className='text-xs font-medium text-danger'>
                      {i18n.language === 'ru'
                        ? 'Slug: буквы, цифры, "_" или "-".'
                        : 'Slug: harf, raqam, "_" yoki "-".'}
                    </span>
                  ) : null}
                </label>

                <label className='grid min-w-0 gap-1.5'>
                  <span className={labelClassName}>{i18n.language === 'ru' ? 'Label' : 'Nomi'}</span>
                  <input
                    className={inputClassName}
                    value={leadStatusForm.label}
                    onChange={(event) =>
                      setLeadStatusForm((current) => {
                        const nextLabel = event.target.value;
                        if (
                          leadStatusModalMode === 'create' &&
                          !isLeadStatusCodeManuallyEdited
                        ) {
                          return {
                            ...current,
                            label: nextLabel,
                            code: toStatusCodeSlug(nextLabel),
                          };
                        }

                        return {
                          ...current,
                          label: nextLabel,
                        };
                      })
                    }
                    disabled={isLeadStatusSaving}
                    required
                  />
                </label>
              </div>

              <div className='grid min-w-0 gap-3 sm:grid-cols-2'>
                <label className='grid min-w-0 gap-1.5'>
                  <span className={labelClassName}>{i18n.language === 'ru' ? 'Order' : 'Tartib'}</span>
                  <input
                    type='number'
                    min={1}
                    step={1}
                    className={inputClassName}
                    value={leadStatusForm.sort_order}
                    onChange={(event) =>
                      setLeadStatusForm((current) => ({
                        ...current,
                        sort_order: event.target.value,
                      }))
                    }
                    disabled={isLeadStatusSaving}
                    required
                  />
                </label>

                <label className='inline-flex items-end gap-2 pb-2 text-sm font-medium text-text-primary'>
                  <input
                    type='checkbox'
                    checked={leadStatusForm.is_active}
                    onChange={(event) =>
                      setLeadStatusForm((current) => ({
                        ...current,
                        is_active: event.target.checked,
                      }))
                    }
                    disabled={isLeadStatusSaving}
                  />
                  {t('common.active')}
                </label>
              </div>

              {leadStatusFormError ? (
                <p className='m-0 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger'>
                  {leadStatusFormError}
                </p>
              ) : null}

              <div className='mt-1 flex items-center justify-end gap-2'>
                <button
                  type='button'
                  className='inline-flex min-h-10 items-center justify-center rounded-lg bg-surface-subtle px-4 text-sm font-semibold text-text-secondary transition duration-fast hover:bg-surface-muted'
                  onClick={closeLeadStatusModal}
                  disabled={isLeadStatusSaving}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type='submit'
                  className='inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent disabled:cursor-not-allowed disabled:opacity-60'
                  disabled={isLeadStatusSaving || !isLeadStatusCodeValid}
                >
                  {isLeadStatusSaving
                    ? t('users.form.saving')
                    : leadStatusModalMode === 'create'
                      ? t('common.create')
                      : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmActionModal
        open={deletingLeadCandidate !== null}
        title={i18n.language === 'ru' ? 'Удалить лид' : "Lidni o'chirish"}
        description={
          deleteLeadError ??
          (deletingLeadCandidate
            ? i18n.language === 'ru'
              ? `Лид "${deletingLeadCandidate.client_name}" будет удален. Продолжить?`
              : `"${deletingLeadCandidate.client_name}" lidi o'chiriladi. Davom etasizmi?`
            : '')
        }
        confirmLabel={i18n.language === 'ru' ? 'Удалить' : "O'chirish"}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          void confirmDeleteLead();
        }}
        onClose={closeDeleteLeadModal}
        isLoading={deletingLeadId !== null}
      />

      <ConfirmActionModal
        open={deletingLeadStatusCandidate !== null}
        title={i18n.language === 'ru' ? 'Удалить статус лида' : "Lid statusini o'chirish"}
        description={
          deleteLeadStatusError ??
          (deletingLeadStatusCandidate
            ? i18n.language === 'ru'
              ? `Статус "${deletingLeadStatusCandidate.label}" будет удален. Продолжить?`
              : `"${deletingLeadStatusCandidate.label}" statusi o'chiriladi. Davom etasizmi?`
            : '')
        }
        confirmLabel={i18n.language === 'ru' ? 'Удалить' : "O'chirish"}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          void handleConfirmDeleteLeadStatus();
        }}
        onClose={closeDeleteLeadStatusModal}
        isLoading={deletingLeadStatusId !== null}
      />
    </PageLayout>
  );
}

export default DashboardPage;



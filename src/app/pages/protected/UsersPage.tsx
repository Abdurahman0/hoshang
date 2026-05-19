import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
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
import { useAuth } from '../../../auth';
import { formatLocalizedDate } from '../../../i18n/date-format';
import { apiClient } from '../../../lib/api-client';

type UserRole = 'developer' | 'admin' | 'operator';

interface CrmUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  date_joined: string;
}

interface UserFormState {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole | '';
  is_active: boolean;
  password: string;
}

const labelClassName =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted';

const inputClassName = [
  'w-full rounded-lg border border-border-soft/60 bg-surface-card px-3.5 py-2.5 text-sm font-medium text-text-primary',
  'placeholder:text-text-muted outline-none transition duration-fast',
  'focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
].join(' ');

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeUser(value: unknown): CrmUser | null {
  const dto = toRecord(value);
  if (!dto) {
    return null;
  }

  const id = Number(dto.id);
  const role = String(dto.role ?? '') as UserRole;

  if (!Number.isFinite(id) || !role) {
    return null;
  }

  return {
    id,
    username: String(dto.username ?? ''),
    first_name: String(dto.first_name ?? ''),
    last_name: String(dto.last_name ?? ''),
    email: String(dto.email ?? ''),
    role,
    is_active: Boolean(dto.is_active),
    date_joined: String(dto.date_joined ?? ''),
  };
}

function normalizeUserList(value: unknown): CrmUser[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeUser).filter((item): item is CrmUser => item !== null);
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

  if (dataRecord) {
    const firstField = Object.values(dataRecord).find((entry) => {
      if (typeof entry === 'string' && entry.trim().length > 0) {
        return true;
      }

      return Array.isArray(entry) && typeof entry[0] === 'string';
    });

    if (typeof firstField === 'string' && firstField.trim().length > 0) {
      return firstField;
    }

    if (Array.isArray(firstField) && typeof firstField[0] === 'string') {
      return String(firstField[0]);
    }
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

function createFormState(user: CrmUser | null): UserFormState {
  if (!user) {
    return {
      username: '',
      first_name: '',
      last_name: '',
      email: '',
      role: '',
      is_active: true,
      password: '',
    };
  }

  return {
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    password: '',
  };
}

function sortUsersByDate(items: CrmUser[]): CrmUser[] {
  return [...items].sort((left, right) => {
    const leftTs = Date.parse(left.date_joined);
    const rightTs = Date.parse(right.date_joined);

    if (!Number.isFinite(leftTs) || !Number.isFinite(rightTs)) {
      return 0;
    }

    return rightTs - leftTs;
  });
}

function UsersPage() {
  const { t, i18n } = useTranslation();
  const { hasRole } = useAuth();
  const isDeveloper = hasRole('developer');
  const isAdmin = hasRole('admin');
  const canManageUsers = isDeveloper || isAdmin;

  const [users, setUsers] = useState<CrmUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isUserViewOpen, setIsUserViewOpen] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [form, setForm] = useState<UserFormState>(() => createFormState(null));
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [deletingUserCandidate, setDeletingUserCandidate] = useState<CrmUser | null>(null);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);
  const roleLabelByKeyFixed: Record<UserRole, string> = {
    developer: i18n.language === 'ru' ? 'Разработчик' : 'Developer',
    admin: i18n.language === 'ru' ? 'Админ' : 'Admin',
    operator: i18n.language === 'ru' ? 'Оператор' : 'Operator',
  };

  const roleLabelByKey: Record<UserRole, string> = {
    developer: i18n.language === 'ru' ? 'Разработчик' : 'Developer',
    admin: i18n.language === 'ru' ? 'Админ' : 'Admin',
    operator: i18n.language === 'ru' ? 'Оператор' : 'Operator',
  };

  useEffect(() => {
    let isActive = true;

    async function loadUsers() {
      setIsLoading(true);
      setHasError(false);
      setPageError(null);

      try {
        const { data } = await apiClient.get<unknown>('/api/users/');
        if (!isActive) {
          return;
        }

        setUsers(sortUsersByDate(normalizeUserList(data)));
      } catch (error) {
        if (!isActive) {
          return;
        }

        setUsers([]);
        setHasError(true);
        setPageError(
          extractApiErrorMessage(
            error,
            i18n.language === 'ru'
              ? 'Не удалось загрузить пользователей.'
              : "Foydalanuvchilarni yuklab bo'lmadi.",
          ),
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      isActive = false;
    };
  }, [i18n.language]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      if (isAdmin && user.role === 'developer') {
        return false;
      }

      if (roleFilter !== 'all' && user.role !== roleFilter) {
        return false;
      }

      if (activeFilter === 'active' && !user.is_active) {
        return false;
      }

      if (activeFilter === 'inactive' && user.is_active) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [user.username, user.first_name, user.last_name, user.email, user.role]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [activeFilter, isAdmin, roleFilter, search, users]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  function openUserViewModal(user: CrmUser) {
    setSelectedUserId(user.id);
    setIsUserViewOpen(true);
  }

  function closeUserViewModal() {
    setIsUserViewOpen(false);
  }

  const columns = useMemo<DataTableColumn<CrmUser>[]>(
    () => [
      {
        key: 'username',
        label: t('users.columns.user'),
        render: (user) => (
          <div className="grid gap-0.5">
            <span className="max-w-[220px] overflow-hidden text-ellipsis text-sm font-semibold text-text-primary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{user.username}</span>
            <span className="max-w-[220px] overflow-hidden text-ellipsis text-[12px] text-text-secondary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{user.email}</span>
          </div>
        ),
      },
      {
        key: 'name',
        label: t('leads.contact'),
        render: (user) => (
          <span className="block max-w-[220px] overflow-hidden text-ellipsis text-sm text-text-primary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{`${user.first_name} ${user.last_name}`.trim()}</span>
        ),
      },
      {
        key: 'role',
        label: t('users.columns.role'),
        render: (user) => (
          <StatusBadge status={user.role} tone="accent" label={roleLabelByKeyFixed[user.role]} />
        ),
      },
      {
        key: 'active',
        label: t('users.columns.status'),
        render: (user) => (
          <StatusBadge
            status={user.is_active ? 'active' : 'inactive'}
            label={user.is_active ? t('common.active') : t('common.inactive')}
            tone={user.is_active ? 'success' : 'neutral'}
          />
        ),
      },
      {
        key: 'date_joined',
        label: t('users.columns.created'),
        render: (user) => (
          <span className="text-sm text-text-secondary">
            {formatDateTime(user.date_joined, i18n.language)}
          </span>
        ),
      },
      {
        key: 'actions',
        label: t('users.columns.actions'),
        align: 'right',
        render: (user) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-subtle text-text-primary transition duration-fast hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
              onClick={(event) => {
                event.stopPropagation();
                openEditForm(user);
              }}
              disabled={!canManageUsers || (user.role === 'developer' && !isDeveloper)}
              aria-label={t('users.actions.edit')}
            >
              <AppIcon name="edit" className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-danger-bg text-danger transition duration-fast hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={(event) => {
                event.stopPropagation();
                setDeleteUserError(null);
                setDeletingUserCandidate(user);
              }}
              disabled={
                !canManageUsers ||
                !user.is_active ||
                deletingUserId === user.id ||
                (user.role === 'developer' && !isDeveloper)
              }
              aria-label={t('users.actions.deactivate')}
            >
              {deletingUserId === user.id ? (
                <AppIcon name="refresh-cw" className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <AppIcon name="trash" className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        ),
      },
    ],
    [canManageUsers, deletingUserId, i18n.language, isDeveloper, roleLabelByKeyFixed, t],
  );

  function openCreateForm() {
    if (!canManageUsers) {
      return;
    }

    setFormMode('create');
    setEditingUserId(null);
    setForm(createFormState(null));
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(user: CrmUser) {
    if (!canManageUsers) {
      return;
    }

    if (user.role === 'developer' && !isDeveloper) {
      return;
    }

    setFormMode('edit');
    setEditingUserId(user.id);
    setForm(createFormState(user));
    setFormError(null);
    setIsFormOpen(true);
  }

  async function refreshUsersAfterMutation() {
    const { data } = await apiClient.get<unknown>('/api/users/');
    setUsers(sortUsersByDate(normalizeUserList(data)));
  }

  async function deactivateUser(userId: number) {
    if (!canManageUsers) {
      return;
    }

    setDeletingUserId(userId);
    try {
      await apiClient.delete(`/api/users/${userId}/`);
      await refreshUsersAfterMutation();
    } catch (error) {
      setFormError(
        extractApiErrorMessage(
          error,
          i18n.language === 'ru'
            ? 'Не удалось деактивировать пользователя.'
            : "Foydalanuvchini nofaol qilib bo'lmadi.",
        ),
      );
    } finally {
      setDeletingUserId(null);
    }
  }

  function closeDeleteUserModal() {
    if (deletingUserId !== null) {
      return;
    }

    setDeletingUserCandidate(null);
    setDeleteUserError(null);
  }

  async function handleConfirmDeleteUser() {
    if (!deletingUserCandidate) {
      return;
    }

    setDeleteUserError(null);
    setDeletingUserId(deletingUserCandidate.id);
    try {
      await apiClient.delete(`/api/users/${deletingUserCandidate.id}/`);
      await refreshUsersAfterMutation();
      setDeletingUserCandidate(null);
    } catch (error) {
      setDeleteUserError(
        extractApiErrorMessage(
          error,
          i18n.language === 'ru'
            ? 'Не удалось деактивировать пользователя.'
            : "Foydalanuvchini nofaol qilib bo'lmadi.",
        ),
      );
    } finally {
      setDeletingUserId(null);
    }
  }

  function closeForm() {
    if (isSaving) {
      return;
    }
    setIsFormOpen(false);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    setFormError(null);

    const payload = {
      username: form.username.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
      is_active: form.is_active,
      password: form.password.trim(),
    };

    if (!payload.username || !payload.first_name || !payload.last_name || !payload.email) {
      setFormError(t('users.form.requiredError'));
      return;
    }

    if (!payload.role) {
      setFormError(
        i18n.language === 'ru' ? 'Выберите роль пользователя.' : 'Foydalanuvchi rolini tanlang.',
      );
      return;
    }

    if (!isDeveloper && payload.role === 'developer') {
      setFormError(
        i18n.language === 'ru'
          ? 'Админ не может создавать или обновлять разработчиков.'
          : 'Admin developer rolini yaratolmaydi yoki yangilay olmaydi.',
      );
      return;
    }

    if (formMode === 'create' && payload.password.length < 8) {
      setFormError(t('users.form.passwordError'));
      return;
    }

    setIsSaving(true);
    try {
      if (formMode === 'create') {
        await apiClient.post('/api/users/', payload);
      } else {
        if (!editingUserId) {
          setFormError(t('users.form.saveError'));
          return;
        }

        const patchPayload: Record<string, unknown> = {
          username: payload.username,
          first_name: payload.first_name,
          last_name: payload.last_name,
          email: payload.email,
          role: payload.role,
          is_active: payload.is_active,
        };

        if (payload.password.length > 0) {
          patchPayload.password = payload.password;
        }

        await apiClient.patch(`/api/users/${editingUserId}/`, patchPayload);
      }

      await refreshUsersAfterMutation();
      closeForm();
    } catch (error) {
      setFormError(
        extractApiErrorMessage(error, t('users.form.saveError')),
      );
    } finally {
      setIsSaving(false);
    }
  }

  const roleOptions = [
    { value: 'all', label: t('users.filters.allRoles') },
    ...(isDeveloper ? [{ value: 'developer', label: roleLabelByKeyFixed.developer }] : []),
    { value: 'admin', label: roleLabelByKeyFixed.admin },
    { value: 'operator', label: roleLabelByKeyFixed.operator },
  ];

  const header = (
    <PageHeader
      eyebrow={t('users.eyebrow')}
      title={t('users.title')}
      subtitle={t('users.subtitle')}
      actions={
        <div className="flex items-center gap-2">
          <span className="inline-flex min-h-8 items-center gap-2 rounded-pill bg-primary/12 px-3 text-[12px] font-semibold text-text-accent">
            <AppIcon name="users" className="h-3.5 w-3.5" aria-hidden="true" />
            {filteredUsers.length} {t('users.records')}
          </span>
          {canManageUsers ? (
            <button
              type="button"
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent"
              onClick={openCreateForm}
            >
              <AppIcon name="plus" className="h-4 w-4" aria-hidden="true" />
              {t('users.newUser')}
            </button>
          ) : null}
        </div>
      }
    />
  );

  return (
    <PageLayout header={header}>
      <PageSection>
        <FilterBar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('users.searchPlaceholder')}
          />

          <label className="grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_180px]">
            <span className={labelClassName}>{t('users.filters.role')}</span>
            <FilterSelect
              value={roleFilter}
              options={roleOptions}
              onChange={(value) => setRoleFilter(value as typeof roleFilter)}
            />
          </label>

          <label className="grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_180px]">
            <span className={labelClassName}>{t('users.filters.status')}</span>
            <FilterSelect
              value={activeFilter}
              options={[
                { value: 'all', label: t('users.filters.allStatuses') },
                { value: 'active', label: t('common.active') },
                { value: 'inactive', label: t('common.inactive') },
              ]}
              onChange={(value) => setActiveFilter(value as typeof activeFilter)}
            />
          </label>
        </FilterBar>

        <PageCard>
          {isLoading ? (
            <LoadingState
              title={i18n.language === 'ru' ? 'Загрузка пользователей' : 'Foydalanuvchilar yuklanmoqda'}
              description={i18n.language === 'ru' ? 'Подождите, данные обновляются.' : "Iltimos kuting, ma'lumotlar yangilanmoqda."}
            />
          ) : hasError ? (
            <EmptyState
              title={t('users.errorTitle', { defaultValue: 'Users are unavailable' })}
              description={pageError ?? t('users.errorDescription', { defaultValue: 'Failed to load users list.' })}
            />
          ) : (
            <DataTable
              data={filteredUsers}
              columns={columns}
              rowKey={(row) => String(row.id)}
              selectedRowKey={selectedUserId ? String(selectedUserId) : null}
              onRowClick={(row) => openUserViewModal(row)}
              emptyTitle={t('users.emptyTitle')}
              emptyDescription={t('users.emptyDescription')}
            />
          )}
        </PageCard>
      </PageSection>

      {isUserViewOpen && selectedUser ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background-overlay/72 p-4 backdrop-blur-[2px] sm:items-center"
          onClick={closeUserViewModal}
          role="presentation"
        >
          <div
            className="w-[min(620px,calc(100vw-2rem))] rounded-[20px] border border-border-soft/60 bg-surface-card p-5 shadow-[0_32px_74px_-36px_rgba(15,23,42,0.58)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="m-0 text-lg font-semibold text-text-primary">
                {t('users.detail.profile')}
              </h2>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-subtle text-text-primary transition duration-fast hover:bg-surface-muted"
                onClick={closeUserViewModal}
              >
                <AppIcon name="close" className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-3 rounded-xl bg-surface-subtle/70 p-4 text-sm text-text-secondary">
              <div className="grid gap-1">
                <span className={labelClassName}>Username</span>
                <span className="font-semibold text-text-primary">{selectedUser.username}</span>
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                <div className="grid gap-1 min-w-0">
                  <span className={labelClassName}>{t('leads.contact')}</span>
                  <span className="font-medium text-text-primary break-words">{`${selectedUser.first_name} ${selectedUser.last_name}`.trim()}</span>
                </div>
                <div className="grid gap-1 min-w-0">
                  <span className={labelClassName}>Email</span>
                  <span className="font-medium text-text-primary break-all">{selectedUser.email}</span>
                </div>
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                <div className="grid gap-1">
                  <span className={labelClassName}>{t('users.columns.role')}</span>
                  <span className="font-medium text-text-primary">{roleLabelByKeyFixed[selectedUser.role]}</span>
                </div>
                <div className="grid gap-1">
                  <span className={labelClassName}>{t('users.columns.status')}</span>
                  <StatusBadge
                    status={selectedUser.is_active ? 'active' : 'inactive'}
                    label={selectedUser.is_active ? t('common.active') : t('common.inactive')}
                    tone={selectedUser.is_active ? 'success' : 'neutral'}
                  />
                </div>
              </div>
              <div className="grid gap-1">
                <span className={labelClassName}>{t('users.columns.created')}</span>
                <span className="font-medium text-text-primary">{formatDateTime(selectedUser.date_joined, i18n.language)}</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-surface-subtle px-4 text-sm font-semibold text-text-secondary transition duration-fast hover:bg-surface-muted"
                onClick={closeUserViewModal}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  openEditForm(selectedUser);
                  closeUserViewModal();
                }}
                disabled={!canManageUsers || (selectedUser.role === 'developer' && !isDeveloper)}
              >
                {i18n.language === 'ru' ? 'Изменить' : "O'zgartirish"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background-overlay/72 p-4 backdrop-blur-[2px] sm:items-center"
          onClick={closeForm}
          role="presentation"
        >
          <div
            className="w-full max-w-[680px] rounded-[20px] border border-border-soft/60 bg-surface-card p-5 shadow-[0_32px_74px_-36px_rgba(15,23,42,0.58)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="m-0 text-lg font-semibold text-text-primary">
                {formMode === 'create' ? t('users.form.createTitle') : t('users.form.editTitle')}
              </h2>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-subtle text-text-primary transition duration-fast hover:bg-surface-muted"
                onClick={closeForm}
                disabled={isSaving}
              >
                <AppIcon name="close" className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form className="grid gap-3" onSubmit={handleSubmit} autoComplete="off">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className={labelClassName}>{i18n.language === 'ru' ? 'Логин' : 'Username'}</span>
                  <input
                    className={inputClassName}
                    value={form.username}
                    name="crm_user_username"
                    autoComplete="off"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, username: event.target.value }))
                    }
                    disabled={isSaving}
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className={labelClassName}>{t('users.form.email')}</span>
                  <input
                    type="email"
                    className={inputClassName}
                    value={form.email}
                    name="crm_user_email"
                    autoComplete="off"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, email: event.target.value }))
                    }
                    disabled={isSaving}
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className={labelClassName}>{i18n.language === 'ru' ? 'Имя' : 'Ism'}</span>
                  <input
                    className={inputClassName}
                    value={form.first_name}
                    name="crm_user_first_name"
                    autoComplete="off"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, first_name: event.target.value }))
                    }
                    disabled={isSaving}
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className={labelClassName}>{i18n.language === 'ru' ? 'Фамилия' : 'Familiya'}</span>
                  <input
                    className={inputClassName}
                    value={form.last_name}
                    name="crm_user_last_name"
                    autoComplete="off"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, last_name: event.target.value }))
                    }
                    disabled={isSaving}
                    required
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className={labelClassName}>{t('users.form.role')}</span>
                  <FilterSelect
                    value={form.role}
                    options={[
                      ...(formMode === 'create'
                        ? [
                            {
                              value: '',
                              label:
                                i18n.language === 'ru'
                                  ? 'Выберите роль'
                                  : 'Rolni tanlang',
                            },
                          ]
                        : []),
                      ...(isDeveloper ? [{ value: 'developer', label: roleLabelByKeyFixed.developer }] : []),
                      { value: 'admin', label: roleLabelByKeyFixed.admin },
                      { value: 'operator', label: roleLabelByKeyFixed.operator },
                    ]}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, role: value as UserRole | '' }))
                    }
                    disabled={isSaving}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className={labelClassName}>
                    {t('users.form.password')} {formMode === 'create' ? `(${t('users.form.passwordRequired')})` : `(${t('users.form.passwordOptional')})`}
                  </span>
                  <input
                    type="password"
                    className={inputClassName}
                    value={form.password}
                    name="crm_user_password"
                    autoComplete="new-password"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder={formMode === 'create' ? '********' : t('users.form.passwordOptional')}
                    disabled={isSaving}
                  />
                </label>
              </div>

              {formMode === 'edit' ? (
                <label className="inline-flex items-center gap-2 text-sm font-medium text-text-primary">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, is_active: event.target.checked }))
                    }
                    disabled={isSaving}
                  />
                  {t('users.form.activeUser')}
                </label>
              ) : null}

              {formError ? (
                <p className="m-0 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger">
                  {formError}
                </p>
              ) : null}

              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-surface-subtle px-4 text-sm font-semibold text-text-secondary transition duration-fast hover:bg-surface-muted"
                  onClick={closeForm}
                  disabled={isSaving}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                >
                  {isSaving
                    ? t('users.form.saving')
                    : formMode === 'create'
                      ? t('users.form.createSubmit')
                      : t('users.form.editSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmActionModal
        open={deletingUserCandidate !== null}
        title={i18n.language === 'ru' ? 'Удалить пользователя' : "Foydalanuvchini o'chirish"}
        description={
          deleteUserError ??
          (deletingUserCandidate
            ? i18n.language === 'ru'
              ? `Пользователь "${deletingUserCandidate.username}" будет деактивирован. Продолжить?`
              : `"${deletingUserCandidate.username}" foydalanuvchisi nofaol qilinadi. Davom etasizmi?`
            : '')
        }
        confirmLabel={i18n.language === 'ru' ? 'Удалить' : "O'chirish"}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          void handleConfirmDeleteUser();
        }}
        onClose={closeDeleteUserModal}
        isLoading={deletingUserId !== null}
      />
    </PageLayout>
  );
}

export default UsersPage;

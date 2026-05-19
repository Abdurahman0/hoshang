import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ru } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { formatLocalizedDate, formatUzMonthYear } from '../../../i18n/date-format';
import { Calendar } from '../../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import AppIcon from '../icons/AppIcon';

interface DateRangePickerProps {
  dateFrom: string;
  dateTo: string;
  onChange: (next: { dateFrom: string; dateTo: string }) => void;
}

const UZ_WEEKDAYS_SHORT = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya'] as const;

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseIsoDate(value: string): Date | undefined {
  if (!isIsoDate(value)) {
    return undefined;
  }

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function DateRangePicker({ dateFrom, dateTo, onChange }: DateRangePickerProps) {
  const { t, i18n } = useTranslation();
  const isUzbek = i18n.language.toLowerCase().startsWith('uz');
  const locale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ';
  const calendarLocale = i18n.language === 'ru' ? ru : undefined;
  const [isOpen, setIsOpen] = useState(false);

  const selectedRange = useMemo<DateRange | undefined>(() => {
    const from = parseIsoDate(dateFrom);
    const to = parseIsoDate(dateTo);

    if (!from || !to) {
      return undefined;
    }

    return { from, to };
  }, [dateFrom, dateTo]);

  const label = selectedRange?.from && selectedRange?.to
    ? `${formatLocalizedDate(selectedRange.from, i18n.language, {
        locale,
        withYear: true,
        shortMonth: true,
      })} - ${formatLocalizedDate(selectedRange.to, i18n.language, {
        locale,
        withYear: true,
        shortMonth: true,
      })}`
    : t('dashboard.filters.pickRange');

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border-0 bg-surface-subtle/90 px-3.5 text-left text-sm font-medium text-text-primary shadow-sm outline-none transition duration-fast hover:bg-surface-card focus-visible:ring-2 focus-visible:ring-primary/20"
          aria-label={t('dashboard.filters.customRange')}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <AppIcon name="calendar" className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </span>
          <AppIcon
            name="chevron-down"
            className={[
              'h-4 w-4 shrink-0 text-text-muted transition duration-fast',
              isOpen ? 'rotate-180 text-text-secondary' : '',
            ].join(' ')}
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-3">
        <Calendar
          mode="range"
          weekStartsOn={1}
          selected={selectedRange}
          defaultMonth={selectedRange?.to ?? selectedRange?.from ?? new Date()}
          locale={calendarLocale}
          formatters={
            isUzbek
              ? {
                  formatCaption: date => formatUzMonthYear(date, false),
                  formatWeekdayName: date => UZ_WEEKDAYS_SHORT[(date.getDay() + 6) % 7],
                }
              : undefined
          }
          onSelect={(range: DateRange | undefined) => {
            if (!range?.from) {
              onChange({ dateFrom: '', dateTo: '' });
              return;
            }

            const from = toIsoDate(range.from);
            const to = toIsoDate(range.to ?? range.from);
            onChange({ dateFrom: from, dateTo: to });
          }}
        />

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border-soft/70 pt-2">
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-md px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary transition duration-fast hover:bg-surface-subtle hover:text-text-primary"
            onClick={() => onChange({ dateFrom: '', dateTo: '' })}
          >
            {t('dashboard.filters.clearRange')}
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-foreground transition duration-fast hover:bg-primary-accent"
            onClick={() => setIsOpen(false)}
          >
            {t('common.save')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DateRangePicker;


import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { FrequencyBadge } from '../../components/budget/FrequencyBadge';
import { MaterialSymbol } from '../../components/ui/MaterialSymbol';
import { amountForMonth, isDueInMonth } from '../../lib/dueThisMonth';
import { formatDueDay, formatDueMonthDay, formatMoney } from '../../lib/format';
import type { Account, Category, Entry } from '../../lib/types';

function SortableHandle({
  attributes,
  listeners,
  label,
}: {
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
  label: string;
}) {
  return (
    <button
      type="button"
      className="text-muted hover:text-foreground flex h-10 w-8 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
      aria-label={label}
      {...attributes}
      {...listeners}
    >
      <MaterialSymbol name="drag_indicator" />
    </button>
  );
}

function SortableCategory({
  category,
  organizeMode,
  children,
}: {
  category: Category;
  organizeMode: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `cat:${category.id}`,
    disabled: !organizeMode,
  });

  return (
    <section
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { opacity: 0.7 } : null),
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex items-center gap-1 px-1">
        {organizeMode ? (
          <SortableHandle
            attributes={attributes}
            listeners={listeners}
            label={t('plan.dragCategory')}
          />
        ) : null}
        <h2 className="text-muted text-xs font-semibold tracking-wide uppercase">
          {category.name}
        </h2>
      </div>
      {children}
    </section>
  );
}

function SortableEntryRow({
  entry,
  organizeMode,
  due,
  accountName,
  accountColor,
  currency,
  locale,
  year,
  month,
  onOpen,
}: {
  entry: Entry;
  organizeMode: boolean;
  due: boolean;
  accountName: string | null;
  accountColor: string | null;
  currency: string;
  locale: string;
  year: number;
  month: number;
  onOpen: (entry: Entry) => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `entry:${entry.id}`,
    disabled: !organizeMode,
  });

  const displayAmount = amountForMonth(entry, year, month) ?? entry.amount_cents;
  const signed = entry.kind === 'income' ? displayAmount : -displayAmount;

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { opacity: 0.7 } : null),
      }}
      className={due ? 'entry-row' : 'entry-row entry-row--inactive'}
      {...(accountColor ? { 'data-account-color': accountColor } : null)}
    >
      <div className="flex items-stretch gap-0">
        {organizeMode ? (
          <SortableHandle
            attributes={attributes}
            listeners={listeners}
            label={t('plan.dragEntry')}
          />
        ) : null}
        <button
          type="button"
          className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-3 text-left sm:px-4"
          onClick={() => {
            if (!organizeMode) onOpen(entry);
          }}
          disabled={organizeMode}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="entry-row__name truncate font-medium">{entry.name}</span>
            <span
              className={`entry-row__amount shrink-0 tabular-nums ${
                entry.kind === 'income' ? 'text-success' : 'text-foreground'
              }`}
            >
              {formatMoney(signed, currency, locale, entry.kind === 'income')}
            </span>
          </div>
          <div className="text-muted flex min-w-0 items-center gap-x-3 text-xs">
            <FrequencyBadge frequency={entry.frequency} />
            <span className="inline-flex shrink-0 items-center gap-1">
              <MaterialSymbol name="event" className="text-[1rem]" />
              {entry.frequency === 'monthly'
                ? formatDueDay(entry.due_day, locale)
                : formatDueMonthDay(
                    due ? month : (entry.due_month ?? month),
                    entry.due_day,
                    locale,
                  )}
            </span>
            {accountName ? (
              <span className="inline-flex min-w-0 shrink items-center gap-1 truncate">
                <MaterialSymbol name="account_balance_wallet" className="text-[1rem]" />
                <span className="truncate">{accountName}</span>
              </span>
            ) : null}
            {entry.kind === 'credit' ? (
              <span className="inline-flex shrink-0 items-center gap-1">
                <MaterialSymbol name="credit_score" className="text-[1rem]" />
                {t('entry.credit')}
              </span>
            ) : null}
            {!due ? (
              <span className="entry-row__skip-badge shrink-0">{t('plan.notThisMonth')}</span>
            ) : null}
            {entry.comment ? (
              <span className="entry-row__comment ml-auto max-w-[45%] min-w-0 truncate text-right">
                {entry.comment}
              </span>
            ) : null}
          </div>
        </button>
      </div>
    </li>
  );
}

export function PlanListView({
  categories,
  entries,
  accounts,
  organizeMode,
  currency,
  locale,
  year,
  month,
  onOpenEntry,
  onReorder,
}: {
  categories: Category[];
  entries: Entry[];
  accounts: Account[];
  organizeMode: boolean;
  currency: string;
  locale: string;
  year: number;
  month: number;
  onOpenEntry: (entry: Entry) => void;
  onReorder: (next: {
    categories?: Array<{ id: string; sort_order: number }>;
    entries?: Array<{ id: string; sort_order: number; category_id?: string }>;
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  const categoryIds = sortedCategories.map((c) => `cat:${c.id}`);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith('cat:') && overId.startsWith('cat:')) {
      const oldIndex = sortedCategories.findIndex((c) => `cat:${c.id}` === activeId);
      const newIndex = sortedCategories.findIndex((c) => `cat:${c.id}` === overId);
      if (oldIndex < 0 || newIndex < 0) return;
      const moved = arrayMove(sortedCategories, oldIndex, newIndex);
      await onReorder({
        categories: moved.map((c, i) => ({ id: c.id, sort_order: i })),
      });
      return;
    }

    if (activeId.startsWith('entry:')) {
      const entryId = activeId.slice('entry:'.length);
      const activeEntry = entries.find((e) => e.id === entryId);
      if (!activeEntry) return;

      let targetCategoryId = activeEntry.category_id;
      let overEntryId: string | null = null;

      if (overId.startsWith('entry:')) {
        overEntryId = overId.slice('entry:'.length);
        const overEntry = entries.find((e) => e.id === overEntryId);
        if (overEntry) targetCategoryId = overEntry.category_id;
      } else if (overId.startsWith('cat:')) {
        targetCategoryId = overId.slice('cat:'.length);
      } else {
        return;
      }

      const sourceList = entries
        .filter((e) => e.category_id === activeEntry.category_id)
        .sort((a, b) => a.sort_order - b.sort_order);
      const destList = entries
        .filter((e) => e.category_id === targetCategoryId && e.id !== activeEntry.id)
        .sort((a, b) => a.sort_order - b.sort_order);

      const fromIndex = sourceList.findIndex((e) => e.id === activeEntry.id);
      let toIndex = destList.length;
      if (overEntryId) {
        const idx = destList.findIndex((e) => e.id === overEntryId);
        if (idx >= 0) toIndex = idx;
      }

      if (activeEntry.category_id === targetCategoryId) {
        const sameToIndex = overEntryId
          ? sourceList.findIndex((e) => e.id === overEntryId)
          : fromIndex;
        if (sameToIndex < 0 || sameToIndex === fromIndex) return;
        const moved = arrayMove(sourceList, fromIndex, sameToIndex);
        await onReorder({
          entries: moved.map((e, i) => ({
            id: e.id,
            sort_order: i,
            category_id: targetCategoryId,
          })),
        });
      } else {
        const nextDest = [...destList];
        nextDest.splice(toIndex, 0, { ...activeEntry, category_id: targetCategoryId });
        const nextSource = sourceList.filter((e) => e.id !== activeEntry.id);
        await onReorder({
          entries: [
            ...nextSource.map((e, i) => ({
              id: e.id,
              sort_order: i,
              category_id: activeEntry.category_id,
            })),
            ...nextDest.map((e, i) => ({
              id: e.id,
              sort_order: i,
              category_id: targetCategoryId,
            })),
          ],
        });
      }
    }
  }

  if (sortedCategories.length === 0) {
    return <p className="text-muted py-8 text-center text-sm">{t('plan.empty')}</p>;
  }

  const list = (
    <div className="flex flex-col gap-4">
      <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
        {sortedCategories.map((category) => {
          const catEntries = entries
            .filter((e) => e.category_id === category.id)
            .sort((a, b) => a.sort_order - b.sort_order);
          if (catEntries.length === 0 && !organizeMode) return null;
          const entryIds = catEntries.map((e) => `entry:${e.id}`);
          return (
            <SortableCategory key={category.id} category={category} organizeMode={organizeMode}>
              <ul className="glass-surface divide-glass-divider divide-y overflow-hidden">
                <SortableContext items={entryIds} strategy={verticalListSortingStrategy}>
                  {catEntries.map((entry) => (
                    <SortableEntryRow
                      key={entry.id}
                      entry={entry}
                      organizeMode={organizeMode}
                      due={isDueInMonth(entry, year, month)}
                      accountName={
                        entry.account_id ? (accountMap.get(entry.account_id)?.name ?? null) : null
                      }
                      accountColor={
                        entry.account_id ? (accountMap.get(entry.account_id)?.color ?? null) : null
                      }
                      currency={currency}
                      locale={locale}
                      year={year}
                      month={month}
                      onOpen={onOpenEntry}
                    />
                  ))}
                </SortableContext>
                {catEntries.length === 0 && organizeMode ? (
                  <li className="text-muted px-4 py-3 text-xs">{t('plan.emptyCategory')}</li>
                ) : null}
              </ul>
            </SortableCategory>
          );
        })}
      </SortableContext>
    </div>
  );

  if (!organizeMode) return list;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {list}
    </DndContext>
  );
}

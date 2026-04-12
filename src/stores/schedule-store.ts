import { create } from 'zustand';
import type { Schedule, CreateScheduleInput, UpdateScheduleInput } from '@/types/schedule';

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

interface ScheduleDraft {
  startDate: string;
  endDate: string;
  ticketId?: string;
}

interface ScheduleStore {
  schedules: Schedule[];
  loading: boolean;

  viewStartDate: string;
  viewWeeks: number;

  selectedScheduleId: string | null;
  isFormOpen: boolean;
  formMode: 'create' | 'edit';
  dragPreview: ScheduleDraft | null;

  fetchSchedules: () => Promise<void>;
  createSchedule: (input: CreateScheduleInput) => Promise<Schedule>;
  updateSchedule: (id: string, input: UpdateScheduleInput) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;

  navigateWeeks: (delta: number) => void;
  goToToday: () => void;

  selectSchedule: (id: string | null) => void;
  openCreateForm: (startDate: string, endDate: string, ticketId: string) => void;
  openEditForm: (id: string) => void;
  closeForm: () => void;
  setDragPreview: (preview: { startDate: string; endDate: string } | null) => void;
}

const yearStart = getMonday(new Date(new Date().getFullYear(), 0, 1));

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  schedules: [],
  loading: false,

  viewStartDate: toISO(yearStart),
  viewWeeks: 52,

  selectedScheduleId: null,
  isFormOpen: false,
  formMode: 'create',
  dragPreview: null,

  fetchSchedules: async () => {
    set({ loading: true });
    const { viewStartDate, viewWeeks } = get();
    const to = addDays(viewStartDate, viewWeeks * 7 - 1);
    const res = await fetch(`/api/schedules?from=${viewStartDate}&to=${to}`);
    const schedules = await res.json();
    set({ schedules, loading: false });
  },

  createSchedule: async (input: CreateScheduleInput) => {
    const res = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const schedule = await res.json();
    await get().fetchSchedules();
    return schedule;
  },

  updateSchedule: async (id: string, input: UpdateScheduleInput) => {
    set({
      schedules: get().schedules.map((schedule) =>
        schedule.id === id ? { ...schedule, ...input, updated_at: new Date().toISOString() } : schedule
      ),
    });
    await fetch(`/api/schedules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    await get().fetchSchedules();
  },

  deleteSchedule: async (id: string) => {
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
    set({ selectedScheduleId: null });
    await get().fetchSchedules();
  },

  navigateWeeks: (delta: number) => {
    const { viewStartDate } = get();
    set({ viewStartDate: addDays(viewStartDate, delta * 7) });
    get().fetchSchedules();
  },

  goToToday: () => {
    set({ viewStartDate: toISO(getMonday(new Date())) });
    get().fetchSchedules();
  },

  selectSchedule: (id: string | null) => set({ selectedScheduleId: id }),

  openCreateForm: (startDate: string, endDate: string, ticketId: string) => {
    set({
      isFormOpen: true,
      formMode: 'create',
      selectedScheduleId: null,
      dragPreview: { startDate, endDate, ticketId },
    });
  },

  openEditForm: (id: string) => {
    set({
      isFormOpen: true,
      formMode: 'edit',
      selectedScheduleId: id,
    });
  },

  closeForm: () => {
    set({
      isFormOpen: false,
      selectedScheduleId: null,
      dragPreview: null,
    });
  },

  setDragPreview: (preview) =>
    set((state) => ({
      dragPreview: preview
        ? {
            ...preview,
            ticketId: state.dragPreview?.ticketId,
          }
        : null,
    })),
}));

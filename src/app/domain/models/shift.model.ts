/** Mirrors ShiftDto / ShiftBreakDto (RFactory.Application.Modules.MasterData.DTOs). */

export interface ShiftDto {
  id: number;
  shiftCode: string;
  shiftName: string;
  /** "HH:mm:ss" — the wire format of .NET's TimeOnly. */
  startTime?: string | null;
  endTime?: string | null;
  workingMinute?: number | null;
  isActive: boolean;
  /** The shift ends on the following day, so endTime may be earlier than startTime. */
  crossDay: boolean;
}

export interface ShiftBreakDto {
  id: number;
  shiftId?: number | null;
  breakName: string;
  startTime?: string | null;
  endTime?: string | null;
  sortOrder?: number | null;
}

export type ShiftRequest = Omit<ShiftDto, 'id'>;
export type ShiftBreakRequest = Omit<ShiftBreakDto, 'id'>;

/**
 * `<input type="time">` speaks "HH:mm" while TimeOnly serialises "HH:mm:ss", so the two
 * are converted at the form boundary rather than letting either format leak.
 */
export function toTimeInput(value?: string | null): string {
  return value ? value.slice(0, 5) : '';
}

export function fromTimeInput(value: string): string | null {
  return value ? `${value}:00` : null;
}

/** Minutes since midnight, or null when the time is absent or malformed. */
function minutesOf(value?: string | null): number | null {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/**
 * Wall-clock length of a span in minutes.
 *
 * A span that ends at or before it starts is treated as crossing midnight and gets a day
 * added — that is what makes a 22:00–06:00 night shift come out as 480 rather than -960.
 */
export function spanMinutes(start?: string | null, end?: string | null): number | null {
  const from = minutesOf(start);
  const to = minutesOf(end);
  if (from === null || to === null) return null;
  return to > from ? to - from : to + 24 * 60 - from;
}

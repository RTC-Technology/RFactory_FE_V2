import { Component, OnInit, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SplitterModule } from 'primeng/splitter';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { PERMISSIONS } from '../../core/auth/permissions';
import { I18nService } from '../../core/services/i18n.service';
import { ShiftApiService, ShiftBreakApiService } from '../../core/services/shift-api.service';
import { SplitStateService } from '../../core/services/split-state.service';
import {
  ShiftBreakDto, ShiftDto, fromTimeInput, spanMinutes, toTimeInput,
} from '../../domain/models/shift.model';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';

type EntityKind = 'shift' | 'break';

interface EntityForm {
  code: string;
  name: string;
  /** "HH:mm", the format `<input type="time">` speaks. */
  start: string;
  end: string;
  workingMinute: number | null;
  isActive: boolean;
  crossDay: boolean;
  sortOrder: number | null;
}

const LABEL_KEYS: Record<EntityKind, string> = {
  shift: 'shift.shift.lower',
  break: 'shift.break.lower',
};

@Component({
  selector: 'app-shift',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, SplitterModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, TagModule, ToggleSwitchModule,
    HasPermissionDirective,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './shift.component.html',
  styleUrl: './shift.component.scss',
})
export class ShiftComponent implements OnInit {
  private readonly shiftApi = inject(ShiftApiService);
  private readonly breakApi = inject(ShiftBreakApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);
  readonly split = inject(SplitStateService);

  /** Passed into the shared toolbar template so each panel gates its own buttons. */
  readonly perms = PERMISSIONS;
  readonly toTime = toTimeInput;

  readonly loading = computed(() => this.shiftApi.loading() || this.breakApi.loading());

  // ─── Selection ──────────────────────────────────────────────────────────────
  readonly selectedShift = signal<ShiftDto | null>(null);
  readonly selectedBreak = signal<ShiftBreakDto | null>(null);

  readonly shifts = this.shiftApi.items;

  /** Breaks of the selected shift, in their declared order. */
  readonly breaks = computed(() => {
    const shiftId = this.selectedShift()?.id;
    if (shiftId == null) return [];
    return this.breakApi.items()
      .filter(b => b.shiftId === shiftId)
      .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));
  });

  /** Breaks the backend holds with no shift. No panel here can reach them. */
  readonly unassignedCount = computed(() =>
    this.breakApi.items().filter(b => b.shiftId == null).length);

  /** Wall-clock length of a shift, for the duration column. */
  shiftSpan(shift: ShiftDto): number | null {
    return spanMinutes(shift.startTime, shift.endTime);
  }

  breakSpan(item: ShiftBreakDto): number | null {
    return spanMinutes(item.startTime, item.endTime);
  }

  constructor() {
    effect(() => {
      const breaks = this.breaks();
      untracked(() => this.selectedBreak.set(this._reconcile(this.selectedBreak(), breaks)));
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    forkJoin({ shifts: this.shiftApi.load(), breaks: this.breakApi.load() }).subscribe({
      next: ({ shifts }) => this.selectedShift.set(this._reconcile(this.selectedShift(), shifts)),
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('shift.err.loadFailed'), err),
    });
  }

  // ─── Global filter ──────────────────────────────────────────────────────────

  private readonly shiftTable = viewChild<Table>('shiftTable');
  private readonly breakTable = viewChild<Table>('breakTable');

  readonly filterFields: Record<EntityKind, string[]> = {
    shift: ['shiftCode', 'shiftName'],
    break: ['breakName'],
  };

  applyFilter(kind: EntityKind, value: string): void {
    const table = kind === 'shift' ? this.shiftTable() : this.breakTable();
    table?.filterGlobal(value, 'contains');
  }

  onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
    const visible = (rows ?? []) as { id: number }[];
    if (kind === 'shift') {
      this.selectedShift.set(this._reconcile(this.selectedShift(), visible as ShiftDto[]));
    } else {
      this.selectedBreak.set(this._reconcile(this.selectedBreak(), visible as ShiftBreakDto[]));
    }
  }

  selectShift(shift: ShiftDto): void {
    if (this.selectedShift()?.id === shift.id) return;
    this.selectedShift.set(shift);
  }

  selectBreak(item: ShiftBreakDto): void {
    this.selectedBreak.set(item);
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly dialogKind = signal<EntityKind>('shift');
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  form: EntityForm = this._emptyForm();
  /** Mirrors the form's times so the working-minute hint recomputes as they are typed. */
  private readonly formTimes = signal({ start: '', end: '', crossDay: false });

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'plant.dialog.edit' : 'plant.dialog.add', {
      entity: this._noun(this.dialogKind()),
    }));

  /**
   * Span of the shift being edited minus the breaks already declared on it — a starting
   * point for the paid minutes, offered rather than written, since whether a break is
   * paid is a policy decision the plant makes.
   */
  readonly workingSuggestion = computed(() => {
    if (this.dialogKind() !== 'shift') return null;

    const { start, end } = this.formTimes();
    const span = spanMinutes(fromTimeInput(start), fromTimeInput(end));
    if (span === null) return null;

    const editing = this.editingId();
    const breakMinutes = editing === null ? 0 : this.breakApi.items()
      .filter(b => b.shiftId === editing)
      .reduce((total, b) => total + (spanMinutes(b.startTime, b.endTime) ?? 0), 0);

    return { span, breaks: breakMinutes, suggested: Math.max(0, span - breakMinutes) };
  });

  onTimeChange(): void {
    this.formTimes.set({ start: this.form.start, end: this.form.end, crossDay: this.form.crossDay });
  }

  applySuggestion(): void {
    const suggestion = this.workingSuggestion();
    if (suggestion) this.form.workingMinute = suggestion.suggested;
  }

  openCreate(kind: EntityKind): void {
    this.dialogKind.set(kind);
    this.editingId.set(null);
    this.formError.set('');
    this.form = {
      ...this._emptyForm(),
      // Breaks land at the end of the shift's list; the shift's own times seed nothing.
      sortOrder: kind === 'break' ? this._nextSortOrder() : null,
    };
    this.onTimeChange();
    this.dialogOpen.set(true);
  }

  openEdit(kind: EntityKind): void {
    const row = kind === 'shift' ? this.selectedShift() : this.selectedBreak();
    if (!row) return;

    this.dialogKind.set(kind);
    this.editingId.set(row.id);
    this.formError.set('');

    this.form = kind === 'shift'
      ? {
          ...this._emptyForm(),
          code: (row as ShiftDto).shiftCode,
          name: (row as ShiftDto).shiftName,
          start: toTimeInput((row as ShiftDto).startTime),
          end: toTimeInput((row as ShiftDto).endTime),
          workingMinute: (row as ShiftDto).workingMinute ?? null,
          isActive: (row as ShiftDto).isActive,
          crossDay: (row as ShiftDto).crossDay,
        }
      : {
          ...this._emptyForm(),
          name: (row as ShiftBreakDto).breakName,
          start: toTimeInput((row as ShiftBreakDto).startTime),
          end: toTimeInput((row as ShiftBreakDto).endTime),
          sortOrder: (row as ShiftBreakDto).sortOrder ?? null,
        };

    this.onTimeChange();
    this.dialogOpen.set(true);
  }

  save(): void {
    const kind = this.dialogKind();
    const error = this._validate(kind);
    if (error) {
      this.formError.set(error);
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const id = this.editingId();
    const request = this._buildRequest(kind, id);
    if (!request) {
      this.saving.set(false);
      return;
    }

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
        this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', { entity: this._noun(kind) }));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(err.error?.message
          || this.i18n.t('plant.err.saveFailed', { entity: this._noun(kind) }));
      },
    });
  }

  askDelete(kind: EntityKind): void {
    const row = kind === 'shift' ? this.selectedShift() : this.selectedBreak();
    if (!row) return;

    const label = kind === 'shift' ? (row as ShiftDto).shiftName : (row as ShiftBreakDto).breakName;

    this.confirm.confirm({
      header: this.i18n.t('plant.confirm.title', { entity: this._noun(kind) }),
      message: `${this.i18n.t('plant.confirm.message', { label })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      // Deleting a shift that still holds breaks is refused by the backend, which owns
      // that rule — the message it returns is shown as-is.
      accept: () => (kind === 'shift' ? this.shiftApi : this.breakApi).remove(row.id).subscribe({
        next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label })); },
        error: (err: HttpErrorResponse) =>
          this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this._noun(kind) }), err),
      }),
    });
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private _emptyForm(): EntityForm {
    return {
      code: '', name: '', start: '', end: '',
      workingMinute: null, isActive: true, crossDay: false, sortOrder: null,
    };
  }

  private _nextSortOrder(): number {
    return this.breaks().reduce((max, b) => Math.max(max, b.sortOrder ?? 0), 0) + 1;
  }

  private _noun(kind: EntityKind): string {
    return this.i18n.t(LABEL_KEYS[kind]);
  }

  private _reconcile<T extends { id: number }>(current: T | null, rows: T[]): T | null {
    const match = current ? rows.find(row => row.id === current.id) : undefined;
    return match ?? rows[0] ?? null;
  }

  private _validate(kind: EntityKind): string {
    const name = this.form.name.trim();

    if (kind === 'shift') {
      const code = this.form.code.trim();
      if (!code) return this.i18n.t('plant.err.codeRequired');
      if (!name) return this.i18n.t('plant.err.nameRequired');

      const clash = this.shifts().find(
        s => s.shiftCode.toLowerCase() === code.toLowerCase() && s.id !== this.editingId(),
      );
      if (clash) return this.i18n.t('plant.err.codeTaken', { code });

      if (!this.form.start || !this.form.end) return this.i18n.t('shift.err.timeRequired');
      if (this.form.start === this.form.end) return this.i18n.t('shift.err.sameTime');
      return '';
    }

    if (!name) return this.i18n.t('plant.err.nameRequired');
    const shift = this.selectedShift();
    if (!shift) return this.i18n.t('shift.err.pickShift');
    if (!this.form.start || !this.form.end) return this.i18n.t('shift.err.timeRequired');
    if (this.form.start === this.form.end) return this.i18n.t('shift.err.sameTime');

    return this._validateBreakWindow(shift);
  }

  /**
   * A break has to sit inside its shift and not collide with another one.
   *
   * Everything is measured as an offset from the shift's start rather than as a
   * wall-clock time, which is what lets a night shift work: 23:30 and 00:30 are 90 and
   * 150 minutes into a 22:00 shift, and comparing those two numbers is meaningful where
   * comparing the clock times is not.
   */
  private _validateBreakWindow(shift: ShiftDto): string {
    const shiftLength = spanMinutes(shift.startTime, shift.endTime);
    if (shiftLength === null) return '';

    const offset = (time: string | null | undefined): number | null => {
      const fromStart = spanMinutes(shift.startTime, time);
      return fromStart === null ? null : fromStart;
    };

    const start = offset(fromTimeInput(this.form.start));
    const end = offset(fromTimeInput(this.form.end));
    if (start === null || end === null) return '';

    if (start > shiftLength || end > shiftLength || end <= start) {
      return this.i18n.t('shift.err.breakOutside', {
        start: toTimeInput(shift.startTime),
        end: toTimeInput(shift.endTime),
      });
    }

    const clash = this.breaks().find(other => {
      if (other.id === this.editingId()) return false;
      const otherStart = offset(other.startTime);
      const otherEnd = offset(other.endTime);
      if (otherStart === null || otherEnd === null) return false;
      return start < otherEnd && otherStart < end;
    });

    return clash ? this.i18n.t('shift.err.breakOverlap', { name: clash.breakName }) : '';
  }

  private _buildRequest(kind: EntityKind, id: number | null): Observable<unknown> | null {
    if (kind === 'shift') {
      const body = {
        shiftCode: this.form.code.trim(),
        shiftName: this.form.name.trim(),
        startTime: fromTimeInput(this.form.start),
        endTime: fromTimeInput(this.form.end),
        workingMinute: this.form.workingMinute,
        isActive: this.form.isActive,
        crossDay: this.form.crossDay,
      };
      return id ? this.shiftApi.update(id, body) : this.shiftApi.create(body);
    }

    const shiftId = this.selectedShift()?.id;
    if (shiftId == null) return null;

    const body = {
      shiftId,
      breakName: this.form.name.trim(),
      startTime: fromTimeInput(this.form.start),
      endTime: fromTimeInput(this.form.end),
      sortOrder: this.form.sortOrder,
    };
    return id ? this.breakApi.update(id, body) : this.breakApi.create(body);
  }

  private _ok(detail: string): void {
    this.messages.add({ severity: 'success', summary: this.i18n.t('common.success'), detail, life: 2500 });
  }

  private _fail(detail: string, err?: HttpErrorResponse): void {
    this.messages.add({
      severity: 'error',
      summary: this.i18n.t('common.error'),
      detail: err?.error?.message || detail,
      life: 4500,
    });
  }
}

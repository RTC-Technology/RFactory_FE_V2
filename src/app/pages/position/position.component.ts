import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';
import { I18nService } from '../../core/services/i18n.service';
import { PositionApiService } from '../../core/services/position-api.service';
import { PositionDto, PositionRequest } from '../../domain/models/position.model';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-position',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, TextareaModule, TagModule, CheckboxModule,
    HasPermissionDirective,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './position.component.html',
  styleUrl: './position.component.scss',
})
export class PositionComponent extends PermissionAwarePage implements OnInit {
  private readonly api = inject(PositionApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);

  readonly loading = this.api.loading;
  readonly positions = computed(() =>
    [...this.api.items()].sort((a, b) => a.positionCode.localeCompare(b.positionCode)));

  readonly selected = signal<PositionDto | null>(null);

  private readonly table = viewChild<Table>('positionTable');
  readonly filterFields = ['positionCode', 'positionName', 'department'];

  constructor() { super(PERMISSIONS.position); }

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.api.load().subscribe({
      next: rows => this.selected.set(this._reconcile(this.selected(), rows)),
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('position.err.load'), err),
    });
  }

  applyFilter(value: string): void { this.table()?.filterGlobal(value, 'contains'); }
  onFiltered(rows: unknown[] | null): void {
    this.selected.set(this._reconcile(this.selected(), (rows ?? []) as PositionDto[]));
  }
  select(row: PositionDto): void { this.selected.set(row); }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  form: PositionRequest = this._empty();

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'position.dialog.edit' : 'position.dialog.add'));

  openCreate(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.form = this._empty();
    this.dialogOpen.set(true);
  }

  openEdit(): void {
    const row = this.selected();
    if (!row) return;
    this.editingId.set(row.id);
    this.formError.set('');
    this.form = {
      positionCode: row.positionCode,
      positionName: row.positionName,
      department: row.department ?? '',
      description: row.description ?? '',
      isActive: row.isActive ?? true,
    };
    this.dialogOpen.set(true);
  }

  save(): void {
    const error = this._validate();
    if (error) { this.formError.set(error); return; }
    this.saving.set(true);
    this.formError.set('');
    const id = this.editingId();
    const req: PositionRequest = {
      positionCode: this.form.positionCode.trim(),
      positionName: this.form.positionName.trim(),
      department: this.form.department?.trim() || null,
      description: this.form.description?.trim() || null,
      isActive: this.form.isActive,
    };
    const obs = id ? this.api.update(id, req) : this.api.create(req);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
        this._ok(this.i18n.t(id ? 'position.ok.updated' : 'position.ok.created'));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(err.error?.message || this.i18n.t('position.err.saveFailed'));
      },
    });
  }

  askDelete(): void {
    const row = this.selected();
    if (!row) return;
    this.confirm.confirm({
      header: this.i18n.t('position.confirm.title'),
      message: `${this.i18n.t('position.confirm.message', { label: row.positionName })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.api.remove(row.id).subscribe({
        next: () => { this.reload(); this._ok(this.i18n.t('position.ok.deleted', { label: row.positionName })); },
        error: (err: HttpErrorResponse) => this._fail(this.i18n.t('position.err.deleteFailed'), err),
      }),
    });
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private _empty(): PositionRequest {
    return { positionCode: '', positionName: '', department: '', description: '', isActive: true };
  }

  private _reconcile<T extends { id: number }>(current: T | null, rows: T[]): T | null {
    const match = current ? rows.find(r => r.id === current.id) : undefined;
    return match ?? rows[0] ?? null;
  }

  private _validate(): string {
    if (!this.form.positionCode.trim()) return this.i18n.t('position.err.codeRequired');
    if (!this.form.positionName.trim()) return this.i18n.t('position.err.nameRequired');
    const clash = this.api.items().find(
      p => p.positionCode.toLowerCase() === this.form.positionCode.trim().toLowerCase()
        && p.id !== this.editingId(),
    );
    return clash ? this.i18n.t('position.err.codeTaken', { code: this.form.positionCode.trim() }) : '';
  }

  private _ok(detail: string): void {
    this.messages.add({ severity: 'success', summary: this.i18n.t('common.success'), detail, life: 2500 });
  }
  private _fail(detail: string, err?: HttpErrorResponse): void {
    this.messages.add({ severity: 'error', summary: this.i18n.t('common.error'),
      detail: err?.error?.message || detail, life: 4500 });
  }
}

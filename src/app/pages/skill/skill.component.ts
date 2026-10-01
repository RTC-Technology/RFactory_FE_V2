import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Table, TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';
import { I18nService } from '../../core/services/i18n.service';
import { SkillApiService } from '../../core/services/skill-api.service';
import { SkillDto, SkillRequest } from '../../domain/models/skill.model';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-skill',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, TextareaModule,
    HasPermissionDirective,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './skill.component.html',
  styleUrl: './skill.component.scss',
})
export class SkillComponent extends PermissionAwarePage implements OnInit {
  private readonly api = inject(SkillApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);

  readonly loading = this.api.loading;
  readonly skills = computed(() =>
    [...this.api.items()].sort((a, b) =>
      (a.skillCategory ?? '').localeCompare(b.skillCategory ?? '') || a.skillCode.localeCompare(b.skillCode)));

  readonly selected = signal<SkillDto | null>(null);

  private readonly table = viewChild<Table>('skillTable');
  readonly filterFields = ['skillCode', 'skillName', 'skillCategory'];

  constructor() { super(PERMISSIONS.skill); }

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.api.load().subscribe({
      next: rows => this.selected.set(this._reconcile(this.selected(), rows)),
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('skill.err.load'), err),
    });
  }

  applyFilter(value: string): void { this.table()?.filterGlobal(value, 'contains'); }
  onFiltered(rows: unknown[] | null): void {
    this.selected.set(this._reconcile(this.selected(), (rows ?? []) as SkillDto[]));
  }
  select(row: SkillDto): void { this.selected.set(row); }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  form: SkillRequest = this._empty();

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'skill.dialog.edit' : 'skill.dialog.add'));

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
      skillCode: row.skillCode,
      skillName: row.skillName,
      skillCategory: row.skillCategory ?? '',
      description: row.description ?? '',
    };
    this.dialogOpen.set(true);
  }

  save(): void {
    const error = this._validate();
    if (error) { this.formError.set(error); return; }
    this.saving.set(true);
    this.formError.set('');
    const id = this.editingId();
    const req: SkillRequest = {
      skillCode: this.form.skillCode.trim(),
      skillName: this.form.skillName.trim(),
      skillCategory: this.form.skillCategory?.trim() || null,
      description: this.form.description?.trim() || null,
    };
    const obs = id ? this.api.update(id, req) : this.api.create(req);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
        this._ok(this.i18n.t(id ? 'skill.ok.updated' : 'skill.ok.created'));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(err.error?.message || this.i18n.t('skill.err.saveFailed'));
      },
    });
  }

  askDelete(): void {
    const row = this.selected();
    if (!row) return;
    this.confirm.confirm({
      header: this.i18n.t('skill.confirm.title'),
      message: `${this.i18n.t('skill.confirm.message', { label: row.skillName })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.api.remove(row.id).subscribe({
        next: () => { this.reload(); this._ok(this.i18n.t('skill.ok.deleted', { label: row.skillName })); },
        error: (err: HttpErrorResponse) => this._fail(this.i18n.t('skill.err.deleteFailed'), err),
      }),
    });
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private _empty(): SkillRequest {
    return { skillCode: '', skillName: '', skillCategory: '', description: '' };
  }

  private _reconcile<T extends { id: number }>(current: T | null, rows: T[]): T | null {
    const match = current ? rows.find(r => r.id === current.id) : undefined;
    return match ?? rows[0] ?? null;
  }

  private _validate(): string {
    if (!this.form.skillCode.trim()) return this.i18n.t('skill.err.codeRequired');
    if (!this.form.skillName.trim()) return this.i18n.t('skill.err.nameRequired');
    const clash = this.api.items().find(
      s => s.skillCode.toLowerCase() === this.form.skillCode.trim().toLowerCase()
        && s.id !== this.editingId(),
    );
    return clash ? this.i18n.t('skill.err.codeTaken', { code: this.form.skillCode.trim() }) : '';
  }

  private _ok(detail: string): void {
    this.messages.add({ severity: 'success', summary: this.i18n.t('common.success'), detail, life: 2500 });
  }
  private _fail(detail: string, err?: HttpErrorResponse): void {
    this.messages.add({ severity: 'error', summary: this.i18n.t('common.error'),
      detail: err?.error?.message || detail, life: 4500 });
  }
}

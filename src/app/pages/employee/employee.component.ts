import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { EmployeeApiService } from '../../core/services/employee-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';
import { EMPLOYEE_GENDERS, EMPLOYEE_STATUS, EmployeeDto, EmployeeRequest, employeeStatusOf } from '../../domain/models/employee.model';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-employee',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, TextareaModule, TagModule, SelectModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './employee.component.html',
  styleUrl: './employee.component.scss',
})
export class EmployeeComponent extends PermissionAwarePage implements OnInit {

  private readonly employeeApi = inject(EmployeeApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);

  readonly statusOf = employeeStatusOf;

  readonly loading = this.employeeApi.loading;

  readonly employees = computed(() =>
    [...this.employeeApi.items()].sort((a, b) =>
      (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER)
      || a.employeeCode.localeCompare(b.employeeCode)));

  // ─── Lookups ────────────────────────────────────────────────────────────────

  statusLabel(value: number): string {
    const type = EMPLOYEE_STATUS.find(s => s.value === value);
    return type ? this.i18n.t(type.labelKey) : '';
  }

  /** Gender travels as a short code (M/F/O); the dialog picks it by label, the grid shows it. */
  genderLabel(value?: string | null): string {
    const gender = EMPLOYEE_GENDERS.find(g => g.value === value);
    return gender ? this.i18n.t(gender.labelKey) : '';
  }

  readonly statusOptions = computed(() =>
    EMPLOYEE_STATUS.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));

  readonly genderOptions = computed(() =>
    EMPLOYEE_GENDERS.map(g => ({ label: this.i18n.t(g.labelKey), value: g.value })));

  /** `type="date"` inputs bind `yyyy-MM-dd`, but the backend sends full date-times. */
  static readonly toDateInput = (value?: string | null): string =>
    value ? value.slice(0, 10) : '';

  // ─── Selection ──────────────────────────────────────────────────────────────
  readonly selected = signal<EmployeeDto | null>(null);

  constructor() {
    super(PERMISSIONS.employee);
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.employeeApi.load().subscribe({
      next: rows => this.selected.set(this._reconcile(this.selected(), rows)),
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('employee.err.load'), err),
    });
  }

  // ─── Filter ─────────────────────────────────────────────────────────────────

  private readonly table = viewChild<Table>('employeeTable');
  readonly filterFields = ['employeeCode', 'fullName', 'position', 'email'];

  applyFilter(value: string): void {
    this.table()?.filterGlobal(value, 'contains');
  }

  onFiltered(rows: unknown[] | null | undefined): void {
    this.selected.set(this._reconcile(this.selected(), (rows ?? []) as EmployeeDto[]));
  }

  select(row: EmployeeDto): void {
    this.selected.set(row);
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  form = this._emptyForm();

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'employee.dialog.edit' : 'employee.dialog.add', {
      entity: this.i18n.t('employee.lower'),
    }));

  openCreate(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.form = { ...this._emptyForm(), employeeCode: '' };
    this.dialogOpen.set(true);
  }

  openEdit(): void {
    const row = this.selected();
    if (!row) return;
    this.editingId.set(row.id);
    this.formError.set('');
    this.form = {
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      nickName: row.nickName ?? '',
      organizationId: row.organizationId ?? null,
      position: row.position ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      gender: row.gender ?? '',
      birthDate: EmployeeComponent.toDateInput(row.birthDate),
      hireDate: EmployeeComponent.toDateInput(row.hireDate),
      terminationDate: EmployeeComponent.toDateInput(row.terminationDate),
      status: row.status,
      remark: row.remark ?? '',
    };
    this.dialogOpen.set(true);
  }
save(): void {
    const error = this._validate();
    if (error) {
      this.formError.set(error);
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const id = this.editingId();

    this._saveEmployee(id).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
        this._ok(this.i18n.t(id ? 'employee.ok.updated' : 'employee.ok.created', {
          entity: this.i18n.t('employee.lower'),
        }));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(err.error?.message
          || this.i18n.t('employee.err.saveFailed', { entity: this.i18n.t('employee.lower') }));
      },
    });
  }

  askDelete(): void {
    const row = this.selected();
    if (!row) return;

    this.confirm.confirm({
      header: this.i18n.t('employee.confirm.title', { entity: this.i18n.t('employee.lower') }),
      message: `${this.i18n.t('employee.confirm.message', { label: row.fullName })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.employeeApi.remove(row.id).subscribe({
        next: () => { this.reload(); this._ok(this.i18n.t('employee.ok.deleted', { label: row.fullName })); },
        error: (err: HttpErrorResponse) =>
          this._fail(this.i18n.t('employee.err.deleteFailed', { entity: this.i18n.t('employee.lower') }), err),
      }),
    });
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private _emptyForm() {
    return {
      employeeCode: null as string | null,
      fullName: null as string | null,
      nickName: null as string | null,
      // Carried through the payload but not edited on this screen yet: the backend maps the
      // whole request onto the entity, so dropping it here would blank the column on save.
      organizationId: null as number | null,
      position: null as string | null,
      phone: null as string | null,
      email: null as string | null,
      gender: null as string | null,
      birthDate: null as string | null,
      hireDate: null as string | null,
      terminationDate: null as string | null,
      status: 1,
      remark: null as string | null,
    };
  }

  private _reconcile<T extends { id: number }>(current: T | null, rows: T[]): T | null {
    const match = current ? rows.find(row => row.id === current.id) : undefined;
    return match ?? rows[0] ?? null;
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

  private _validate(): string {
    const employeeCode = this.form.employeeCode?.trim();

    if (!employeeCode) {
      return this.i18n.t('employee.err.codeRequired');
    }

    if (!this.form.fullName) {
      return this.i18n.t('employee.err.nameRequired');
    }

    // EmployeeCode is unique across the entire employee list.
    const clash = this.employeeApi.items().find(
      employee =>
        employee.employeeCode.toLowerCase() === employeeCode.toLowerCase() &&
        employee.id !== this.editingId(),
    );

    return clash
      ? this.i18n.t('employee.err.codeTaken', { code: employeeCode })
      : '';
  }

  private _saveEmployee(id: number | null): Observable<EmployeeDto> {
    const body: EmployeeRequest = {
      employeeCode: this.form.employeeCode?.trim() || '',
      fullName: this.form.fullName?.trim() || '',
      nickName: this.form.nickName?.trim() || null,
      organizationId: this.form.organizationId,
      position: this.form.position?.trim() || null,
      phone: this.form.phone?.trim() || null,
      email: this.form.email?.trim() || null,
      gender: this.form.gender?.trim() || null,
      birthDate: this.form.birthDate || null,
      hireDate: this.form.hireDate || null,
      terminationDate: this.form.terminationDate || null,
      status: this.form.status,
      remark: this.form.remark?.trim() || null,
    };
    return id ? this.employeeApi.update(id, body) : this.employeeApi.create(body);
  }
}
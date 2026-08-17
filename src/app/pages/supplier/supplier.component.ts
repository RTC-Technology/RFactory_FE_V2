import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SupplierApiService } from '../../core/services/master-data-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';
import { SUPPLIER_STATUS, SupplierDto, SupplierRequest, supplierStatusOf } from '../../domain/models/master-data.model';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SelectModule } from 'primeng/select';
import { InputMaskModule } from 'primeng/inputmask';

@Component({
  selector: 'app-supplier',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, TextareaModule, TagModule, ToggleSwitchModule, SelectModule, InputMaskModule, TagModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './supplier.component.html',
  styleUrl: './supplier.component.scss',
})
export class SupplierComponent extends PermissionAwarePage implements OnInit {

  private readonly supplierApi = inject(SupplierApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);

  readonly statusOf = supplierStatusOf;

  readonly loading = this.supplierApi.loading;

  readonly suppliers = computed(() =>
    [...this.supplierApi.items()].sort((a, b) =>
      (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER)
      || a.supplierCode.localeCompare(b.supplierCode)));


  // ─── Lookups ────────────────────────────────────────────────────────────────


  statusLabel(value: number): string {
    const type = SUPPLIER_STATUS.find(s => s.value === value);
    return type ? this.i18n.t(type.labelKey) : '';
  }

  readonly statusOptions = computed(() =>
    SUPPLIER_STATUS.map(s => ({ label: this.i18n.t(s.labelKey), value: s.value })));
  // ─── Selection ──────────────────────────────────────────────────────────────
  readonly selected = signal<SupplierDto | null>(null);

  constructor() {
    // Single-entity screen: the toolbar reads canAdd()/canEdit()/canDelete() straight off
    // the base rather than naming a code per button.
    super(PERMISSIONS.supplier);
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.supplierApi.load().subscribe({
      next: rows => this.selected.set(this._reconcile(this.selected(), rows)),
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('supplier.err.load'), err),
    });
  }

  // ─── Filter ─────────────────────────────────────────────────────────────────

  private readonly table = viewChild<Table>('supplierTable');
  readonly filterFields = ['supplierCode', 'supplierName', 'description'];

  applyFilter(value: string): void {
    this.table()?.filterGlobal(value, 'contains');
  }

  onFiltered(rows: unknown[] | null | undefined): void {
    this.selected.set(this._reconcile(this.selected(), (rows ?? []) as SupplierDto[]));
  }

  select(row: SupplierDto): void {
    this.selected.set(row);
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  form = this._emptyForm();

  readonly dialogTitle = computed(() =>
    this.i18n.t(this.editingId() ? 'supplier.dialog.edit' : 'supplier.dialog.add', {
      entity: this.i18n.t('supplier.lower'),
    }));

  openCreate(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.form = { ...this._emptyForm(), supplierCode: '' };
    this.dialogOpen.set(true);
  }

  openEdit(): void {
    const row = this.selected();
    if (!row) return;
    this.editingId.set(row.id);
    this.formError.set('');
    this.form = {
      supplierCode: row.supplierCode,
      supplierName: row.supplierName,
      shortName: row.shortName ?? '',
      taxCode: row.taxCode ?? '',
      supplierType: row.supplierType ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      website: row.website ?? '',
      contactPerson: row.contactPerson ?? '',
      paymentTerm: row.paymentTerm ?? '',
      currencyCode: row.currencyCode ?? '',
      status: row.status,
      description: row.description ?? '',
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

    this._saveSupplier(id).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
        this._ok(this.i18n.t(id ? 'supplier.ok.updated' : 'supplier.ok.created', {
          entity: this.i18n.t('supplier.lower'),
        }));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(err.error?.message
          || this.i18n.t('supplier.err.saveFailed', { entity: this.i18n.t('supplier.lower') }));
      },
    });


  }

  askDelete(): void {
    const row = this.selected();
    if (!row) return;

    this.confirm.confirm({
      header: this.i18n.t('supplier.confirm.title', { entity: this.i18n.t('supplier.lower') }),
      message: `${this.i18n.t('supplier.confirm.message', { label: row.supplierName })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      // The backend owns the "still used by products" rule and returns its own message.
      accept: () => this.supplierApi.remove(row.id).subscribe({
        next: () => { this.reload(); this._ok(this.i18n.t('supplier.ok.deleted', { label: row.supplierName })); },
        error: (err: HttpErrorResponse) =>
          this._fail(this.i18n.t('supplier.err.deleteFailed', { entity: this.i18n.t('supplier.lower') }), err),
      }),
    });
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private _emptyForm() {
    return {
      supplierCode: null as string | null,
      supplierName: null as string | null,
      shortName: null as string | null,
      taxCode: null as string | null,
      supplierType: null as string | null,
      phone: null as string | null,
      email: null as string | null,
      website: null as string | null,
      contactPerson: null as string | null,
      paymentTerm: null as string | null,
      currencyCode: null as string | null,
      status: 1,
      description: null as string | null
    };
  }

  // private _nextSortOrder(): number {
  //   return this.types().reduce((max, t) => Math.max(max, t.sortOrder ?? 0), 0) + 1;
  // }

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
    const supplierCode = this.form.supplierCode?.trim();

    if (!supplierCode) {
      return this.i18n.t('supplier.err.supplierCodeRequired');
    }

    if (!this.form.supplierName) {
      return this.i18n.t('supplier.err.supplierNameRequired');
    }

    // SupplierCode is unique across the entire supplier list.
    const clash = this.supplierApi.items().find(
      supplier =>
        supplier.supplierCode.toLowerCase() === supplierCode.toLowerCase() &&
        supplier.id !== this.editingId(),
    );

    return clash
      ? this.i18n.t('supplier.err.codeTaken', { code: supplierCode })
      : '';
  }

  private _saveSupplier(id: number | null): Observable<SupplierDto> {
    const body: SupplierRequest = {
      supplierCode: this.form.supplierCode?.trim() || '',
      supplierName: this.form.supplierName?.trim() || '',
      shortName: this.form.shortName?.trim() || null,
      taxCode: this.form.taxCode?.trim() || null,
      supplierType: this.form.supplierType?.trim() || null,
      phone: this.form.phone?.trim() || null,
      email: this.form.email?.trim() || null,
      website: this.form.website?.trim() || null,
      contactPerson: this.form.contactPerson?.trim() || null,
      paymentTerm: this.form.paymentTerm?.trim() || null,
      currencyCode: this.form.currencyCode?.trim() || null,
      status: this.form.status,
      description: this.form.description?.trim() || null,

    };
    return id ? this.supplierApi.update(id, body) : this.supplierApi.create(body);
  }
}

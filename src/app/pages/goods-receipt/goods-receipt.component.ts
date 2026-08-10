import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
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
import { I18nService } from '../../core/services/i18n.service';
import { PERMISSIONS } from '../../core/auth/permissions';
import { GoodsReceiptApiService } from '../../core/services/goods-receipt-api.service';
import { GoodsReceiptDto } from '../../domain/models/goods-receipt.model';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { Observable } from 'rxjs';



@Component({
  selector: 'app-goods-receipt',
  imports: [
    CommonModule, FormsModule,
    TableModule, ButtonModule, DialogModule, ConfirmDialogModule, ToastModule,
    InputTextModule, TextareaModule, TagModule, ToggleSwitchModule,
    HasPermissionDirective,
  ],
  templateUrl: './goods-receipt.component.html',
  styleUrl: './goods-receipt.component.scss',
})
export class GoodsReceiptComponent implements OnInit {

  private readonly api = inject(GoodsReceiptApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);

  readonly perms = PERMISSIONS.productType;
  readonly loading = this.api.loading;



  /** Ordered the way the product screen's type picker will show them. */
  readonly types = computed(() =>
    [...this.api.items()].sort((a, b) =>
      (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER)
      || a.receiptNo.localeCompare(b.receiptNo)));

  readonly selected = signal<GoodsReceiptDto | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.api.load().subscribe({
      next: rows => this.selected.set(this._reconcile(this.selected(), rows)),
      error: (err: HttpErrorResponse) => this._fail(this.i18n.t('ptype.err.load'), err),
    });
  }

  // ─── Filter ─────────────────────────────────────────────────────────────────

  private readonly table = viewChild<Table>('typeTable');
  readonly filterFields = ['productTypeCode', 'productTypeName', 'description'];

  applyFilter(value: string): void {
    this.table()?.filterGlobal(value, 'contains');
  }

  onFiltered(rows: unknown[] | null | undefined): void {
    this.selected.set(this._reconcile(this.selected(), (rows ?? []) as GoodsReceiptDto[]));
  }

  select(row: GoodsReceiptDto): void {
    this.selected.set(row);
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  readonly dialogOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  form = this._emptyForm();
  penCreate(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.form = { ...this._emptyForm(), id: this._nextSortOrder() };
    this.dialogOpen.set(true);
  }

  openEdit(): void {
    const row = this.selected();
    if (!row) return;
    this.editingId.set(row.id);
    this.formError.set('');
    // this.form = {
    //   receiptNo: row.receiptNo,
    //   warehouseId: row.warehouseId,
    //   description: row.description ?? '',
    //   sortOrder: row.sortOrder ?? null,
    //   isActive: row.isActive,
    // };
    this.dialogOpen.set(true);
  }

  save(): void {
    const code = this.form.receiptNo.trim();
    // const name = this.form.name.trim();
    if (!code) { this.formError.set(this.i18n.t('plant.err.codeRequired')); return; }
    // if (!name) { this.formError.set(this.i18n.t('plant.err.nameRequired')); return; }

    const clash = this.types().find(
      t => t.receiptNo.toLowerCase() === code.toLowerCase() && t.id !== this.editingId(),
    );
    if (clash) { this.formError.set(this.i18n.t('plant.err.codeTaken', { code })); return; }

    this.saving.set(true);
    this.formError.set('');

    const id = this.editingId();
    const body = {
      receiptNo: code,
      // productTypeName: name,
      // description: this.form.description.trim() || null,
      // sortOrder: this.form.sortOrder,
      // isActive: this.form.isActive,
    };
    const request: Observable<unknown> = id ? this.api.update(id, body) : this.api.create(body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.reload();
        this._ok(this.i18n.t(id ? 'plant.ok.updated' : 'plant.ok.created', {
          entity: this.i18n.t('ptype.lower'),
        }));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(err.error?.message
          || this.i18n.t('plant.err.saveFailed', { entity: this.i18n.t('ptype.lower') }));
      },
    });
  }

  askDelete(): void {
    const row = this.selected();
    if (!row) return;

    this.confirm.confirm({
      header: this.i18n.t('plant.confirm.title', { entity: this.i18n.t('ptype.lower') }),
      message: `${this.i18n.t('plant.confirm.message', { label: row.receiptNo })} ${this.i18n.t('common.notUndoable')}`,
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      // The backend owns the "still used by products" rule and returns its own message.
      accept: () => this.api.remove(row.id).subscribe({
        next: () => { this.reload(); this._ok(this.i18n.t('plant.ok.deleted', { label: row.receiptNo })); },
        error: (err: HttpErrorResponse) =>
          this._fail(this.i18n.t('plant.err.deleteFailed', { entity: this.i18n.t('ptype.lower') }), err),
      }),
    });
  }


  // ─── Internals ──────────────────────────────────────────────────────────────

  private _emptyForm() {
    return {
      id: 0,
      receiptNo: '',
      warehouseId: null,
      supplierId: null,
      referenceType: null,
      referenceId: null,
      receiptDate: '',
      remark: null,
      receiptType: 1
    };

  }

  private _nextSortOrder(): number {
    return this.types().reduce((max, t) => Math.max(max, t.id ?? 0), 0) + 1;
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
}

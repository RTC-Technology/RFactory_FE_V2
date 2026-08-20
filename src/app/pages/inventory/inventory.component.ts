import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import { SelectModule } from 'primeng/select';
import { SplitterModule } from 'primeng/splitter';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { ConfirmationService, MessageService } from 'primeng/api';
import { InventoryApiService, InventoryTransactionApiService } from '../../core/services/inventory-api.service';
import { I18nService } from '../../core/services/i18n.service';
import { SplitStateService } from '../../core/services/split-state.service';
import { ProductApiService, UnitApiService } from '../../core/services/product-api.service';
import { INVENTORY_ACTION_TYPES, INVENTORY_REFERENCE_TYPES, INVENTORY_TRANSACTION_TYPES, InventoryDto, inventoryTransactionActionOf, InventoryTransactionDto } from '../../domain/models/inventory.model';
import { PERMISSIONS } from '../../core/auth/permissions';
import { forkJoin } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { WarehouseApiService, WarehouseLocationApiService } from '../../core/services/warehouse-api.service';

type EntityKind = 'inventory' | 'transaction';

@Component({
	selector: 'app-inventory',
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		TableModule,
		SplitterModule,
		ButtonModule,
		DialogModule,
		ConfirmDialogModule,
		ToastModule,
		InputTextModule,
		TextareaModule,
		SelectModule,
		TagModule,
		ToggleSwitchModule,
		PanelModule,
		CardModule,
		InputNumberModule,
		AutoCompleteModule
	],
	providers: [MessageService, ConfirmationService],
	templateUrl: './inventory.component.html',
	styleUrl: './inventory.component.scss',
})
export class InventoryComponent extends PermissionAwarePage implements OnInit {

	private readonly inventoryApi = inject(InventoryApiService);
	private readonly transactionApi = inject(InventoryTransactionApiService);
	private readonly unitApi = inject(UnitApiService);
	private readonly productApi = inject(ProductApiService);
	private readonly warehouseApi = inject(WarehouseApiService);
	private readonly locationApi = inject(WarehouseLocationApiService);

	private readonly messages = inject(MessageService);
	private readonly confirm = inject(ConfirmationService);
	readonly i18n = inject(I18nService);
	readonly split = inject(SplitStateService);

	readonly actionOf = inventoryTransactionActionOf;

	readonly loading = computed(() => this.inventoryApi.loading() || this.transactionApi.loading());

	readonly types = computed(() =>
		[...this.inventoryApi.items()].sort((a, b) =>
			(a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER)));

	// ─── Lookups ────────────────────────────────────────────────────────────────

	unitLabel(id?: number | null): string {
		const unit = this.unitApi.items().find(u => u.id === id);
		return unit ? (unit.symbol || unit.unitCode) : '';
	}

	productLabel(id?: number | null): string {
		const product = this.productApi.items().find(p => p.id === id);
		return product ? `${product.productCode} · ${product.productName}` : '';
	}

	warehouseLabel(id?: number | null): string {
		const warehouse = this.warehouseApi.items().find(w => w.id === id);
		return warehouse ? `${warehouse.warehouseCode} · ${warehouse.warehouseName}` : '';
	}

	locationLabel(id?: number | null): string {
		const location = this.locationApi.items().find(l => l.id === id);
		return location ? `${location.warehouseLocationCode} · ${location.warehouseLocationName}` : '';
	}

	transactionTypeLabel(value: number): string {
		const type = INVENTORY_TRANSACTION_TYPES.find(s => s.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	referenceTypeLabel(value: number): string {
		const type = INVENTORY_REFERENCE_TYPES.find(s => s.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	actionTypeLabel(value: number): string {
		const type = INVENTORY_ACTION_TYPES.find(s => s.value === value);
		return type ? this.i18n.t(type.labelKey) : '';
	}

	// ─── Selection ──────────────────────────────────────────────────────────────

	readonly selectedInventory = signal<InventoryDto | null>(null);
	readonly selectedTransaction = signal<InventoryTransactionDto | null>(null);

	/** Type filter above the product list — the first thing an operator reaches for. */
	readonly typeFilter = signal<string | null>(null);


	readonly inventory = computed(() => {
		const typeId = this.typeFilter();
		const all = this.inventoryApi.items();
		return typeId === null ? all : all.filter(p => p.serialNo === typeId);
	});

	readonly transaction = computed(() => {
		const productId = this.selectedInventory()?.productId;

		// console.log('productId:', productId);
		if (productId == null) return [];
		return this.transactionApi.items().filter(b => b.productId === productId);
	});

	/** Receipts the backend holds with no id. No panel here can reach them. */
	readonly unassignedInventory = computed(() =>
		this.inventoryApi.items().filter(b => b.id == null).length);

	constructor() {
		// The toolbar still gates through `*appHasPermission`: its `<ng-template>` already
		// binds a `canAdd` context variable meaning "a row can be added right now", which
		// would shadow the inherited signal of the same name.
		super(PERMISSIONS.inventory);

		effect(() => {
			const issue = this.inventory();
			untracked(() => this.selectedInventory.set(this._reconcile(this.selectedInventory(), issue)));
		});

		effect(() => {
			const details = this.transaction();
			untracked(() => this.selectedTransaction.set(this._reconcile(this.selectedTransaction(), details)));
		});
	}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		// Products and units are not just labels here — the detail grid's row pickers are
		// driven from them, so an empty list would leave every line unfillable.
		forkJoin({
			inventory: this.inventoryApi.load(),
			transaction: this.transactionApi.load(),
			products: this.productApi.load(),
			units: this.unitApi.load(),
			warehouses: this.warehouseApi.load(),
			locations: this.locationApi.load(),
		}).subscribe({
			error: (err: HttpErrorResponse) => this._fail(this.i18n.t('goodsIssue.err.load'), err),
		});
	}

	calculateProductTotal(locationId: number) {
		let total = 0;

		if (this.inventory()) {
			for (let inventory of this.inventory()) {
				if ((inventory.locationId ?? 0) === locationId) {
					total++;
				}
			}
		}

		return total;
	}

	// ─── Global filter ──────────────────────────────────────────────────────────

	private readonly inventoryTable = viewChild<Table>('inventoryTable');
	private readonly transactionTable = viewChild<Table>('transactionTable');

	readonly filterFields: Record<EntityKind, string[]> = {
		inventory: ['productId'],
		transaction: [],
	};

	applyFilter(kind: EntityKind, value: string): void {
		const table = { inventory: this.inventoryTable(), transaction: this.transactionTable() }[kind];
		table?.filterGlobal(value, 'contains');
	}

	onFiltered(kind: EntityKind, rows: unknown[] | null | undefined): void {
		const visible = (rows ?? []) as { id: number }[];
		if (kind === 'inventory') {
			this.selectedInventory.set(this._reconcile(this.selectedInventory(), visible as InventoryDto[]));
		} else if (kind === 'transaction') {
			this.selectedTransaction.set(this._reconcile(this.selectedTransaction(), visible as InventoryTransactionDto[]));
		}
	}

	selectInventory(issue: InventoryDto): void {
		if (this.selectedInventory()?.id === issue.id) return;
		this.selectedInventory.set(issue);
	}

	selectTransaction(detail: InventoryTransactionDto): void {
		this.selectedTransaction.set(detail);
	}

	// ─── Internals ──────────────────────────────────────────────────────────────
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

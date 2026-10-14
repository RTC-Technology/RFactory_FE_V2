import { CommonModule, formatDate } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { PERMISSIONS } from '../../core/auth/permissions';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { I18nService } from '../../core/services/i18n.service';
import { MachineApiService } from '../../core/services/equipment-api.service';
import { CustomerApiService, LineApiService } from '../../core/services/master-data-api.service';
import { UserApiService, WorkCenterApiService } from '../../core/services/organization-api.service';
import { BomApiService, ProductApiService, RoutingApiService, UnitApiService } from '../../core/services/product-api.service';
import { ProductionOrderApiService } from '../../core/services/production-order-api.service';
import { WarehouseApiService } from '../../core/services/warehouse-api.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import {
  PRODUCTION_ORDER_PRIORITIES,
  PRODUCTION_ORDER_STATUSES,
  PRODUCTION_ORDER_TYPES,
  productionOrderPriorityOf,
  productionOrderStatusOf,
  productionOrderTypeOf,
  ProductionOrderCreateRequest,
  ProductionOrderDto,
  ProductionOrderFilter,
  ProductionOrderMaterialDto,
  ProductionOrderOperationDto,
  ProductionOrderProgressRequest,
  ProductionOrderUpdateRequest,
} from '../../domain/models/production-order.model';

@Component({
  selector: 'app-production-order',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    TabsModule,
    ButtonModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    TagModule,
    Textarea,
    TooltipModule,
    HasPermissionDirective,
  ],
  providers: [MessageService, ConfirmationService],
  standalone: true,
  templateUrl: './production-order.component.html',
  styleUrl: './production-order.component.scss',
})
export class ProductionOrderComponent extends PermissionAwarePage implements OnInit {
  readonly api = inject(ProductionOrderApiService);
  readonly productApi = inject(ProductApiService);
  readonly bomApi = inject(BomApiService);
  readonly routingApi = inject(RoutingApiService);
  readonly lineApi = inject(LineApiService);
  readonly workCenterApi = inject(WorkCenterApiService);
  readonly machineApi = inject(MachineApiService);
  readonly warehouseApi = inject(WarehouseApiService);
  readonly userApi = inject(UserApiService);
  readonly customerApi = inject(CustomerApiService);
  readonly unitApi = inject(UnitApiService);

  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);

  readonly statusOptions = PRODUCTION_ORDER_STATUSES;
  readonly priorityOptions = PRODUCTION_ORDER_PRIORITIES;
  readonly orderTypeOptions = PRODUCTION_ORDER_TYPES;

  readonly orders = this.api.items;
  readonly loading = this.api.loading;

  // ─── Filter State ─────────────────────────────────────────────────────────
  readonly filterStatus = signal<number | null>(null);
  readonly filterPriority = signal<number | null>(null);
  readonly filterOrderType = signal<number | null>(null);
  readonly filterProductId = signal<number | null>(null);
  readonly filterLineId = signal<number | null>(null);
  readonly searchKeyword = signal<string>('');

  // ─── Dialogs ──────────────────────────────────────────────────────────────
  readonly showDialog = signal<boolean>(false);
  readonly dialogMode = signal<'create' | 'edit'>('create');
  readonly activeDialogTab = signal<string>('general');
  readonly showProgressDialog = signal<boolean>(false);
  readonly selectedOrder = signal<ProductionOrderDto | null>(null);

  // Form states
  formOrderNo = signal<string>('');
  formOrderType = signal<number>(4); // 4=Other/Direct
  formDescription = signal<string>('');
  formProductId = signal<number | null>(null);
  formUnitId = signal<number | null>(null);
  formBomId = signal<number | null>(null);
  formRoutingId = signal<number | null>(null);
  formLineId = signal<number | null>(null);
  formWorkCenterId = signal<number | null>(null);
  formCustomerId = signal<number | null>(null);
  formPlannedQty = signal<number>(100);
  formCompletedQty = signal<number>(0);
  formScrapQty = signal<number>(0);
  formPlannedStartDate = signal<string>('');
  formPlannedEndDate = signal<string>('');
  formActualStartDate = signal<string>('');
  formActualEndDate = signal<string>('');
  formPriority = signal<number>(2);
  formBatchNo = signal<string>('');
  formSalesOrderNo = signal<string>('');
  formRemark = signal<string>('');

  // Dynamic Tabs (AMIS Guide Features)
  formMaterials = signal<ProductionOrderMaterialDto[]>([]);
  formOperations = signal<ProductionOrderOperationDto[]>([]);

  // Progress modal form
  progressCompletedDelta = signal<number>(0);
  progressScrapDelta = signal<number>(0);
  progressBatchNo = signal<string>('');
  progressRemark = signal<string>('');

  // ─── Statistics ───────────────────────────────────────────────────────────
  readonly totalOrders = computed(() => this.orders().length);
  readonly inProgressOrders = computed(() => this.orders().filter(o => o.status === 3).length);
  readonly completedOrders = computed(() => this.orders().filter(o => o.status === 4).length);
  readonly totalPlannedQty = computed(() => this.orders().reduce((sum, o) => sum + (o.plannedQuantity || 0), 0));
  readonly totalCompletedQty = computed(() => this.orders().reduce((sum, o) => sum + (o.completedQuantity || 0), 0));
  readonly overallProgress = computed(() => {
    const planned = this.totalPlannedQty();
    if (planned <= 0) return 0;
    return Math.round(Math.min(100, (this.totalCompletedQty() / planned) * 100));
  });

  // Duration in hours
  readonly calculatedDuration = computed(() => {
    const startStr = this.formPlannedStartDate();
    const endStr = this.formPlannedEndDate();
    if (!startStr || !endStr) return null;
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return Math.round(hours * 10) / 10;
  });

  // Filtered orders list
  readonly filteredOrders = computed(() => {
    const status = this.filterStatus();
    const priority = this.filterPriority();
    const orderType = this.filterOrderType();
    const prodId = this.filterProductId();
    const lineId = this.filterLineId();
    const query = this.searchKeyword().toLowerCase().trim();

    return this.orders().filter(order => {
      if (status != null && order.status !== status) return false;
      if (priority != null && order.priority !== priority) return false;
      if (orderType != null && order.orderType !== orderType) return false;
      if (prodId != null && order.productId !== prodId) return false;
      if (lineId != null && order.lineId !== lineId) return false;
      if (query) {
        const matchNo = order.orderNo?.toLowerCase().includes(query);
        const matchDesc = order.description?.toLowerCase().includes(query);
        const matchProd = (order.productCode?.toLowerCase().includes(query) || order.productName?.toLowerCase().includes(query));
        const matchBatch = order.batchNo?.toLowerCase().includes(query);
        const matchSo = order.salesOrderNo?.toLowerCase().includes(query);
        if (!matchNo && !matchDesc && !matchProd && !matchBatch && !matchSo) return false;
      }
      return true;
    });
  });

  constructor() {
    super(PERMISSIONS.productionOrder);
  }

  ngOnInit(): void {
    this.refresh();
    this.loadLookups();
  }

  refresh(): void {
    const filter: ProductionOrderFilter = {};
    if (this.filterStatus() != null) filter.status = this.filterStatus()!;
    if (this.filterPriority() != null) filter.priority = this.filterPriority()!;
    if (this.filterOrderType() != null) filter.orderType = this.filterOrderType()!;
    if (this.filterProductId() != null) filter.productId = this.filterProductId()!;
    if (this.filterLineId() != null) filter.lineId = this.filterLineId()!;
    if (this.searchKeyword()) filter.searchKeyword = this.searchKeyword();

    this.api.load(filter).subscribe({
      error: err => this._showError(this.i18n.t('common.error'), err?.error?.message || err?.message),
    });
  }

  loadLookups(): void {
    this.productApi.load().subscribe();
    this.bomApi.load().subscribe();
    this.routingApi.load().subscribe();
    this.lineApi.load().subscribe();
    this.workCenterApi.load().subscribe();
    this.machineApi.load().subscribe();
    this.warehouseApi.load().subscribe();
    this.userApi.load().subscribe();
    this.customerApi.load().subscribe();
    this.unitApi.load().subscribe();
  }

  statusInfo(status: number) {
    return productionOrderStatusOf(status);
  }

  priorityInfo(priority: number) {
    return productionOrderPriorityOf(priority);
  }

  orderTypeInfo(type: number) {
    return productionOrderTypeOf(type);
  }

  readonly Math = Math;

  onTabChange(tab: string | number | undefined): void {
    if (tab != null) {
      this.activeDialogTab.set(String(tab));
    }
  }

  onNormQtyChange(mat: ProductionOrderMaterialDto): void {
    mat.requiredQuantity = Math.round((mat.normQuantity || 0) * this.formPlannedQty() * 10000) / 10000;
  }

  // ─── AMIS Feature Interactions ───────────────────────────────────────────
  onProductChange(productId: number | null): void {
    this.formProductId.set(productId);
    if (!productId) return;

    const prod = this.productApi.items().find(p => p.id === productId);
    if (prod?.defaultUnitId) {
      this.formUnitId.set(prod.defaultUnitId);
    }

    // Auto-suggest BOM for product
    const matchingBom = this.bomApi.items().find(b => b.productId === productId);
    if (matchingBom) {
      this.formBomId.set(matchingBom.id);
      this.loadBomMaterialsPreview(matchingBom.id, this.formPlannedQty());
    } else {
      this.formBomId.set(null);
      this.formMaterials.set([]);
    }

    // Auto-suggest Routing for product
    const matchingRouting = this.routingApi.items().find(r => r.productId === productId);
    if (matchingRouting) {
      this.formRoutingId.set(matchingRouting.id);
      this.loadRoutingOperationsPreview(matchingRouting.id);
    } else {
      this.formRoutingId.set(null);
      this.formOperations.set([]);
    }
  }

  onBomChange(bomId: number | null): void {
    this.formBomId.set(bomId);
    if (bomId) {
      this.loadBomMaterialsPreview(bomId, this.formPlannedQty());
    } else {
      this.formMaterials.set([]);
    }
  }

  onRoutingChange(routingId: number | null): void {
    this.formRoutingId.set(routingId);
    if (routingId) {
      this.loadRoutingOperationsPreview(routingId);
    } else {
      this.formOperations.set([]);
    }
  }

  onPlannedQtyChange(qty: number | null): void {
    const val = qty && qty > 0 ? qty : 1;
    this.formPlannedQty.set(val);

    // Auto update RequiredQuantity for materials = NormQuantity * PlannedQuantity
    const current = this.formMaterials();
    if (current.length > 0) {
      const updated = current.map(m => ({
        ...m,
        requiredQuantity: Math.round((m.normQuantity || 0) * val * 10000) / 10000,
      }));
      this.formMaterials.set(updated);
    }
  }

  loadBomMaterialsPreview(bomId: number, qty: number): void {
    this.api.previewBom(bomId, qty).subscribe({
      next: mats => this.formMaterials.set(mats),
      error: () => {},
    });
  }

  loadRoutingOperationsPreview(routingId: number): void {
    this.api.previewRouting(routingId).subscribe({
      next: ops => this.formOperations.set(ops),
      error: () => {},
    });
  }

  resetMaterialsToBom(): void {
    const bomId = this.formBomId();
    if (!bomId) {
      this._showError(this.i18n.t('common.error'), 'Vui lòng chọn BOM trước khi lấy lại danh sách');
      return;
    }

    this.api.previewBom(bomId, this.formPlannedQty()).subscribe({
      next: mats => {
        this.formMaterials.set(mats);
        this._showSuccess(this.i18n.t('productionOrder.ok.bomReset'));
      },
      error: err => this._showError(this.i18n.t('common.error'), err?.error?.message || err?.message),
    });
  }

  addMaterialRow(): void {
    const prods = this.productApi.items();
    const defaultProd = prods[0];
    const newRow: ProductionOrderMaterialDto = {
      productId: defaultProd?.id ?? 0,
      productCode: defaultProd?.productCode ?? '',
      productName: defaultProd?.productName ?? '',
      unitId: defaultProd?.defaultUnitId ?? null,
      normQuantity: 1,
      requiredQuantity: this.formPlannedQty(),
      issuedQuantity: 0,
      currentStock: 0,
      warehouseId: defaultProd?.defaultWarehouseId ?? null,
      isSubstituted: false,
      remark: 'Bổ sung ngoài định mức',
    };
    this.formMaterials.update(list => [...list, newRow]);
  }

  removeMaterialRow(index: number): void {
    this.formMaterials.update(list => list.filter((_, i) => i !== index));
  }

  onMaterialProductSelected(row: ProductionOrderMaterialDto, productId: number): void {
    const prod = this.productApi.items().find(p => p.id === productId);
    if (prod) {
      row.productId = prod.id;
      row.productCode = prod.productCode;
      row.productName = prod.ProductName ?? prod.productName;
      if (prod.defaultUnitId) row.unitId = prod.defaultUnitId;
      if (prod.defaultWarehouseId) row.warehouseId = prod.defaultWarehouseId;
    }
  }

  addOperationRow(): void {
    const nextSeq = this.formOperations().length + 1;
    const newOp: ProductionOrderOperationDto = {
      sequence: nextSeq,
      operationCode: `OP-${nextSeq.toString().padStart(2, '0')}`,
      operationName: `Công đoạn ${nextSeq}`,
      status: 1,
    };
    this.formOperations.update(list => [...list, newOp]);
  }

  removeOperationRow(index: number): void {
    this.formOperations.update(list => list.filter((_, i) => i !== index));
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  openCreate(): void {
    this.dialogMode.set('create');
    this.selectedOrder.set(null);
    this.activeDialogTab.set('general');

    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    this.formOrderNo.set('');
    this.formOrderType.set(4); // Lệnh khác / Trực tiếp
    this.formDescription.set('');
    this.formProductId.set(null);
    this.formUnitId.set(null);
    this.formBomId.set(null);
    this.formRoutingId.set(null);
    this.formLineId.set(null);
    this.formWorkCenterId.set(null);
    this.formCustomerId.set(null);
    this.formPlannedQty.set(100);
    this.formCompletedQty.set(0);
    this.formScrapQty.set(0);
    this.formPlannedStartDate.set(formatDate(now, 'yyyy-MM-ddTHH:mm', 'en'));
    this.formPlannedEndDate.set(formatDate(nextWeek, 'yyyy-MM-ddTHH:mm', 'en'));
    this.formActualStartDate.set('');
    this.formActualEndDate.set('');
    this.formPriority.set(2); // Normal
    this.formBatchNo.set(`LOT-${formatDate(now, 'yyyyMMdd', 'en')}`);
    this.formSalesOrderNo.set('');
    this.formRemark.set('');
    this.formMaterials.set([]);
    this.formOperations.set([]);

    if (this.productApi.items().length > 0) {
      this.onProductChange(this.productApi.items()[0].id);
    }

    this.showDialog.set(true);
  }

  openEdit(order: ProductionOrderDto): void {
    this.dialogMode.set('edit');
    this.selectedOrder.set(order);
    this.activeDialogTab.set('general');

    this.formOrderNo.set(order.orderNo);
    this.formOrderType.set(order.orderType || 4);
    this.formDescription.set(order.description || '');
    this.formProductId.set(order.productId);
    this.formUnitId.set(order.unitId ?? null);
    this.formBomId.set(order.bomId ?? null);
    this.formRoutingId.set(order.routingId ?? null);
    this.formLineId.set(order.lineId ?? null);
    this.formWorkCenterId.set(order.workCenterId ?? null);
    this.formCustomerId.set(order.customerId ?? null);
    this.formPlannedQty.set(order.plannedQuantity);
    this.formCompletedQty.set(order.completedQuantity);
    this.formScrapQty.set(order.scrapQuantity);
    this.formPlannedStartDate.set(order.plannedStartDate ? formatDate(order.plannedStartDate, 'yyyy-MM-ddTHH:mm', 'en') : '');
    this.formPlannedEndDate.set(order.plannedEndDate ? formatDate(order.plannedEndDate, 'yyyy-MM-ddTHH:mm', 'en') : '');
    this.formActualStartDate.set(order.actualStartDate ? formatDate(order.actualStartDate, 'yyyy-MM-ddTHH:mm', 'en') : '');
    this.formActualEndDate.set(order.actualEndDate ? formatDate(order.actualEndDate, 'yyyy-MM-ddTHH:mm', 'en') : '');
    this.formPriority.set(order.priority);
    this.formBatchNo.set(order.batchNo || '');
    this.formSalesOrderNo.set(order.salesOrderNo || '');
    this.formRemark.set(order.remark || '');

    // Fetch full order details with materials and operations
    this.api.getById(order.id).subscribe({
      next: detailed => {
        if (detailed) {
          this.formMaterials.set(detailed.materials ?? []);
          this.formOperations.set(detailed.operations ?? []);
        }
      },
      error: () => {
        this.formMaterials.set(order.materials ?? []);
        this.formOperations.set(order.operations ?? []);
      },
    });

    this.showDialog.set(true);
  }

  save(): void {
    if (!this.formProductId()) {
      this._showError(this.i18n.t('common.error'), this.i18n.t('productionOrder.err.productRequired'));
      return;
    }
    if (this.formPlannedQty() <= 0) {
      this._showError(this.i18n.t('common.error'), this.i18n.t('productionOrder.err.plannedQtyRequired'));
      return;
    }

    if (this.dialogMode() === 'create') {
      const payload: ProductionOrderCreateRequest = {
        orderNo: this.formOrderNo()?.trim() || null,
        orderType: this.formOrderType(),
        description: this.formDescription()?.trim() || null,
        productId: this.formProductId()!,
        unitId: this.formUnitId(),
        bomId: this.formBomId(),
        routingId: this.formRoutingId(),
        lineId: this.formLineId(),
        workCenterId: this.formWorkCenterId(),
        customerId: this.formCustomerId(),
        plannedQuantity: this.formPlannedQty(),
        plannedStartDate: this.formPlannedStartDate() || null,
        plannedEndDate: this.formPlannedEndDate() || null,
        priority: this.formPriority(),
        batchNo: this.formBatchNo()?.trim() || null,
        salesOrderNo: this.formSalesOrderNo()?.trim() || null,
        remark: this.formRemark()?.trim() || null,
        materials: this.formMaterials(),
        operations: this.formOperations(),
      };

      this.api.create(payload).subscribe({
        next: () => {
          this._showSuccess(this.i18n.t('productionOrder.ok.created'));
          this.showDialog.set(false);
          this.refresh();
        },
        error: err => this._showError(this.i18n.t('common.error'), err?.error?.message || err?.message),
      });
    } else {
      const id = this.selectedOrder()!.id;
      const payload: ProductionOrderUpdateRequest = {
        orderType: this.formOrderType(),
        description: this.formDescription()?.trim() || null,
        productId: this.formProductId()!,
        unitId: this.formUnitId(),
        bomId: this.formBomId(),
        routingId: this.formRoutingId(),
        lineId: this.formLineId(),
        workCenterId: this.formWorkCenterId(),
        customerId: this.formCustomerId(),
        plannedQuantity: this.formPlannedQty(),
        completedQuantity: this.formCompletedQty(),
        scrapQuantity: this.formScrapQty(),
        plannedStartDate: this.formPlannedStartDate() || null,
        plannedEndDate: this.formPlannedEndDate() || null,
        actualStartDate: this.formActualStartDate() || null,
        actualEndDate: this.formActualEndDate() || null,
        priority: this.formPriority(),
        batchNo: this.formBatchNo()?.trim() || null,
        salesOrderNo: this.formSalesOrderNo()?.trim() || null,
        remark: this.formRemark()?.trim() || null,
        materials: this.formMaterials(),
        operations: this.formOperations(),
      };

      this.api.update(id, payload).subscribe({
        next: () => {
          this._showSuccess(this.i18n.t('productionOrder.ok.updated'));
          this.showDialog.set(false);
          this.refresh();
        },
        error: err => this._showError(this.i18n.t('common.error'), err?.error?.message || err?.message),
      });
    }
  }

  duplicate(order: ProductionOrderDto): void {
    this.api.duplicate(order.id).subscribe({
      next: () => {
        this._showSuccess(this.i18n.t('productionOrder.ok.duplicated'));
        this.refresh();
      },
      error: err => this._showError(this.i18n.t('common.error'), err?.error?.message || err?.message),
    });
  }

  askDelete(order: ProductionOrderDto): void {
    this.confirm.confirm({
      header: this.i18n.t('productionOrder.confirm.deleteTitle'),
      message: this.i18n.t('productionOrder.confirm.deleteMessage', { orderNo: order.orderNo }),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.api.delete(order.id).subscribe({
          next: () => {
            this._showSuccess(this.i18n.t('productionOrder.ok.deleted'));
            this.refresh();
          },
          error: err => this._showError(this.i18n.t('common.error'), err?.error?.message || err?.message),
        });
      },
    });
  }

  // ─── Status Transitions ───────────────────────────────────────────────────
  release(order: ProductionOrderDto): void {
    this.api.release(order.id).subscribe({
      next: () => {
        this._showSuccess(this.i18n.t('productionOrder.ok.statusChanged'));
        this.refresh();
      },
      error: err => this._showError(this.i18n.t('common.error'), err?.error?.message || err?.message),
    });
  }

  start(order: ProductionOrderDto): void {
    this.api.start(order.id).subscribe({
      next: () => {
        this._showSuccess(this.i18n.t('productionOrder.ok.statusChanged'));
        this.refresh();
      },
      error: err => this._showError(this.i18n.t('common.error'), err?.error?.message || err?.message),
    });
  }

  pause(order: ProductionOrderDto): void {
    this.api.pause(order.id).subscribe({
      next: () => {
        this._showSuccess(this.i18n.t('productionOrder.ok.statusChanged'));
        this.refresh();
      },
      error: err => this._showError(this.i18n.t('common.error'), err?.error?.message || err?.message),
    });
  }

  complete(order: ProductionOrderDto): void {
    this.api.complete(order.id).subscribe({
      next: () => {
        this._showSuccess(this.i18n.t('productionOrder.ok.statusChanged'));
        this.refresh();
      },
      error: err => this._showError(this.i18n.t('common.error'), err?.error?.message || err?.message),
    });
  }

  cancel(order: ProductionOrderDto): void {
    this.confirm.confirm({
      header: this.i18n.t('productionOrder.dialog.cancel'),
      message: `Hủy lệnh sản xuất ${order.orderNo}? Thao tác này không thể hoàn tác.`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.api.cancel(order.id).subscribe({
          next: () => {
            this._showSuccess(this.i18n.t('productionOrder.ok.statusChanged'));
            this.refresh();
          },
          error: err => this._showError(this.i18n.t('common.error'), err?.error?.message || err?.message),
        });
      },
    });
  }

  // ─── Progress Recording ───────────────────────────────────────────────────
  openProgress(order: ProductionOrderDto): void {
    this.selectedOrder.set(order);
    this.progressCompletedDelta.set(10);
    this.progressScrapDelta.set(0);
    this.progressBatchNo.set(order.batchNo || '');
    this.progressRemark.set('');
    this.showProgressDialog.set(true);
  }

  saveProgress(): void {
    const order = this.selectedOrder();
    if (!order) return;

    const payload: ProductionOrderProgressRequest = {
      completedQuantityDelta: this.progressCompletedDelta(),
      scrapQuantityDelta: this.progressScrapDelta(),
      batchNo: this.progressBatchNo()?.trim() || null,
      remark: this.progressRemark()?.trim() || null,
    };

    this.api.recordProgress(order.id, payload).subscribe({
      next: () => {
        this._showSuccess(this.i18n.t('productionOrder.ok.progressRecorded'));
        this.showProgressDialog.set(false);
        this.refresh();
      },
      error: err => this._showError(this.i18n.t('common.error'), err?.error?.message || err?.message),
    });
  }

  private _showSuccess(detail: string): void {
    this.messages.add({ severity: 'success', summary: this.i18n.t('common.success'), detail });
  }

  private _showError(summary: string, detail: string): void {
    this.messages.add({ severity: 'error', summary, detail });
  }
}

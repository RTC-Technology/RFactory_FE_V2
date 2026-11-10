import { CommonModule, formatDate } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { PERMISSIONS } from '../../core/auth/permissions';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { DetailedProductionPlanApiService } from '../../core/services/detailed-production-plan-api.service';
import { LineApiService } from '../../core/services/master-data-api.service';
import { WorkshopApiService } from '../../core/services/organization-api.service';
import { ProductApiService, UnitApiService } from '../../core/services/product-api.service';
import {
  DetailedProductionPlanCreateRequest,
  DetailedProductionPlanDto,
  DetailedProductionPlanFilter,
  DetailedProductionPlanItemDto,
  DetailedProductionPlanScheduleDto,
  DetailedProductionPlanUpdateRequest,
  GenerateOrdersFromPlanRequest,
  MasterProductionPlanDto,
  PlanAllocationCalculationRequest,
  ValidateQuantitiesRequest,
  ValidateQuantitiesResultDto,
} from '../../domain/models/detailed-production-plan.model';
import { LineDto } from '../../domain/models/master-data.model';
import { ProductDto, UnitDto } from '../../domain/models/product.model';
import { WorkshopDto } from '../../domain/models/organization.model';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';

interface CalendarDayItem {
  date: string;
  dayLabel: string;
  dayOfWeekName: string;
  isSunday: boolean;
  isDayOff: boolean;
  isOvertime: boolean;
}

interface MatrixColumn {
  dateStr: string;
  headerLabel: string;
  subLabel: string;
  isDayOff: boolean;
  isSunday: boolean;
}

interface MatrixRow {
  productId: number;
  productCode: string;
  productName: string;
  unitName: string;
  requiredQuantity: number;
  dailyCapacity: number;
  currentStock: number;
  shiftName?: string;
  // Dynamic cell values keyed by date string 'YYYY-MM-DD'
  cells: { [dateStr: string]: { plannedQuantity: number; isDayOff: boolean; isOvertime: boolean; productionOrderNo?: string } };
}

@Component({
  selector: 'app-detailed-production-plan',
  standalone: true,
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
    ProgressBarModule,
    HasPermissionDirective,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './detailed-production-plan.component.html',
  styleUrl: './detailed-production-plan.component.scss',
})
export class DetailedProductionPlanComponent extends PermissionAwarePage implements OnInit {
  readonly api = inject(DetailedProductionPlanApiService);
  readonly workshopApi = inject(WorkshopApiService);
  readonly lineApi = inject(LineApiService);
  readonly productApi = inject(ProductApiService);
  readonly unitApi = inject(UnitApiService);

  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly PERMISSIONS = PERMISSIONS;
  readonly plans = this.api.items;
  readonly loading = this.api.loading;

  // Master Reference Data
  readonly masterPlans = signal<MasterProductionPlanDto[]>([]);
  readonly workshops = signal<WorkshopDto[]>([]);
  readonly lines = signal<LineDto[]>([]);
  readonly products = signal<ProductDto[]>([]);
  readonly units = signal<UnitDto[]>([]);

  // Filter state
  readonly filterKeyword = signal<string>('');
  readonly filterWorkshopId = signal<number | null>(null);
  readonly filterStatus = signal<number | null>(null);
  readonly filterFromDate = signal<string>('');
  readonly filterToDate = signal<string>('');

  // Status options
  readonly statusOptions = [
    { label: 'Tất cả trạng thái', value: null },
    { label: 'Dự thảo', value: 1 },
    { label: 'Đã duyệt', value: 2 },
    { label: 'Đang thực hiện', value: 3 },
    { label: 'Hoàn thành', value: 4 },
    { label: 'Đã hủy', value: 5 },
  ];

  // Wizard modal state
  readonly showWizard = signal<boolean>(false);
  readonly wizardMode = signal<'create' | 'edit'>('create');
  readonly currentStep = signal<number>(1);
  readonly editingPlanId = signal<number | null>(null);

  // Step 1: Parameters Form
  formSourceType = signal<'MASTER_PLAN' | 'DIRECT'>('MASTER_PLAN');
  formMasterPlanId = signal<number | null>(null);
  formWorkshopId = signal<number | null>(null);
  formLineId = signal<number | null>(null);
  formFromDate = signal<string>('');
  formToDate = signal<string>('');
  formPlanCode = signal<string>('');
  formPlanName = signal<string>('');
  formPeriodType = signal<'DAY' | 'SHIFT'>('DAY');
  formAllocationMethod = signal<'FORWARD' | 'BACKWARD'>('FORWARD');
  formRemark = signal<string>('');

  // Step 2: Demand Items Form
  formItems = signal<DetailedProductionPlanItemDto[]>([]);

  // Step 3: Matrix Columns and Rows
  matrixColumns = signal<MatrixColumn[]>([]);
  matrixRows = signal<MatrixRow[]>([]);
  workCalendarDays = signal<CalendarDayItem[]>([]);

  // Modals for Step 3
  readonly showAutoCalcModal = signal<boolean>(false);
  autoCalcMethod = signal<'FORWARD' | 'BACKWARD'>('FORWARD');
  readonly showCalendarModal = signal<boolean>(false);
  readonly showValidationModal = signal<boolean>(false);
  validationResult = signal<ValidateQuantitiesResultDto | null>(null);

  // View Detail Modal
  readonly showDetailModal = signal<boolean>(false);
  readonly selectedPlan = signal<DetailedProductionPlanDto | null>(null);
  readonly activeDetailTab = signal<string>('matrix');

  // Generate Orders Modal
  readonly showGenerateOrdersModal = signal<boolean>(false);
  generateOrdersPlan = signal<DetailedProductionPlanDto | null>(null);
  generateOrdersGroupBy = signal<'DAY' | 'ITEM'>('DAY');
  generateOrdersAutoApprove = signal<boolean>(true);
  generateOrdersRemark = signal<string>('');
  readonly generatingOrders = signal<boolean>(false);

  // Computed summary for current wizard
  readonly totalDemandRequired = computed(() =>
    this.formItems().reduce((acc, item) => acc + (item.requiredQuantity || 0), 0)
  );

  readonly totalDemandPlanned = computed(() => {
    let total = 0;
    const rows = this.matrixRows();
    for (const r of rows) {
      for (const date in r.cells) {
        total += r.cells[date].plannedQuantity || 0;
      }
    }
    return total;
  });

  constructor() {
    super(PERMISSIONS.detailedProductionPlan);
  }

  ngOnInit(): void {
    this.loadPlans();
    this.loadReferenceData();
  }

  loadPlans(): void {
    const filter: DetailedProductionPlanFilter = {};
    if (this.filterKeyword()) filter.keyword = this.filterKeyword().trim();
    if (this.filterWorkshopId()) filter.workshopId = this.filterWorkshopId()!;
    if (this.filterStatus()) filter.status = this.filterStatus()!;
    if (this.filterFromDate()) filter.fromDate = this.filterFromDate();
    if (this.filterToDate()) filter.toDate = this.filterToDate();

    this.api.load(filter).subscribe({
      error: err => {
        this.messages.add({ severity: 'error', summary: 'Lỗi', detail: err.message || 'Không thể tải danh sách kế hoạch chi tiết' });
      },
    });
  }

  loadReferenceData(): void {
    this.api.getMasterPlans().subscribe(mp => this.masterPlans.set(mp));
    this.workshopApi.load().subscribe(ws => this.workshops.set(ws));
    this.lineApi.load().subscribe(lines => this.lines.set(lines));
    this.productApi.load().subscribe(prods => this.products.set(prods));
    this.unitApi.load().subscribe(units => this.units.set(units));
  }

  resetFilters(): void {
    this.filterKeyword.set('');
    this.filterWorkshopId.set(null);
    this.filterStatus.set(null);
    this.filterFromDate.set('');
    this.filterToDate.set('');
    this.loadPlans();
  }

  // ─── Wizard Flow ────────────────────────────────────────────────────────────

  openCreateWizard(): void {
    this.wizardMode.set('create');
    this.editingPlanId.set(null);
    this.currentStep.set(1);

    // Default dates: Current Month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const fromStr = formatDate(firstDay, 'yyyy-MM-dd', 'en-US');
    const toStr = formatDate(lastDay, 'yyyy-MM-dd', 'en-US');

    this.formSourceType.set('MASTER_PLAN');
    this.formMasterPlanId.set(this.masterPlans().length > 0 ? this.masterPlans()[0].id : null);
    this.formWorkshopId.set(this.workshops().length > 0 ? this.workshops()[0].id : null);
    this.formLineId.set(null);
    this.formFromDate.set(fromStr);
    this.formToDate.set(toStr);
    this.formPlanCode.set('');
    this.formPlanName.set(`Kế hoạch chi tiết Tháng ${now.getMonth() + 1}/${now.getFullYear()}`);
    this.formPeriodType.set('DAY');
    this.formAllocationMethod.set('FORWARD');
    this.formRemark.set('');
    this.formItems.set([]);
    this.matrixColumns.set([]);
    this.matrixRows.set([]);

    if (this.formMasterPlanId()) {
      this.onMasterPlanSelected(this.formMasterPlanId()!);
    }

    this.showWizard.set(true);
  }

  openEditWizard(plan: DetailedProductionPlanDto): void {
    this.wizardMode.set('edit');
    this.editingPlanId.set(plan.id);
    this.currentStep.set(1);

    this.formSourceType.set(plan.masterPlanId ? 'MASTER_PLAN' : 'DIRECT');
    this.formMasterPlanId.set(plan.masterPlanId || null);
    this.formWorkshopId.set(plan.workshopId || null);
    this.formLineId.set(plan.lineId || null);
    this.formFromDate.set(plan.fromDate ? formatDate(plan.fromDate, 'yyyy-MM-dd', 'en-US') : '');
    this.formToDate.set(plan.toDate ? formatDate(plan.toDate, 'yyyy-MM-dd', 'en-US') : '');
    this.formPlanCode.set(plan.planCode);
    this.formPlanName.set(plan.planName);
    this.formPeriodType.set((plan.periodType === 'SHIFT' ? 'SHIFT' : 'DAY'));
    this.formAllocationMethod.set((plan.allocationMethod === 'BACKWARD' ? 'BACKWARD' : 'FORWARD'));
    this.formRemark.set(plan.remark || '');

    // Clone items
    const items = plan.items.map(i => ({ ...i }));
    this.formItems.set(items);

    // Build matrix columns & rows based on saved schedules
    this.buildMatrixFromSchedules(plan);

    this.showWizard.set(true);
  }

  onMasterPlanSelected(masterPlanId: number): void {
    const mp = this.masterPlans().find(m => m.id === masterPlanId);
    if (!mp) return;

    if (mp.workshopId) this.formWorkshopId.set(mp.workshopId);
    if (mp.fromDate) this.formFromDate.set(formatDate(mp.fromDate, 'yyyy-MM-dd', 'en-US'));
    if (mp.toDate) this.formToDate.set(formatDate(mp.toDate, 'yyyy-MM-dd', 'en-US'));

    // Populate items from master plan items
    if (mp.items && mp.items.length > 0) {
      const items: DetailedProductionPlanItemDto[] = mp.items.map((mItem, idx) => ({
        id: 0,
        planId: 0,
        productId: mItem.productId,
        productCode: mItem.productCode,
        productName: mItem.productName,
        unitId: mItem.unitId,
        unitName: mItem.unitName,
        requiredQuantity: mItem.remainingQuantity > 0 ? mItem.remainingQuantity : mItem.plannedQuantity,
        currentStock: 0,
        plannedQuantity: 0,
        dailyCapacity: mItem.dailyCapacity || 100,
        sequence: idx + 1,
        remainingToPlan: mItem.remainingQuantity > 0 ? mItem.remainingQuantity : mItem.plannedQuantity,
      }));
      this.formItems.set(items);
    }
  }

  goToStep(step: number): void {
    if (step === 2) {
      if (!this.formFromDate() || !this.formToDate()) {
        this.messages.add({ severity: 'warn', summary: 'Cảnh báo', detail: 'Vui lòng chọn Từ ngày và Đến ngày' });
        return;
      }
      if (new Date(this.formFromDate()) > new Date(this.formToDate())) {
        this.messages.add({ severity: 'warn', summary: 'Cảnh báo', detail: 'Từ ngày không thể lớn hơn Đến ngày' });
        return;
      }
      // If direct mode and items empty, add an empty row
      if (this.formItems().length === 0) {
        this.addEmptyItemRow();
      }
    } else if (step === 3) {
      if (this.formItems().length === 0) {
        this.messages.add({ severity: 'warn', summary: 'Cảnh báo', detail: 'Vui lòng nhập ít nhất một sản phẩm cần sản xuất' });
        return;
      }
      // Initialize Matrix & Calendar for Step 3
      this.initMatrixAndCalendar();
    }
    this.currentStep.set(step);
  }

  // ─── Step 2: Demand Table Methods ──────────────────────────────────────────

  addEmptyItemRow(): void {
    const nextSeq = this.formItems().length + 1;
    const defaultProduct = this.products().length > 0 ? this.products()[0] : null;
    const newItem: DetailedProductionPlanItemDto = {
      id: 0,
      planId: 0,
      productId: defaultProduct ? defaultProduct.id : 0,
      productCode: defaultProduct ? defaultProduct.productCode : '',
      productName: defaultProduct ? defaultProduct.productName : '',
      unitId: defaultProduct?.defaultUnitId ? defaultProduct.defaultUnitId : undefined,
      unitName: '',
      requiredQuantity: 100,
      currentStock: 0,
      plannedQuantity: 0,
      dailyCapacity: 100,
      sequence: nextSeq,
      remainingToPlan: 100,
    };
    this.formItems.update(list => [...list, newItem]);
  }

  removeItemRow(index: number): void {
    this.formItems.update(list => list.filter((_, idx) => idx !== index));
  }

  onProductChanged(item: DetailedProductionPlanItemDto, productId: number): void {
    const prod = this.products().find(p => p.id === productId);
    if (prod) {
      item.productId = prod.id;
      item.productCode = prod.productCode;
      item.productName = prod.productName;
      if (prod.defaultUnitId) {
        item.unitId = prod.defaultUnitId;
        const u = this.units().find(unit => unit.id === prod.defaultUnitId);
        item.unitName = u ? u.unitName : '';
      }
    }
  }

  // ─── Step 3: Matrix and Calculation Methods ─────────────────────────────────

  initMatrixAndCalendar(): void {
    const from = new Date(this.formFromDate());
    const to = new Date(this.formToDate());

    // 1. Build calendar days
    const days: CalendarDayItem[] = [];
    const cols: MatrixColumn[] = [];

    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d, 'yyyy-MM-dd', 'en-US');
      const isSunday = d.getDay() === 0;
      const isDayOff = isSunday; // default Sunday is day off

      days.push({
        date: dateStr,
        dayLabel: formatDate(d, 'dd/MM', 'en-US'),
        dayOfWeekName: dayNames[d.getDay()],
        isSunday,
        isDayOff,
        isOvertime: false,
      });

      cols.push({
        dateStr,
        headerLabel: formatDate(d, 'dd/MM', 'en-US'),
        subLabel: dayNames[d.getDay()],
        isDayOff,
        isSunday,
      });
    }

    this.workCalendarDays.set(days);
    this.matrixColumns.set(cols);

    // 2. Build rows if not already populated
    if (this.matrixRows().length === 0 || this.wizardMode() === 'create') {
      const rows: MatrixRow[] = [];
      const periodType = this.formPeriodType();
      const shifts = periodType === 'SHIFT' ? ['Ca 1', 'Ca 2', 'Ca 3'] : [undefined];

      for (const item of this.formItems()) {
        for (const shiftName of shifts) {
          const cells: { [date: string]: { plannedQuantity: number; isDayOff: boolean; isOvertime: boolean; productionOrderNo?: string } } = {};
          for (const c of cols) {
            cells[c.dateStr] = {
              plannedQuantity: 0,
              isDayOff: c.isDayOff,
              isOvertime: false,
            };
          }

          rows.push({
            productId: item.productId,
            productCode: item.productCode,
            productName: item.productName,
            unitName: item.unitName || '',
            requiredQuantity: item.requiredQuantity,
            dailyCapacity: item.dailyCapacity,
            currentStock: item.currentStock,
            shiftName,
            cells,
          });
        }
      }
      this.matrixRows.set(rows);
    }
  }

  buildMatrixFromSchedules(plan: DetailedProductionPlanDto): void {
    const from = new Date(plan.fromDate);
    const to = new Date(plan.toDate);
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    const cols: MatrixColumn[] = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d, 'yyyy-MM-dd', 'en-US');
      const isSunday = d.getDay() === 0;
      cols.push({
        dateStr,
        headerLabel: formatDate(d, 'dd/MM', 'en-US'),
        subLabel: dayNames[d.getDay()],
        isDayOff: isSunday,
        isSunday,
      });
    }
    this.matrixColumns.set(cols);

    const isShift = plan.periodType === 'SHIFT';
    const shifts = isShift ? ['Ca 1', 'Ca 2', 'Ca 3'] : [undefined];
    const rows: MatrixRow[] = [];

    for (const item of plan.items) {
      for (const shiftName of shifts) {
        const cells: { [date: string]: { plannedQuantity: number; isDayOff: boolean; isOvertime: boolean; productionOrderNo?: string } } = {};
        for (const c of cols) {
          const sch = plan.schedules?.find(s =>
            s.productId === item.productId &&
            formatDate(s.scheduleDate, 'yyyy-MM-dd', 'en-US') === c.dateStr &&
            (shiftName ? s.shiftName === shiftName : true)
          );

          cells[c.dateStr] = {
            plannedQuantity: sch ? sch.plannedQuantity : 0,
            isDayOff: sch ? sch.isDayOff : c.isDayOff,
            isOvertime: sch ? sch.isOvertime : false,
            productionOrderNo: sch?.productionOrderNo,
          };
        }

        rows.push({
          productId: item.productId,
          productCode: item.productCode,
          productName: item.productName,
          unitName: item.unitName || '',
          requiredQuantity: item.requiredQuantity,
          dailyCapacity: item.dailyCapacity,
          currentStock: item.currentStock,
          shiftName,
          cells,
        });
      }
    }
    this.matrixRows.set(rows);
  }

  getRowTotalPlanned(row: MatrixRow): number {
    let sum = 0;
    for (const d in row.cells) {
      sum += row.cells[d].plannedQuantity || 0;
    }
    return sum;
  }

  getRowDifference(row: MatrixRow): number {
    return this.getRowTotalPlanned(row) - row.requiredQuantity;
  }

  onCellQuantityChange(row: MatrixRow, dateStr: string, value: number | null): void {
    const val = value != null ? Number(value) : 0;
    if (row.cells[dateStr]) {
      row.cells[dateStr].plannedQuantity = val;
    }
  }

  // ─── AMIS Auto-Allocation Calculation ────────────────────────────────────────

  openAutoCalc(): void {
    this.autoCalcMethod.set(this.formAllocationMethod());
    this.showAutoCalcModal.set(true);
  }

  runAutoAllocation(): void {
    const req: PlanAllocationCalculationRequest = {
      method: this.autoCalcMethod(),
      periodType: this.formPeriodType(),
      fromDate: this.formFromDate(),
      toDate: this.formToDate(),
      items: this.formItems().map(i => ({
        productId: i.productId,
        productCode: i.productCode,
        productName: i.productName,
        requiredQuantity: i.requiredQuantity,
        dailyCapacity: i.dailyCapacity,
      })),
      shifts: this.formPeriodType() === 'SHIFT' ? ['Ca 1', 'Ca 2', 'Ca 3'] : undefined,
      dayOffOverrides: this.workCalendarDays().map(d => ({
        date: d.date,
        isDayOff: d.isDayOff,
        isOvertime: d.isOvertime,
      })),
    };

    this.api.calculateAllocation(req).subscribe({
      next: res => {
        // Map returned schedules into matrix rows
        const currentRows = this.matrixRows();
        for (const row of currentRows) {
          for (const dateStr in row.cells) {
            const sch = res.schedules.find(s =>
              s.productId === row.productId &&
              formatDate(s.scheduleDate, 'yyyy-MM-dd', 'en-US') === dateStr &&
              (row.shiftName ? s.shiftName === row.shiftName : true)
            );
            if (sch) {
              row.cells[dateStr].plannedQuantity = sch.plannedQuantity;
              row.cells[dateStr].isDayOff = sch.isDayOff;
              row.cells[dateStr].isOvertime = sch.isOvertime;
            }
          }
        }
        this.matrixRows.set([...currentRows]);
        this.showAutoCalcModal.set(false);
        this.messages.add({
          severity: res.isFullyAllocated ? 'success' : 'warn',
          summary: 'Tính toán kế hoạch',
          detail: res.message,
        });
      },
      error: err => {
        this.messages.add({ severity: 'error', summary: 'Lỗi', detail: err.message || 'Không thể tính toán kế hoạch' });
      },
    });
  }

  // ─── Work Calendar Setup ───────────────────────────────────────────────────

  openWorkCalendar(): void {
    this.showCalendarModal.set(true);
  }

  saveWorkCalendar(): void {
    // Sync calendar changes with matrix column styles and cell isDayOff
    const daysMap = new Map(this.workCalendarDays().map(d => [d.date, d]));
    this.matrixColumns.update(cols =>
      cols.map(c => {
        const d = daysMap.get(c.dateStr);
        return {
          ...c,
          isDayOff: d ? d.isDayOff : c.isDayOff,
        };
      })
    );

    const rows = this.matrixRows();
    for (const row of rows) {
      for (const date in row.cells) {
        const d = daysMap.get(date);
        if (d) {
          row.cells[date].isDayOff = d.isDayOff;
          row.cells[date].isOvertime = d.isOvertime;
          if (d.isDayOff && !d.isOvertime) {
            row.cells[date].plannedQuantity = 0;
          }
        }
      }
    }
    this.matrixRows.set([...rows]);
    this.showCalendarModal.set(false);
    this.messages.add({ severity: 'info', summary: 'Lịch làm việc', detail: 'Đã cập nhật cấu hình ngày nghỉ & tăng ca' });
  }

  // ─── Check / Validate Quantities ("Kiểm tra SL sản xuất") ──────────────────

  validateQuantities(): void {
    const schedules: DetailedProductionPlanScheduleDto[] = [];
    for (const row of this.matrixRows()) {
      for (const date in row.cells) {
        schedules.push({
          productId: row.productId,
          scheduleDate: date,
          shiftName: row.shiftName,
          capacity: row.dailyCapacity,
          plannedQuantity: row.cells[date].plannedQuantity || 0,
          isDayOff: row.cells[date].isDayOff,
          isOvertime: row.cells[date].isOvertime,
        });
      }
    }

    const req: ValidateQuantitiesRequest = {
      items: this.formItems().map(i => ({
        productId: i.productId,
        productCode: i.productCode,
        productName: i.productName,
        requiredQuantity: i.requiredQuantity,
        dailyCapacity: i.dailyCapacity,
      })),
      schedules,
    };

    this.api.validateQuantities(req).subscribe({
      next: res => {
        this.validationResult.set(res);
        this.showValidationModal.set(true);
      },
      error: err => {
        this.messages.add({ severity: 'error', summary: 'Lỗi', detail: err.message || 'Không thể kiểm tra số lượng' });
      },
    });
  }

  // ─── Save Plan (Create / Update) ───────────────────────────────────────────

  savePlan(): void {
    if (!this.formPlanName().trim()) {
      this.messages.add({ severity: 'warn', summary: 'Cảnh báo', detail: 'Vui lòng nhập Tên kế hoạch' });
      return;
    }

    const schedules: DetailedProductionPlanScheduleDto[] = [];
    for (const row of this.matrixRows()) {
      for (const date in row.cells) {
        schedules.push({
          productId: row.productId,
          scheduleDate: date,
          shiftName: row.shiftName,
          capacity: row.dailyCapacity,
          plannedQuantity: row.cells[date].plannedQuantity || 0,
          isDayOff: row.cells[date].isDayOff,
          isOvertime: row.cells[date].isOvertime,
        });
      }
    }

    const workshop = this.workshops().find(w => w.id === this.formWorkshopId());
    const line = this.lines().find(l => l.id === this.formLineId());
    const masterPlan = this.masterPlans().find(m => m.id === this.formMasterPlanId());

    if (this.wizardMode() === 'create') {
      const payload: DetailedProductionPlanCreateRequest = {
        planCode: this.formPlanCode().trim(),
        planName: this.formPlanName().trim(),
        masterPlanId: this.formMasterPlanId() || undefined,
        masterPlanCode: masterPlan ? masterPlan.planCode : undefined,
        workshopId: this.formWorkshopId() || undefined,
        workshopName: workshop ? workshop.workshopName : undefined,
        lineId: this.formLineId() || undefined,
        lineName: line ? line.lineName : undefined,
        periodType: this.formPeriodType(),
        fromDate: this.formFromDate(),
        toDate: this.formToDate(),
        allocationMethod: this.formAllocationMethod(),
        remark: this.formRemark(),
        items: this.formItems().map(i => ({
          productId: i.productId,
          productCode: i.productCode,
          productName: i.productName,
          unitId: i.unitId,
          unitName: i.unitName,
          requiredQuantity: i.requiredQuantity,
          currentStock: i.currentStock,
          plannedQuantity: i.plannedQuantity,
          dailyCapacity: i.dailyCapacity,
          salesOrderNo: i.salesOrderNo,
          sequence: i.sequence,
          remark: i.remark,
        })),
        schedules: schedules.map(s => ({
          productId: s.productId,
          scheduleDate: s.scheduleDate,
          shiftName: s.shiftName,
          capacity: s.capacity,
          plannedQuantity: s.plannedQuantity,
          isDayOff: s.isDayOff,
          isOvertime: s.isOvertime,
        })),
      };

      this.api.create(payload).subscribe({
        next: created => {
          this.messages.add({ severity: 'success', summary: 'Thành công', detail: `Đã tạo kế hoạch chi tiết ${created.planCode}` });
          this.showWizard.set(false);
          this.loadPlans();
        },
        error: err => {
          this.messages.add({ severity: 'error', summary: 'Lỗi', detail: err.message || 'Không thể tạo kế hoạch chi tiết' });
        },
      });
    } else {
      const planId = this.editingPlanId();
      if (!planId) return;

      const payload: DetailedProductionPlanUpdateRequest = {
        planName: this.formPlanName().trim(),
        masterPlanId: this.formMasterPlanId() || undefined,
        masterPlanCode: masterPlan ? masterPlan.planCode : undefined,
        workshopId: this.formWorkshopId() || undefined,
        workshopName: workshop ? workshop.workshopName : undefined,
        lineId: this.formLineId() || undefined,
        lineName: line ? line.lineName : undefined,
        periodType: this.formPeriodType(),
        fromDate: this.formFromDate(),
        toDate: this.formToDate(),
        allocationMethod: this.formAllocationMethod(),
        remark: this.formRemark(),
        items: this.formItems().map(i => ({
          productId: i.productId,
          productCode: i.productCode,
          productName: i.productName,
          unitId: i.unitId,
          unitName: i.unitName,
          requiredQuantity: i.requiredQuantity,
          currentStock: i.currentStock,
          plannedQuantity: i.plannedQuantity,
          dailyCapacity: i.dailyCapacity,
          salesOrderNo: i.salesOrderNo,
          sequence: i.sequence,
          remark: i.remark,
        })),
        schedules: schedules.map(s => ({
          productId: s.productId,
          scheduleDate: s.scheduleDate,
          shiftName: s.shiftName,
          capacity: s.capacity,
          plannedQuantity: s.plannedQuantity,
          isDayOff: s.isDayOff,
          isOvertime: s.isOvertime,
        })),
      };

      this.api.update(planId, payload).subscribe({
        next: updated => {
          this.messages.add({ severity: 'success', summary: 'Thành công', detail: `Đã cập nhật kế hoạch ${updated.planCode}` });
          this.showWizard.set(false);
          this.loadPlans();
        },
        error: err => {
          this.messages.add({ severity: 'error', summary: 'Lỗi', detail: err.message || 'Không thể cập nhật kế hoạch' });
        },
      });
    }
  }

  // ─── Actions: View Detail, Delete, Status, Export, Generate Orders ─────────

  viewDetail(plan: DetailedProductionPlanDto): void {
    this.api.getById(plan.id).subscribe({
      next: p => {
        this.selectedPlan.set(p);
        this.activeDetailTab.set('matrix');
        this.buildMatrixFromSchedules(p);
        this.showDetailModal.set(true);
      },
      error: err => {
        this.messages.add({ severity: 'error', summary: 'Lỗi', detail: err.message || 'Không thể tải chi tiết kế hoạch' });
      },
    });
  }

  askDelete(plan: DetailedProductionPlanDto): void {
    this.confirm.confirm({
      message: `Bạn có chắc muốn xóa kế hoạch chi tiết "${plan.planCode}"?`,
      header: 'Xác nhận xóa',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Xóa',
      rejectLabel: 'Hủy',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.delete(plan.id).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Đã xóa', detail: `Kế hoạch ${plan.planCode} đã được xóa` });
            this.loadPlans();
          },
          error: err => {
            this.messages.add({ severity: 'error', summary: 'Lỗi', detail: err.message || 'Không thể xóa kế hoạch' });
          },
        });
      },
    });
  }

  changePlanStatus(plan: DetailedProductionPlanDto, newStatus: number, statusLabel: string): void {
    this.confirm.confirm({
      message: `Chuyển trạng thái kế hoạch "${plan.planCode}" sang "${statusLabel}"?`,
      header: 'Đổi trạng thái',
      icon: 'pi pi-info-circle',
      acceptLabel: 'Đồng ý',
      rejectLabel: 'Hủy',
      accept: () => {
        this.api.changeStatus(plan.id, newStatus).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: 'Thành công', detail: `Đã đổi trạng thái thành ${statusLabel}` });
            this.loadPlans();
          },
          error: err => {
            this.messages.add({ severity: 'error', summary: 'Lỗi', detail: err.message || 'Không thể đổi trạng thái' });
          },
        });
      },
    });
  }

  // ─── AMIS Step 4: Generate Orders ─────────────────────────────────────────

  openGenerateOrdersModal(plan: DetailedProductionPlanDto): void {
    this.generateOrdersPlan.set(plan);
    this.generateOrdersGroupBy.set('DAY');
    this.generateOrdersAutoApprove.set(true);
    this.generateOrdersRemark.set(`Lập từ Kế hoạch chi tiết ${plan.planCode}`);
    this.showGenerateOrdersModal.set(true);
  }

  executeGenerateOrders(): void {
    const plan = this.generateOrdersPlan();
    if (!plan) return;

    this.generatingOrders.set(true);
    const req: GenerateOrdersFromPlanRequest = {
      planId: plan.id,
      groupBy: this.generateOrdersGroupBy(),
      autoApprove: this.generateOrdersAutoApprove(),
      remark: this.generateOrdersRemark(),
    };

    this.api.generateProductionOrders(req).subscribe({
      next: res => {
        this.generatingOrders.set(false);
        this.showGenerateOrdersModal.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Lập lệnh sản xuất thành công',
          detail: res.message,
          life: 6000,
        });
        this.loadPlans();
      },
      error: err => {
        this.generatingOrders.set(false);
        this.messages.add({ severity: 'error', summary: 'Lỗi', detail: err.message || 'Không thể lập lệnh sản xuất' });
      },
    });
  }

  // ─── Export Excel / CSV ────────────────────────────────────────────────────

  exportPlanToCsv(plan: DetailedProductionPlanDto): void {
    this.api.getById(plan.id).subscribe(fullPlan => {
      if (!fullPlan) return;

      const dates = Array.from(new Set(fullPlan.schedules.map(s => formatDate(s.scheduleDate, 'yyyy-MM-dd', 'en-US')))).sort();

      const headers = ['Mã sản phẩm', 'Tên sản phẩm', 'ĐVT', 'Nhu cầu', 'Tổng đã lập', 'Chênh lệch', ...dates];
      const rows: string[][] = [];

      for (const item of fullPlan.items) {
        const itemSchedules = fullPlan.schedules.filter(s => s.productId === item.productId);
        const totalPlanned = itemSchedules.reduce((acc, s) => acc + s.plannedQuantity, 0);
        const diff = totalPlanned - item.requiredQuantity;

        const row = [
          `"${item.productCode}"`,
          `"${item.productName.replace(/"/g, '""')}"`,
          `"${item.unitName || ''}"`,
          `${item.requiredQuantity}`,
          `${totalPlanned}`,
          `${diff}`,
        ];

        for (const date of dates) {
          const dayQty = itemSchedules
            .filter(s => formatDate(s.scheduleDate, 'yyyy-MM-dd', 'en-US') === date)
            .reduce((acc, s) => acc + s.plannedQuantity, 0);
          row.push(`${dayQty}`);
        }
        rows.push(row);
      }

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `KeHoachChiTiet_${fullPlan.planCode}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.messages.add({ severity: 'info', summary: 'Xuất CSV', detail: `Đã xuất kế hoạch ${fullPlan.planCode} ra file CSV` });
    });
  }

  // Helpers
  getStatusTagSeverity(status: number): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 1: return 'secondary'; // Draft
      case 2: return 'info';      // Approved
      case 3: return 'warn';      // InProgress
      case 4: return 'success';   // Completed
      case 5: return 'danger';    // Cancelled
      default: return 'secondary';
    }
  }

  getProgressPercent(plan: DetailedProductionPlanDto): number {
    if (!plan.totalRequiredQuantity || plan.totalRequiredQuantity <= 0) return 0;
    const pct = Math.round((plan.totalPlannedQuantity / plan.totalRequiredQuantity) * 100);
    return Math.min(100, Math.max(0, pct));
  }

  onDetailTabChange(tab: any): void {
    this.activeDetailTab.set(tab != null ? String(tab) : 'matrix');
  }
}

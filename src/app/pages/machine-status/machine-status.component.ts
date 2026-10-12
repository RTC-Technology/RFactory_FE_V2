import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { PermissionAwarePage } from '../../core/auth/permission-aware-page';
import { PERMISSIONS } from '../../core/auth/permissions';
import { I18nService } from '../../core/services/i18n.service';
import { LineApiService } from '../../core/services/master-data-api.service';
import { MachineStatusApiService } from '../../core/services/machine-status-api.service';
import { ProductApiService } from '../../core/services/product-api.service';
import {
  ChangeMachineStatusRequest,
  LogMachineDefectRequest,
  MACHINE_STATUS_CONFIG,
  MachineDefectLogDto,
  MachineRealtimeStatusDto,
  MachineReasonCodeDto,
  MachineReasonCodeRequest,
  MachineStatusDashboardSummaryDto,
  MachineStatusHistoryDto,
  REASON_CATEGORIES,
  REASON_TYPES,
} from '../../domain/models/machine-status.model';

@Component({
  selector: 'app-machine-status',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CardModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
    TagModule,
    SelectModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    CheckboxModule,
    TooltipModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './machine-status.component.html',
  styleUrl: './machine-status.component.scss',
})
export class MachineStatusComponent extends PermissionAwarePage implements OnInit, OnDestroy {
  private readonly statusApi = inject(MachineStatusApiService);
  private readonly lineApi = inject(LineApiService);
  private readonly productApi = inject(ProductApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly i18n = inject(I18nService);

  readonly statusConfig = MACHINE_STATUS_CONFIG;
  readonly reasonTypes = REASON_TYPES;
  readonly reasonCategories = REASON_CATEGORIES;

  // Active Tab
  readonly activeTab = signal<'board' | 'history' | 'defects' | 'reasons'>('board');

  // Real-time Status Data
  readonly machines = this.statusApi.realtimeStatuses;
  readonly summary = this.statusApi.summary;
  readonly loading = this.statusApi.loading;

  // Auto-refresh interval (15s)
  readonly autoRefresh = signal<boolean>(false);
  private autoRefreshTimer: any = null;

  // Board Filter States
  readonly boardSearchQuery = signal<string>('');
  readonly selectedLineFilter = signal<number | null>(null);
  readonly selectedStatusFilter = signal<string | null>(null);

  readonly lines = this.lineApi.items;
  readonly products = this.productApi.items;

  // Dropdown options
  readonly lineFilterOptions = computed(() => [
    { label: 'All Lines', value: null },
    ...this.lines().map(l => ({ label: l.lineName, value: l.id })),
  ]);

  readonly statusFilterOptions = [
    { label: 'All Statuses', value: null },
    { label: 'Running', value: 'RUNNING' },
    { label: 'Idle / Standby', value: 'IDLE' },
    { label: 'Downtime', value: 'DOWNTIME' },
    { label: 'Changeover', value: 'CHANGEOVER' },
    { label: 'PM Maintenance', value: 'MAINTENANCE' },
    { label: 'Offline', value: 'OFFLINE' },
  ];

  readonly machineOptions = computed(() => [
    { label: 'All Machines', value: null },
    ...this.machines().map(m => ({ label: `${m.machineCode} - ${m.machineName}`, value: m.machineId })),
  ]);

  // Operational status buttons configuration
  readonly operationalStatuses = [
    { key: 'RUNNING', config: MACHINE_STATUS_CONFIG.RUNNING },
    { key: 'IDLE', config: MACHINE_STATUS_CONFIG.IDLE },
    { key: 'DOWNTIME', config: MACHINE_STATUS_CONFIG.DOWNTIME },
    { key: 'CHANGEOVER', config: MACHINE_STATUS_CONFIG.CHANGEOVER },
    { key: 'MAINTENANCE', config: MACHINE_STATUS_CONFIG.MAINTENANCE },
    { key: 'OFFLINE', config: MACHINE_STATUS_CONFIG.OFFLINE },
  ];

  // Filtered Machines for Board
  readonly filteredMachines = computed(() => {
    let list = this.machines();
    const query = this.boardSearchQuery().trim().toLowerCase();
    const lineId = this.selectedLineFilter();
    const status = this.selectedStatusFilter();

    if (lineId) {
      list = list.filter(m => m.lineId === lineId);
    }
    if (status) {
      list = list.filter(m => m.status === status);
    }
    if (query) {
      list = list.filter(
        m =>
          m.machineCode.toLowerCase().includes(query) ||
          m.machineName.toLowerCase().includes(query) ||
          (m.currentReasonName && m.currentReasonName.toLowerCase().includes(query)) ||
          (m.operatorName && m.operatorName.toLowerCase().includes(query))
      );
    }
    return list;
  });

  // History Tab State
  readonly historyRecords = signal<MachineStatusHistoryDto[]>([]);
  readonly historyLoading = signal<boolean>(false);
  readonly historyMachineFilter = signal<number | null>(null);

  // Defect Logs Tab State
  readonly defectRecords = signal<MachineDefectLogDto[]>([]);
  readonly defectLoading = signal<boolean>(false);
  readonly defectTypeFilter = signal<string | null>(null);
  readonly defectMachineFilter = signal<number | null>(null);
  readonly defectTypeOptions = [
    { label: 'All Defect Types', value: null },
    { label: 'SCRAP (Discard)', value: 'SCRAP' },
    { label: 'REWORK (Repairable)', value: 'REWORK' },
  ];

  // Reasons Catalog Tab State
  readonly reasonsList = signal<MachineReasonCodeDto[]>([]);
  readonly reasonsLoading = signal<boolean>(false);
  readonly reasonsFilterType = signal<string | null>(null);
  readonly reasonFilterTypeOptions = [
    { label: 'All Categories & Types', value: null },
    { label: 'Downtime Reasons', value: 'DOWNTIME' },
    { label: 'Scrap Defect Reasons', value: 'SCRAP' },
    { label: 'Rework Defect Reasons', value: 'REWORK' },
  ];

  // ── Modal: Change Machine Status ──────────────────────────
  readonly changeStatusDialogOpen = signal<boolean>(false);
  readonly targetMachineForStatus = signal<MachineRealtimeStatusDto | null>(null);
  readonly formNewStatus = signal<string>('RUNNING');
  readonly formStatusReasonId = signal<number | null>(null);
  readonly formStatusOperator = signal<string>('');
  readonly formStatusWorkOrder = signal<string>('');
  readonly formStatusRemarks = signal<string>('');
  readonly statusSaving = signal<boolean>(false);

  // Cached Downtime Reasons list for status change
  readonly allReasonsCache = signal<MachineReasonCodeDto[]>([]);

  readonly downtimeReasonsList = computed(() => {
    return this.allReasonsCache()
      .filter(r => r.reasonType === 'DOWNTIME' && r.isActive)
      .map(r => ({
        id: r.id,
        reasonCode: r.reasonCode,
        reasonName: r.reasonName,
        category: r.category,
        label: `[${r.category}] ${r.reasonCode} - ${r.reasonName}`,
      }));
  });

  // ── Modal: Log Defect (Scrap / Rework) ────────────────────
  readonly logDefectDialogOpen = signal<boolean>(false);
  readonly targetMachineForDefect = signal<MachineRealtimeStatusDto | null>(null);
  readonly formDefectMachineId = signal<number | null>(null);
  readonly formDefectType = signal<'SCRAP' | 'REWORK'>('SCRAP');
  readonly formDefectReasonId = signal<number | null>(null);
  readonly formDefectQty = signal<number>(1);
  readonly formDefectProductId = signal<number | null>(null);
  readonly formDefectWorkOrder = signal<string>('');
  readonly formDefectOperator = signal<string>('');
  readonly formDefectRemarks = signal<string>('');
  readonly defectSaving = signal<boolean>(false);

  readonly filteredDefectReasonsList = computed(() => {
    const type = this.formDefectType();
    return this.allReasonsCache()
      .filter(r => r.reasonType === type && r.isActive)
      .map(r => ({
        id: r.id,
        reasonCode: r.reasonCode,
        reasonName: r.reasonName,
        category: r.category,
        label: `[${r.category}] ${r.reasonCode} - ${r.reasonName}`,
      }));
  });

  // ── Modal: Add / Edit Reason Code ────────────────────────
  readonly reasonDialogOpen = signal<boolean>(false);
  readonly editingReasonId = signal<number | null>(null);
  readonly formReasonCode = signal<string>('');
  readonly formReasonName = signal<string>('');
  readonly formReasonType = signal<string>('DOWNTIME');
  readonly formReasonCategory = signal<string>('Mechanical');
  readonly formReasonIsPlanned = signal<boolean>(false);
  readonly formReasonDescription = signal<string>('');
  readonly reasonSaving = signal<boolean>(false);

  constructor() {
    super(PERMISSIONS.machineStatus);
  }

  ngOnInit(): void {
    this.refreshAll();
    this.lineApi.load().subscribe();
    this.productApi.load().subscribe();
    this.loadAllReasonsCache();
  }

  ngOnDestroy(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
    }
  }

  refreshAll(): void {
    this.statusApi.loadRealtime().subscribe();
    this.statusApi.loadSummary().subscribe();
  }

  toggleAutoRefresh(): void {
    const next = !this.autoRefresh();
    this.autoRefresh.set(next);
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
    if (next) {
      this.autoRefreshTimer = setInterval(() => {
        this.refreshAll();
      }, 15000);
      this.messages.add({
        severity: 'info',
        summary: 'Auto-Refresh Active',
        detail: 'Dashboard updating every 15 seconds.',
      });
    }
  }

  loadAllReasonsCache(): void {
    this.statusApi.loadReasons().subscribe({
      next: list => this.allReasonsCache.set(list),
    });
  }

  // ── Tab 2: History ────────────────────────────────────────
  loadHistory(): void {
    this.historyLoading.set(true);
    this.statusApi.getHistory(this.historyMachineFilter()).subscribe({
      next: data => {
        this.historyRecords.set(data);
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }

  // ── Tab 3: Defects ────────────────────────────────────────
  loadDefectLogs(): void {
    this.defectLoading.set(true);
    this.statusApi.getDefectLogs(this.defectMachineFilter(), this.defectTypeFilter()).subscribe({
      next: data => {
        this.defectRecords.set(data);
        this.defectLoading.set(false);
      },
      error: () => this.defectLoading.set(false),
    });
  }

  // ── Tab 4: Reasons ────────────────────────────────────────
  loadReasons(): void {
    this.reasonsLoading.set(true);
    this.statusApi.loadReasons(this.reasonsFilterType()).subscribe({
      next: list => {
        this.reasonsList.set(list);
        this.reasonsLoading.set(false);
      },
      error: () => this.reasonsLoading.set(false),
    });
  }

  // ── Change Status Handlers ────────────────────────────────
  openChangeStatus(machine: MachineRealtimeStatusDto): void {
    this.targetMachineForStatus.set(machine);
    this.formNewStatus.set(machine.status);
    this.formStatusReasonId.set(machine.currentReasonId || null);
    this.formStatusOperator.set(machine.operatorName || '');
    this.formStatusWorkOrder.set(machine.workOrderCode || '');
    this.formStatusRemarks.set('');
    this.changeStatusDialogOpen.set(true);
  }

  onStatusChoiceSelect(statusKey: string): void {
    this.formNewStatus.set(statusKey);
    if (statusKey !== 'DOWNTIME' && statusKey !== 'CHANGEOVER') {
      this.formStatusReasonId.set(null);
    }
  }

  saveStatusChange(): void {
    const tm = this.targetMachineForStatus();
    if (!tm) return;

    const newStatus = this.formNewStatus();
    if (newStatus === 'DOWNTIME' && !this.formStatusReasonId()) {
      this.messages.add({
        severity: 'warn',
        summary: 'Reason Required',
        detail: 'Please specify a downtime reason code.',
      });
      return;
    }

    const payload: ChangeMachineStatusRequest = {
      machineId: tm.machineId,
      newStatus,
      reasonId: this.formStatusReasonId(),
      operatorName: this.formStatusOperator().trim() || null,
      workOrderCode: this.formStatusWorkOrder().trim() || null,
      remarks: this.formStatusRemarks().trim() || null,
    };

    this.statusSaving.set(true);
    this.statusApi.changeStatus(payload).subscribe({
      next: () => {
        this.statusSaving.set(false);
        this.changeStatusDialogOpen.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Status Changed',
          detail: `Machine ${tm.machineCode} changed to ${newStatus}.`,
        });
        this.refreshAll();
      },
      error: err => {
        this.statusSaving.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.message || 'Failed to change machine status.',
        });
      },
    });
  }

  // ── Log Defect Handlers ───────────────────────────────────
  openLogDefect(machine: MachineRealtimeStatusDto): void {
    this.targetMachineForDefect.set(machine);
    this.formDefectMachineId.set(machine.machineId);
    this.formDefectType.set('SCRAP');
    this.formDefectReasonId.set(null);
    this.formDefectQty.set(1);
    this.formDefectProductId.set(null);
    this.formDefectWorkOrder.set(machine.workOrderCode || '');
    this.formDefectOperator.set(machine.operatorName || '');
    this.formDefectRemarks.set('');
    this.logDefectDialogOpen.set(true);
  }

  openDirectLogDefect(): void {
    this.targetMachineForDefect.set(null);
    this.formDefectMachineId.set(null);
    this.formDefectType.set('SCRAP');
    this.formDefectReasonId.set(null);
    this.formDefectQty.set(1);
    this.formDefectProductId.set(null);
    this.formDefectWorkOrder.set('');
    this.formDefectOperator.set('');
    this.formDefectRemarks.set('');
    this.logDefectDialogOpen.set(true);
  }

  onDefectTypeChanged(type: 'SCRAP' | 'REWORK'): void {
    this.formDefectType.set(type);
    this.formDefectReasonId.set(null);
  }

  saveDefectLog(): void {
    const machineId = this.targetMachineForDefect()?.machineId || this.formDefectMachineId();
    if (!machineId) {
      this.messages.add({
        severity: 'warn',
        summary: 'Machine Required',
        detail: 'Please select a machine.',
      });
      return;
    }

    if (!this.formDefectReasonId()) {
      this.messages.add({
        severity: 'warn',
        summary: 'Reason Required',
        detail: 'Please select a defect reason code.',
      });
      return;
    }

    const qty = this.formDefectQty();
    if (qty <= 0) {
      this.messages.add({
        severity: 'warn',
        summary: 'Invalid Quantity',
        detail: 'Quantity must be greater than 0.',
      });
      return;
    }

    const payload: LogMachineDefectRequest = {
      machineId,
      defectType: this.formDefectType(),
      reasonId: this.formDefectReasonId(),
      quantity: qty,
      productId: this.formDefectProductId(),
      workOrderCode: this.formDefectWorkOrder().trim() || null,
      operatorName: this.formDefectOperator().trim() || null,
      remarks: this.formDefectRemarks().trim() || null,
    };

    this.defectSaving.set(true);
    this.statusApi.logDefect(payload).subscribe({
      next: () => {
        this.defectSaving.set(false);
        this.logDefectDialogOpen.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Defect Recorded',
          detail: `Logged ${qty} units of ${payload.defectType}.`,
        });
        this.refreshAll();
        if (this.activeTab() === 'defects') {
          this.loadDefectLogs();
        }
      },
      error: err => {
        this.defectSaving.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.message || 'Failed to log defect.',
        });
      },
    });
  }

  // ── Reason Codes CRUD ─────────────────────────────────────
  openCreateReason(): void {
    this.editingReasonId.set(null);
    this.formReasonCode.set('');
    this.formReasonName.set('');
    this.formReasonType.set('DOWNTIME');
    this.formReasonCategory.set('Mechanical');
    this.formReasonIsPlanned.set(false);
    this.formReasonDescription.set('');
    this.reasonDialogOpen.set(true);
  }

  openEditReason(r: MachineReasonCodeDto): void {
    this.editingReasonId.set(r.id);
    this.formReasonCode.set(r.reasonCode);
    this.formReasonName.set(r.reasonName);
    this.formReasonType.set(r.reasonType);
    this.formReasonCategory.set(r.category);
    this.formReasonIsPlanned.set(r.isPlanned);
    this.formReasonDescription.set(r.description || '');
    this.reasonDialogOpen.set(true);
  }

  saveReason(): void {
    const code = this.formReasonCode().trim().toUpperCase();
    const name = this.formReasonName().trim();

    if (!code || !name) {
      this.messages.add({
        severity: 'warn',
        summary: 'Missing Fields',
        detail: 'Reason code and name are required.',
      });
      return;
    }

    const payload: MachineReasonCodeRequest = {
      reasonCode: code,
      reasonName: name,
      reasonType: this.formReasonType(),
      category: this.formReasonCategory(),
      isPlanned: this.formReasonIsPlanned(),
      isActive: true,
      description: this.formReasonDescription().trim() || null,
    };

    this.reasonSaving.set(true);
    const id = this.editingReasonId();
    const call$ = id ? this.statusApi.updateReason(id, payload) : this.statusApi.createReason(payload);

    call$.subscribe({
      next: () => {
        this.reasonSaving.set(false);
        this.reasonDialogOpen.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Success',
          detail: id ? 'Reason updated.' : 'Reason code registered.',
        });
        this.loadReasons();
        this.loadAllReasonsCache();
      },
      error: err => {
        this.reasonSaving.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.message || 'Failed to save reason code.',
        });
      },
    });
  }

  confirmDeleteReason(r: MachineReasonCodeDto): void {
    this.confirm.confirm({
      message: `Delete reason code "${r.reasonCode} - ${r.reasonName}"?`,
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.statusApi.deleteReason(r.id).subscribe({
          next: () => {
            this.messages.add({
              severity: 'success',
              summary: 'Deleted',
              detail: `Reason code "${r.reasonCode}" removed.`,
            });
            this.loadReasons();
            this.loadAllReasonsCache();
          },
          error: () =>
            this.messages.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to delete reason code.',
            }),
        });
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  getStatusConfig(status: string) {
    return (
      (this.statusConfig as any)[status] || {
        label: status,
        viLabel: status,
        icon: 'pi-circle',
        color: '#64748b',
        bg: '#f1f5f9',
        border: '#cbd5e1',
      }
    );
  }

  formatDuration(seconds?: number | null): string {
    if (!seconds || seconds <= 0) return '0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }

  goToMachineMaster(): void {
    this.router.navigate(['/machines']);
  }
}

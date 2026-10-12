export interface MachineReasonCodeDto {
  id: number;
  reasonCode: string;
  reasonName: string;
  reasonType: 'DOWNTIME' | 'SCRAP' | 'REWORK';
  category: string;
  isPlanned: boolean;
  isActive: boolean;
  description?: string | null;
}

export interface MachineReasonCodeRequest {
  reasonCode: string;
  reasonName: string;
  reasonType: string;
  category: string;
  isPlanned: boolean;
  isActive: boolean;
  description?: string | null;
}

export interface MachineRealtimeStatusDto {
  machineId: number;
  machineCode: string;
  machineName: string;
  lineId?: number | null;
  lineName?: string | null;
  machineTypeId?: number | null;
  machineTypeName?: string | null;

  status: 'RUNNING' | 'IDLE' | 'DOWNTIME' | 'CHANGEOVER' | 'MAINTENANCE' | 'OFFLINE';
  statusStartTime: string;
  durationSeconds: number;
  durationMinutes: number;

  currentReasonId?: number | null;
  currentReasonCode?: string | null;
  currentReasonName?: string | null;
  reasonCategory?: string | null;
  isPlannedDowntime?: boolean | null;

  operatorName?: string | null;
  workOrderCode?: string | null;
  remarks?: string | null;

  todayDowntimeMinutes: number;
  todayScrapQty: number;
  todayReworkQty: number;
}

export interface ChangeMachineStatusRequest {
  machineId: number;
  newStatus: string;
  reasonId?: number | null;
  operatorName?: string | null;
  workOrderCode?: string | null;
  remarks?: string | null;
}

export interface MachineStatusHistoryDto {
  id: number;
  machineId: number;
  machineCode: string;
  machineName: string;
  status: string;
  startTime: string;
  endTime?: string | null;
  durationSeconds?: number | null;
  durationMinutes: number;

  reasonId?: number | null;
  reasonCode?: string | null;
  reasonName?: string | null;
  operatorName?: string | null;
  workOrderCode?: string | null;
  remarks?: string | null;
}

export interface LogMachineDefectRequest {
  machineId: number;
  defectType: 'SCRAP' | 'REWORK';
  reasonId?: number | null;
  quantity: number;
  productId?: number | null;
  productCode?: string | null;
  workOrderCode?: string | null;
  operatorName?: string | null;
  remarks?: string | null;
}

export interface MachineDefectLogDto {
  id: number;
  machineId: number;
  machineCode: string;
  machineName: string;
  defectType: string;
  reasonId?: number | null;
  reasonCode?: string | null;
  reasonName?: string | null;
  quantity: number;
  productId?: number | null;
  productCode?: string | null;
  workOrderCode?: string | null;
  loggedTime: string;
  operatorName?: string | null;
  remarks?: string | null;
}

export interface MachineStatusDashboardSummaryDto {
  totalMachines: number;
  runningCount: number;
  idleCount: number;
  downtimeCount: number;
  changeoverCount: number;
  maintenanceCount: number;
  offlineCount: number;
  availabilityPercentage: number;
  totalDowntimeMinutesToday: number;
  totalScrapQtyToday: number;
  totalReworkQtyToday: number;
}

export const MACHINE_STATUS_CONFIG = {
  RUNNING: {
    label: 'Running',
    viLabel: 'Đang chạy',
    icon: 'pi-play',
    color: '#16a34a',
    bg: '#dcfce7',
    border: '#86efac',
    severity: 'success' as const,
  },
  IDLE: {
    label: 'Idle / Standby',
    viLabel: 'Chờ việc',
    icon: 'pi-pause',
    color: '#d97706',
    bg: '#fef3c7',
    border: '#fde68a',
    severity: 'warn' as const,
  },
  DOWNTIME: {
    label: 'Downtime / Breakdown',
    viLabel: 'Dừng máy / Sự cố',
    icon: 'pi-exclamation-triangle',
    color: '#dc2626',
    bg: '#fee2e2',
    border: '#fca5a5',
    severity: 'danger' as const,
  },
  CHANGEOVER: {
    label: 'Setup / Changeover',
    viLabel: 'Chuyển đổi / Gá đặt',
    icon: 'pi-sync',
    color: '#7c3aed',
    bg: '#ede9fe',
    border: '#c4b5fd',
    severity: 'info' as const,
  },
  MAINTENANCE: {
    label: 'PM Maintenance',
    viLabel: 'Bảo trì định kỳ',
    icon: 'pi-wrench',
    color: '#0284c7',
    bg: '#e0f2fe',
    border: '#7dd3fc',
    severity: 'info' as const,
  },
  OFFLINE: {
    label: 'Offline / Powered Off',
    viLabel: 'Ngoại tuyến / Tắt máy',
    icon: 'pi-power-off',
    color: '#64748b',
    bg: '#f1f5f9',
    border: '#cbd5e1',
    severity: 'secondary' as const,
  },
};

export const REASON_TYPES = [
  { label: 'Downtime (Availability Loss)', value: 'DOWNTIME', icon: 'pi-clock' },
  { label: 'Scrap (Unrecoverable Defect)', value: 'SCRAP', icon: 'pi-trash' },
  { label: 'Rework (Repairable Defect)', value: 'REWORK', icon: 'pi-replay' },
];

export const REASON_CATEGORIES = [
  'Mechanical',
  'Electrical',
  'Tooling',
  'Material',
  'Quality',
  'Process',
  'Operational',
  'Changeover',
  'Maintenance',
  'Utility',
  'Assembly',
  'Finishing',
  'General',
];

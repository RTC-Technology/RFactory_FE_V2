export interface ProductionOrderMaterialDto {
  id?: number;
  productionOrderId?: number;
  productId: number;
  productCode?: string | null;
  productName?: string | null;
  unitId?: number | null;
  unitName?: string | null;
  normQuantity: number;
  requiredQuantity: number;
  issuedQuantity?: number;
  currentStock?: number;
  warehouseId?: number | null;
  warehouseName?: string | null;
  isSubstituted?: boolean;
  originalProductId?: number | null;
  originalProductName?: string | null;
  remark?: string | null;
}

export interface ProductionOrderOperationDto {
  id?: number;
  productionOrderId?: number;
  routingOperationId?: number | null;
  sequence: number;
  operationCode: string;
  operationName: string;
  workCenterId?: number | null;
  workCenterName?: string | null;
  machineId?: number | null;
  machineName?: string | null;
  assignedEmployeeId?: number | null;
  assignedEmployeeName?: string | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  status: number;
  statusName?: string;
  remark?: string | null;
}

export interface ProductionOrderDto {
  id: number;
  createdDate: string;
  createdBy: string;
  updatedDate?: string | null;
  updatedBy?: string | null;

  orderNo: string;
  orderType: number;
  orderTypeName?: string;
  description?: string | null;

  productId: number;
  productCode?: string | null;
  productName?: string | null;

  unitId?: number | null;
  unitName?: string | null;

  bomId?: number | null;
  bomCode?: string | null;
  bomName?: string | null;
  bomVersion?: string | null;

  routingId?: number | null;
  routingVersion?: string | null;

  factoryId?: number | null;
  factoryName?: string | null;

  lineId?: number | null;
  lineCode?: string | null;
  lineName?: string | null;

  workCenterId?: number | null;
  workCenterName?: string | null;

  customerId?: number | null;
  customerName?: string | null;

  plannedQuantity: number;
  completedQuantity: number;
  scrapQuantity: number;
  progressPercentage: number;

  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  durationHours?: number | null;

  priority: number;
  priorityName: string;

  status: number;
  statusName: string;

  batchNo?: string | null;
  salesOrderNo?: string | null;
  remark?: string | null;

  materials?: ProductionOrderMaterialDto[];
  operations?: ProductionOrderOperationDto[];
}

export interface ProductionOrderCreateRequest {
  orderNo?: string | null;
  orderType: number;
  description?: string | null;
  productId: number;
  unitId?: number | null;
  bomId?: number | null;
  routingId?: number | null;
  factoryId?: number | null;
  lineId?: number | null;
  workCenterId?: number | null;
  customerId?: number | null;
  plannedQuantity: number;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  priority: number;
  batchNo?: string | null;
  salesOrderNo?: string | null;
  remark?: string | null;
  materials?: ProductionOrderMaterialDto[];
  operations?: ProductionOrderOperationDto[];
}

export interface ProductionOrderUpdateRequest {
  orderType?: number;
  description?: string | null;
  productId: number;
  unitId?: number | null;
  bomId?: number | null;
  routingId?: number | null;
  factoryId?: number | null;
  lineId?: number | null;
  workCenterId?: number | null;
  customerId?: number | null;
  plannedQuantity: number;
  completedQuantity?: number | null;
  scrapQuantity?: number | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  priority: number;
  batchNo?: string | null;
  salesOrderNo?: string | null;
  remark?: string | null;
  materials?: ProductionOrderMaterialDto[];
  operations?: ProductionOrderOperationDto[];
}

export interface ProductionOrderStatusRequest {
  status: number;
  remark?: string | null;
}

export interface ProductionOrderProgressRequest {
  completedQuantityDelta: number;
  scrapQuantityDelta: number;
  batchNo?: string | null;
  remark?: string | null;
}

export interface ProductionOrderFilter {
  status?: number | null;
  priority?: number | null;
  orderType?: number | null;
  productId?: number | null;
  lineId?: number | null;
  fromDate?: string | null;
  toDate?: string | null;
  searchKeyword?: string | null;
}

export const PRODUCTION_ORDER_TYPES = [
  { value: 1, labelKey: 'productionOrder.type.mts', code: 'MTS' },
  { value: 2, labelKey: 'productionOrder.type.mto', code: 'MTO' },
  { value: 3, labelKey: 'productionOrder.type.mrp', code: 'MRP' },
  { value: 4, labelKey: 'productionOrder.type.other', code: 'OTHER' },
];

export const PRODUCTION_ORDER_STATUSES = [
  { value: 1, labelKey: 'productionOrder.status.draft', severity: 'secondary' as const },
  { value: 2, labelKey: 'productionOrder.status.released', severity: 'info' as const },
  { value: 3, labelKey: 'productionOrder.status.inProgress', severity: 'warn' as const },
  { value: 7, labelKey: 'productionOrder.status.paused', severity: 'danger' as const },
  { value: 4, labelKey: 'productionOrder.status.completed', severity: 'success' as const },
  { value: 5, labelKey: 'productionOrder.status.cancelled', severity: 'danger' as const },
  { value: 6, labelKey: 'productionOrder.status.closed', severity: 'contrast' as const },
];

export const PRODUCTION_ORDER_PRIORITIES = [
  { value: 1, labelKey: 'productionOrder.priority.low', severity: 'secondary' as const },
  { value: 2, labelKey: 'productionOrder.priority.normal', severity: 'info' as const },
  { value: 3, labelKey: 'productionOrder.priority.high', severity: 'warn' as const },
  { value: 4, labelKey: 'productionOrder.priority.urgent', severity: 'danger' as const },
];

export function productionOrderStatusOf(status: number): { labelKey: string; severity: 'secondary' | 'info' | 'warn' | 'success' | 'danger' | 'contrast' } {
  const found = PRODUCTION_ORDER_STATUSES.find(s => s.value === status);
  return found ?? { labelKey: 'productionOrder.status.unknown', severity: 'secondary' };
}

export function productionOrderPriorityOf(priority: number): { labelKey: string; severity: 'secondary' | 'info' | 'warn' | 'danger' } {
  const found = PRODUCTION_ORDER_PRIORITIES.find(p => p.value === priority);
  return found ?? { labelKey: 'productionOrder.priority.normal', severity: 'info' };
}

export function productionOrderTypeOf(orderType: number): { labelKey: string; code: string } {
  const found = PRODUCTION_ORDER_TYPES.find(t => t.value === orderType);
  return found ?? { labelKey: 'productionOrder.type.other', code: 'OTHER' };
}

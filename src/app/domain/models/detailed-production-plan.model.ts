export interface MasterProductionPlanDto {
  id: number;
  createdDate: string;
  createdBy: string;
  planCode: string;
  planName: string;
  periodType: string;
  periodName?: string;
  fromDate: string;
  toDate: string;
  workshopId?: number;
  workshopName?: string;
  status: number;
  statusName: string;
  totalQuantity: number;
  remark?: string;
  items: MasterProductionPlanItemDto[];
}

export interface MasterProductionPlanItemDto {
  id: number;
  masterPlanId: number;
  productId: number;
  productCode: string;
  productName: string;
  unitId?: number;
  unitName?: string;
  plannedQuantity: number;
  allocatedQuantity: number;
  remainingQuantity: number;
  dailyCapacity: number;
  remark?: string;
}

export interface DetailedProductionPlanDto {
  id: number;
  createdDate: string;
  createdBy: string;
  updatedDate?: string;
  updatedBy?: string;
  planCode: string;
  planName: string;
  masterPlanId?: number;
  masterPlanCode?: string;
  workshopId?: number;
  workshopName?: string;
  lineId?: number;
  lineName?: string;
  departmentId?: number;
  departmentName?: string;
  periodType: 'DAY' | 'SHIFT' | string;
  fromDate: string;
  toDate: string;
  allocationMethod: 'FORWARD' | 'BACKWARD' | 'MANUAL' | string;
  status: number;
  statusName: string;
  totalRequiredQuantity: number;
  totalPlannedQuantity: number;
  productionOrderCount: number;
  remark?: string;
  items: DetailedProductionPlanItemDto[];
  schedules: DetailedProductionPlanScheduleDto[];
}

export interface DetailedProductionPlanItemDto {
  id: number;
  planId: number;
  productId: number;
  productCode: string;
  productName: string;
  unitId?: number;
  unitName?: string;
  requiredQuantity: number;
  currentStock: number;
  plannedQuantity: number;
  dailyCapacity: number;
  salesOrderNo?: string;
  sequence: number;
  remark?: string;
  remainingToPlan: number;
}

export interface DetailedProductionPlanScheduleDto {
  id?: number;
  planId?: number;
  planItemId?: number;
  productId: number;
  scheduleDate: string;
  shiftId?: number;
  shiftName?: string;
  capacity: number;
  plannedQuantity: number;
  isDayOff: boolean;
  isOvertime: boolean;
  productionOrderId?: number;
  productionOrderNo?: string;
  remark?: string;
}

export interface DetailedProductionPlanFilter {
  keyword?: string;
  workshopId?: number;
  status?: number;
  fromDate?: string;
  toDate?: string;
}

export interface DetailedProductionPlanCreateRequest {
  planCode?: string;
  planName: string;
  masterPlanId?: number;
  masterPlanCode?: string;
  workshopId?: number;
  workshopName?: string;
  lineId?: number;
  lineName?: string;
  departmentId?: number;
  departmentName?: string;
  periodType: string;
  fromDate: string;
  toDate: string;
  allocationMethod: string;
  remark?: string;
  items: DetailedProductionPlanItemRequest[];
  schedules: DetailedProductionPlanScheduleRequest[];
}

export interface DetailedProductionPlanUpdateRequest {
  planName: string;
  masterPlanId?: number;
  masterPlanCode?: string;
  workshopId?: number;
  workshopName?: string;
  lineId?: number;
  lineName?: string;
  departmentId?: number;
  departmentName?: string;
  periodType: string;
  fromDate: string;
  toDate: string;
  allocationMethod: string;
  remark?: string;
  items: DetailedProductionPlanItemRequest[];
  schedules: DetailedProductionPlanScheduleRequest[];
}

export interface DetailedProductionPlanItemRequest {
  id?: number;
  productId: number;
  productCode: string;
  productName: string;
  unitId?: number;
  unitName?: string;
  requiredQuantity: number;
  currentStock: number;
  plannedQuantity: number;
  dailyCapacity: number;
  salesOrderNo?: string;
  sequence?: number;
  remark?: string;
}

export interface DetailedProductionPlanScheduleRequest {
  id?: number;
  planItemId?: number;
  productId: number;
  scheduleDate: string;
  shiftId?: number;
  shiftName?: string;
  capacity: number;
  plannedQuantity: number;
  isDayOff: boolean;
  isOvertime: boolean;
  remark?: string;
}

export interface PlanAllocationCalculationRequest {
  method: 'FORWARD' | 'BACKWARD';
  periodType: 'DAY' | 'SHIFT';
  fromDate: string;
  toDate: string;
  items: {
    productId: number;
    productCode: string;
    productName: string;
    requiredQuantity: number;
    dailyCapacity: number;
  }[];
  shifts?: string[];
  dayOffOverrides?: {
    date: string;
    isDayOff: boolean;
    isOvertime: boolean;
  }[];
}

export interface PlanAllocationCalculationResultDto {
  schedules: DetailedProductionPlanScheduleDto[];
  itemSummaries: {
    productId: number;
    productCode: string;
    requiredQuantity: number;
    allocatedQuantity: number;
    remainingQuantity: number;
    isMatched: boolean;
  }[];
  isFullyAllocated: boolean;
  message: string;
}

export interface ValidateQuantitiesRequest {
  items: {
    productId: number;
    productCode: string;
    productName: string;
    requiredQuantity: number;
    dailyCapacity: number;
  }[];
  schedules: DetailedProductionPlanScheduleDto[];
}

export interface ValidateQuantitiesResultDto {
  isValid: boolean;
  summaryMessage: string;
  details: {
    productId: number;
    productCode: string;
    productName: string;
    requiredQuantity: number;
    plannedQuantity: number;
    difference: number;
    status: 'MATCH' | 'DEFICIT' | 'EXCESS';
    statusLabel: string;
  }[];
}

export interface GenerateOrdersFromPlanRequest {
  planId: number;
  productIds?: number[];
  groupBy: 'DAY' | 'ITEM';
  autoApprove: boolean;
  remark?: string;
}

export interface GenerateOrdersResultDto {
  generatedCount: number;
  generatedOrders: {
    orderId: number;
    orderNo: string;
    productId: number;
    productCode: string;
    productName: string;
    plannedQuantity: number;
    plannedStartDate?: string;
    plannedEndDate?: string;
    status: string;
  }[];
  message: string;
}

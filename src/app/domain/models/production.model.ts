//#region Sale Order
export interface SalesOrderDto {
    id: number;
    orderNo: string;
    customerId: number;
    parentId?: number | null;
    orderDate: string;
    expectedDeliveryDate?: string | null;
    orderType: number;
    status: number;
    executionStatus: number;
    revenueStatus: number;
    currencyId?: number | null;
    exchangeRate: number;
    totalAmount: number;
    discountAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    paymentTermDays?: number | null;
    paymentDueDate?: string | null;
    opportunityId?: number | null;
    campaignId?: number | null;
    quotationId?: number | null;
    description?: string | null;
}

export interface SalesOrderItemDto {
    id: number;
    salesOrderId?: number | null;
    productId: number;
    productName: string;
    unitId?: number | null;
    warehouseId?: number | null;
    orderedQuantity: number;
    deliveredQuantity?: number | null;
    cancelledQuantity?: number | null;
    unitPrice: number;
    amount: number;
    discountPercent: number;
    discountAmount: number;
    taxPercent: number;
    taxAmount: number;
    totalAmount: number;
    expectedDeliveryDate?: string | null;
    description?: string | null;
}

export interface SalesOrderPaymentScheduleDto {
    id: number;
    salesOrderId?: number | null;
    scheduleNo: number;
    scheduleName: string;
    paymentPercent: number;
    paymentAmount: number;
    dueDate?: string | null;
    paidAmount?: number | null;
    status: number;
    description?: string | null;
}

export type SalesOrderRequest = Omit<SalesOrderDto, 'id'> & {
    salesOrderItems?: SalesOrderItemRequest[] | null;
    salesOrderPaymentSchedules?: SalesOrderPaymentScheduleRequest[] | null;
};
export type SalesOrderItemRequest = Omit<SalesOrderItemDto, 'id'>;
export type SalesOrderPaymentScheduleRequest = Omit<SalesOrderPaymentScheduleDto, 'id'>;

export const SALES_ORDER_TYPES = [
    { labelKey: 'salesOrder.type.standard', value: 1 },
    { labelKey: 'salesOrder.type.additional', value: 2 },
    { labelKey: 'salesOrder.type.adjustment', value: 3 },
    { labelKey: 'salesOrder.type.scheduledDelivery', value: 4 },
];

export const SALES_ORDER_STATUSES = [
    { labelKey: 'salesOrder.status.draft', value: 1 },
    { labelKey: 'salesOrder.status.confirmed', value: 2 },
    { labelKey: 'salesOrder.status.inProgress', value: 3 },
    { labelKey: 'salesOrder.status.partiallyCompleted', value: 4 },
    { labelKey: 'salesOrder.status.completed', value: 5 },
    { labelKey: 'salesOrder.status.cancelled', value: 6 },
    { labelKey: 'salesOrder.status.closed', value: 7 },
];

export const SALES_ORDER_EXECUTION_STATUSES = [
    { labelKey: 'salesOrder.executionStatus.notStarted', value: 1 },
    { labelKey: 'salesOrder.executionStatus.inProgress', value: 2 },
    { labelKey: 'salesOrder.executionStatus.partiallyCompleted', value: 3 },
    { labelKey: 'salesOrder.executionStatus.completed', value: 4 },
    { labelKey: 'salesOrder.executionStatus.cancelled', value: 5 },
];

export const SALES_ORDER_REVENUE_STATUSES = [
    { labelKey: 'salesOrder.revenueStatus.notRecognized', value: 1 },
    { labelKey: 'salesOrder.revenueStatus.partiallyRecognized', value: 2 },
    { labelKey: 'salesOrder.revenueStatus.fullyRecognized', value: 3 },
    { labelKey: 'salesOrder.revenueStatus.cancelled', value: 4 },
];

export const SALES_ORDER_PAYMENT_SCHEDULE_STATUSES = [
    { labelKey: 'salesOrderPaymentSchedule.status.pending', value: 1 },
    { labelKey: 'salesOrderPaymentSchedule.status.due', value: 2 },
    { labelKey: 'salesOrderPaymentSchedule.status.partiallyPaid', value: 3 },
    { labelKey: 'salesOrderPaymentSchedule.status.paid', value: 4 },
    { labelKey: 'salesOrderPaymentSchedule.status.overdue', value: 5 },
    { labelKey: 'salesOrderPaymentSchedule.status.cancelled', value: 6 },
];

export const SALES_ORDER_PAYMENT_SCHEDULE_STATUSES_ENUM = {
    PENDING: 1,
    DUE: 2,
    PARTIALLY_PAID: 3,
    PAID: 4,
    OVERDUE: 5,
    CANCELLED: 6,
};
//#endregion

//#region Production Request
export interface ProductionRequestDto {
    id: number;
    requestNo: string;
    salesOrderId?: number | null;
    salesOrderNo?: string | null;
    customerId?: number | null;
    requestDate: string;
    requiredDate: string;
    receiptMaterialDate: string;
    priority: number;
    status: number;
    description?: string | null;
    remark?: string | null;

}

export interface ProductionRequestItemDto {
    id: number;
    productionRequestId?: number | null;
    salesOrderItemId?: number | null;
    productId: number;
    productCode?: string | null;
    productName?: string | null;
    unitId?: number | null;
    requestedQuantity: number;
    plannedQuantity: number;
    producedQuantity: number;
    requiredDate?: string | null;
    status: number;
    sortOrder: number;
    remark?: string | null;
}

export type ProductionRequestRequest = Omit<ProductionRequestDto, 'id'> & {
    productionRequestItems?: ProductionRequestItemRequest[] | null;
};
export type ProductionRequestItemRequest = Omit<ProductionRequestItemDto, 'id'>;

// Enums
export enum PRODUCTION_REQUEST_PRIORITY_ENUM {
    URGENT = 1,
    HIGH = 2,
    NORMAL = 3,
    LOW = 4,
}

export enum PRODUCTION_REQUEST_STATUS_ENUM {
    DRAFT = 1,
    PENDING_APPROVAL = 2,
    APPROVED = 3,
    REJECTED = 4,
    CANCELLED = 5,
    CLOSED = 6,
}

export enum PRODUCTION_REQUEST_ITEM_STATUS_ENUM {
    PENDING = 1,
    PARTIALLY_PLANNED = 2,
    PLANNED = 3,
    IN_PROGRESS = 4,
    COMPLETED = 5,
    CANCELLED = 6,
}

// Status & Priority Select Options
export const PRODUCTION_REQUEST_PRIORITIES = [
    { labelKey: 'productionRequest.priority.urgent', value: 1, severity: 'danger' as const },
    { labelKey: 'productionRequest.priority.high', value: 2, severity: 'warn' as const },
    { labelKey: 'productionRequest.priority.normal', value: 3, severity: 'info' as const },
    { labelKey: 'productionRequest.priority.low', value: 4, severity: 'secondary' as const },
];

export const PRODUCTION_REQUEST_STATUSES = [
    { labelKey: 'productionRequest.status.draft', value: 1, severity: 'secondary' as const },
    { labelKey: 'productionRequest.status.pendingApproval', value: 2, severity: 'warn' as const },
    { labelKey: 'productionRequest.status.approved', value: 3, severity: 'success' as const },
    { labelKey: 'productionRequest.status.rejected', value: 4, severity: 'danger' as const },
    { labelKey: 'productionRequest.status.cancelled', value: 5, severity: 'danger' as const },
    { labelKey: 'productionRequest.status.closed', value: 6, severity: 'contrast' as const },
];

export const PRODUCTION_REQUEST_STATUSES_ENUM = {
    DRAFT: 1,
    PENDING_APPROVAL: 2,
    APPROVED: 3,
    REJECTED: 4,
    CANCELLED: 5,
    CLOSED: 6,
};

export const PRODUCTION_REQUEST_ITEM_STATUSES = [
    { labelKey: 'productionRequestItem.status.pending', value: 1, severity: 'secondary' as const },
    { labelKey: 'productionRequestItem.status.partiallyPlanned', value: 2, severity: 'info' as const },
    { labelKey: 'productionRequestItem.status.planned', value: 3, severity: 'warn' as const },
    { labelKey: 'productionRequestItem.status.inProgress', value: 4, severity: 'warn' as const },
    { labelKey: 'productionRequestItem.status.completed', value: 5, severity: 'success' as const },
    { labelKey: 'productionRequestItem.status.cancelled', value: 6, severity: 'danger' as const },
];

export const PRODUCTION_REQUEST_ITEM_STATUSES_ENUM = {
    PENDING: 1,
    PARTIALLY_PLANNED: 2,
    PLANNED: 3,
    IN_PROGRESS: 4,
    COMPLETED: 5,
    CANCELLED: 6,
};

// Helper functions
export function getStatusOf(value: number) {
    return PRODUCTION_REQUEST_STATUSES.find(x => x.value === value);
}

export function getPriorityOf(value: number) {
    return PRODUCTION_REQUEST_PRIORITIES.find(s => s.value === value);
}

export function getItemStatusOf(value: number) {
    return PRODUCTION_REQUEST_ITEM_STATUSES.find(s => s.value === value);
}
//#endregion

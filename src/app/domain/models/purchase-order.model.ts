//Dto
export interface PurchaseOrderDto {
    id: number;

    pono: string;
    supplierId: number;
    orderDate: string;
    expectedDeliveryDate?: string | null;
    status?: number | null;

    currencyId?: number | null;
    exchangeRate?: number | null;
    paymentTermId?: number | null;
    deliveryTermId?: number | null;
    employeeId?: number | null;

    requestedDate?: string | null;

    subTotal?: number | null;
    discountAmount?: number | null;
    taxAmount?: number | null;
    shippingAmount?: number | null;
    otherAmount?: number | null;
    totalAmount?: number | null;

    remark?: string | null;

    approvedDate?: string | null;
    approvedBy?: string | null;
}

export interface PurchaseOrderDetailDto {
    id: number;
    purchaseOrderId: number;
    stt: number;
    productId: number;
    unitId: number;
    requiredDate?: string | null;

    quantity: number;
    receivedQuantity?: number | null;
    rejectedQuantity?: number | null;

    unitPrice: number;

    discountPercent: number;
    discountAmount: number;

    taxPercent: number;
    taxAmount: number;

    totalAmount: number;

    warehouseId?: number | null;
    remark?: string | null;
}

export interface PurchaseOrderDeliveryScheduleDto {
    id: number;
    purchaseOrderDetailId: number;
    deliveryDate: string;
    quantity: number;
}

//Request
export type PurchaseOrderRequest = Omit<PurchaseOrderDto, 'id'> & {
    /**
     * Toàn bộ danh sách dòng, thay thế những gì phiếu đang có: dòng vắng mặt sẽ bị xoá.
     * Bỏ trống (undefined) nếu chỉ sửa phần đầu phiếu — mảng rỗng nghĩa là "phiếu này
     * không còn dòng nào".
     */
    purchaseOrderDetailRequests?: PurchaseOrderDetailRequest[];
};

export type PurchaseOrderDetailRequest = Omit<PurchaseOrderDetailDto, 'id'> & {
    purchaseOrderDeliveryScheduleRequests?: PurchaseOrderDeliveryScheduleRequest[];
}
export type PurchaseOrderDeliveryScheduleRequest = Omit<PurchaseOrderDeliveryScheduleDto, 'id'>;

//enum
export enum PurchaseOrderStatus {
    Draft = 1,
    Approved = 2,
    PartiallyReceived = 3,
    FullyReceived = 4,
    Cancelled = 5,
    Closed = 6
}

export const PURCHASE_ORDER_STATUSES = [
    {
        labelKey: 'purchaseOrder.status.draft',
        value: 1,
    },
    {
        labelKey: 'purchaseOrder.status.approved',
        value: 2,
    },
    {
        labelKey: 'purchaseOrder.status.partiallyReceived',
        value: 3,
    },
    {
        labelKey: 'purchaseOrder.status.fullyReceived',
        value: 4,
    },
    {
        labelKey: 'purchaseOrder.status.cancelled',
        value: 5,
    },
    {
        labelKey: 'purchaseOrder.status.closed',
        value: 6,
    },
];

export function getPurchaseOrderStatusLabel(value: number): string {
    return PURCHASE_ORDER_STATUSES.find(x => x.value === value)?.labelKey ?? '';
}

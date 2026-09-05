//#region Dto
export interface PickingPlanDto {
    id: number;
    planNo: string;
    warehouseId?: number | null;
    status: number;
    remark?: string | null;
}

export interface PickingPlanItemDto {
    id: number;
    pickingPlanId?: number | null;
    productId?: number | null;
    unitId?: number | null;

    requiredQty?: number | null;
    allocatedQty?: number | null;
    pickedQty?: number | null;
    remainingQty?: number | null;

    status?: number | null;

    remark?: string | null;
}

export interface PickingPlanItemSourceDto {
    id: number;

    pickingPlanItemId?: number | null;
    sourceId?: number | null;
    sourceDetailId?: number | null;

    requiredQty?: number | null;
    pickedQty?: number | null;
}

export interface PickingPlanSourceDto {
    id: number;
    pickingPlanId?: number | null;
    sourceType?: number | null;
    sourceId?: number | null;
    sourceNo?: string | null;
}

export interface PickingTicketDto {
    id: number;

    ticketNo: string;
    pickingPlanId?: number | null;
    warehouseId?: number | null;

    status: number;

    assignedTo?: number | null;
    startedAt?: string | null;
    completedAt?: string | null;

    remark?: string | null;
}

export interface PickingTicketItemDto {
    id: number;

    pickingTicketId?: number | null;
    pickingPlanItemId?: number | null;
    productId?: number | null;
    locationId?: number | null;
    lotId?: number | null;
    serialNo?: string | null;

    requestedQty?: number | null;
    pickedQty?: number | null;

    status?: number | null;

    remark?: string | null;
}
//#endregion


//#region Request
export type PickingPlanRequest = Omit<PickingPlanDto, 'id'> & {
    pickingPlanItems?: PickingPlanItemRequest[];
    pickingPlanSources?: PickingPlanSourceRequest[];
    pickingTickets?: PickingTicketRequest[];
};
export type PickingPlanItemRequest = Omit<PickingPlanItemDto, 'id'> & {
    pickingPlanItemSources?: PickingPlanItemSourceRequest[];
    pickingTicketItems?: PickingTicketItemRequest[];
};
export type PickingPlanItemSourceRequest = Omit<PickingPlanItemSourceDto, 'id'>;
export type PickingPlanSourceRequest = Omit<PickingPlanSourceDto, 'id'>;
export type PickingTicketRequest = Omit<PickingTicketDto, 'id'> & {
    pickingTicketItems?: PickingTicketItemRequest[];
};
export type PickingTicketItemRequest = Omit<PickingTicketItemDto, 'id'>;
//#endregion


//#region Enum
export enum PickingPlanStatus {
    Draft = 1,
    Approved = 2,
    InProgress = 3,
    PartiallyPicked = 4,
    FullyPicked = 5,
    Cancelled = 6,
    Closed = 7
}

export enum PickingPlanItemStatus {
    Pending = 1,
    Picking = 2,
    PartiallyPicked = 3,
    FullyPicked = 4,
    Cancelled = 5
}

export enum PickingPlanSourceType {
    GoodsIssue = 1,
    TransferRequest = 2
}

export enum PickingTicketStatus {
    Draft = 1,
    Released = 2,
    InProgress = 3,
    PartiallyPicked = 4,
    Completed = 5,
    Cancelled = 6
}

export enum PickingTicketItemStatus {
    Pending = 1,
    Picking = 2,
    PartiallyPicked = 3,
    Picked = 4,
    Skipped = 5,
    Cancelled = 6
}

//#endregion
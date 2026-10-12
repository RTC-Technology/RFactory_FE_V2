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

    pickingPlanItemSources: PickingPlanItemSourceDto[];
    uId: number;
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

    pickingTicketItems: PickingTicketItemDto[];
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
    pickingPlanSources?: PickingPlanSourceRequest[];
    pickingPlanItems?: PickingPlanItemRequest[];
    pickingTickets?: PickingTicketRequest[];
};

export type PickingPlanItemRequest = Omit<PickingPlanItemDto, 'id'> & {
    pickingPlanItemSources?: PickingPlanItemSourceRequest[];
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

export const PICKING_PLAN_STATUSES = [
    { labelKey: 'pickingPlan.status.draft', value: 1, severity: 'info' as const },
    { labelKey: 'pickingPlan.status.approved', value: 2, severity: 'warning' as const },
    { labelKey: 'pickingPlan.status.inProgress', value: 3, severity: 'primary' as const },
    { labelKey: 'pickingPlan.status.partiallyPicked', value: 4, severity: 'secondary' as const },
    { labelKey: 'pickingPlan.status.fullyPicked', value: 5, severity: 'success' as const },
    { labelKey: 'pickingPlan.status.cancelled', value: 6, severity: 'danger' as const },
    { labelKey: 'pickingPlan.status.closed', value: 7, severity: 'help' as const },
];

export const PICKING_PLAN_SOURCE_TYPES = [
    {
        labelKey: 'pickingPlanSource.sourceType.purchase',
        value: 1,
    },
    {
        labelKey: 'pickingPlanSource.sourceType.production',
        value: 2,
    },
    {
        labelKey: 'pickingPlanSource.sourceType.return',
        value: 3,
    },
    {
        labelKey: 'pickingPlanSource.sourceType.transferIn',
        value: 4,
    },
    {
        labelKey: 'pickingPlanSource.sourceType.adjustment',
        value: 5,
    },
];

export const PICKING_PLAN_ITEM_STATUSES = [
    { labelKey: 'pickingPlanItem.status.pending', value: 1, severity: 'info' as const },
    { labelKey: 'pickingPlanItem.status.picking', value: 2, severity: 'warning' as const },
    { labelKey: 'pickingPlanItem.status.partiallyPicked', value: 3, severity: 'primary' as const },
    { labelKey: 'pickingPlanItem.status.fullyPicked', value: 4, severity: 'secondary' as const },
    { labelKey: 'pickingPlanItem.status.cancelled', value: 5, severity: 'success' as const },
];

export const PICKING_TICKET_STATUSES = [
    { labelKey: 'pickingTicket.status.draft', value: 1, severity: 'info' as const },
    { labelKey: 'pickingTicket.status.released', value: 2, severity: 'warning' as const },
    { labelKey: 'pickingTicket.status.inProgress', value: 3, severity: 'primary' as const },
    { labelKey: 'pickingTicket.status.partiallyPicked', value: 4, severity: 'secondary' as const },
    { labelKey: 'pickingTicket.status.completed', value: 5, severity: 'success' as const },
    { labelKey: 'pickingTicket.status.cancelled', value: 6, severity: 'danger' as const },
];

export const PICKING_TICKET_ITEM_STATUSES = [
    { labelKey: 'pickingTicketItem.status.pending', value: 1, severity: 'info' as const },
    { labelKey: 'pickingTicketItem.status.picking', value: 2, severity: 'warning' as const },
    { labelKey: 'pickingTicketItem.status.partiallyPicked', value: 3, severity: 'primary' as const },
    { labelKey: 'pickingTicketItem.status.picked', value: 4, severity: 'secondary' as const },
    { labelKey: 'pickingTicketItem.status.skipped', value: 5, severity: 'success' as const },
    { labelKey: 'pickingTicketItem.status.cancelled', value: 6, severity: 'danger' as const },
];



//#region Dto
export interface DeliveryNoteDto {
    id: number;
    deliveryNo: string;
    warehouseId?: number | null;
    status: number;
    vehicleNo?: string | null;
    vehicleType?: number | null;
    transportMethod?: number | null;
    driverName?: string | null;
    driverPhone?: string | null;
    weight?: number | null;
    volume?: number | null;
    startedAt?: string | null;
    completedAt?: string | null;
    pickerId?: number | null;
    remark?: string | null;

    deliveryNoteSender?: DeliveryNoteSenderDto | null;
    deliveryNoteReceiver?: DeliveryNoteReceiverDto | null;
    deliveryNoteSources?: DeliveryNoteSourceDto[] | null;
    deliveryNoteItems?: DeliveryNoteItemDto[] | null;
}

export interface DeliveryNoteItemDto {
    id: number;
    deliveryNoteId?: number | null;

    goodsIssueId?: number | null;
    goodsIssueDetailId?: number | null;

    productId: number;
    productCode?: string | null;
    productName?: string | null;

    unitId?: number | null;
    unitName?: string | null;

    orderedQty?: number | null;
    deliveredQty?: number | null;

    remark?: string | null;
}

export interface DeliveryNoteReceiverDto {
    id: number;
    deliveryNoteId?: number | null;

    receiverName?: string | null;
    contactName?: string | null;

    email1?: string | null;
    email2?: string | null;

    phone1?: string | null;
    phone2?: string | null;

    address1?: string | null;
    address2?: string | null;
}

export interface DeliveryNoteSenderDto {
    id: number;
    deliveryNoteId?: number | null;

    senderName?: string | null;

    email1?: string | null;
    email2?: string | null;

    phone1?: string | null;
    phone2?: string | null;

    address1?: string | null;
    address2?: string | null;
}

export interface DeliveryNoteSourceDto {
    id: number;
    deliveryNoteId?: number | null;

    goodsIssueId: number;
    goodsIssueNo?: string | null;
    issueDate?: string | null;
    status?: number | null;
}
//#endregion


//#region Request
export type DeliveryNoteRequest = Omit<DeliveryNoteDto, 'id'> & {
    deliveryNoteSources?: DeliveryNoteSourceRequest[];
    deliveryNoteItems?: DeliveryNoteItemRequest[];
    deliveryNoteSender?: DeliveryNoteSenderRequest;
    deliveryNoteReceiver?: DeliveryNoteReceiverRequest;
};

export type DeliveryNoteItemRequest = Omit<DeliveryNoteItemDto, 'id'>;
export type DeliveryNoteSourceRequest = Omit<DeliveryNoteSourceDto, 'id'>;
export type DeliveryNoteSenderRequest = DeliveryNoteSenderDto;
export type DeliveryNoteReceiverRequest = DeliveryNoteReceiverDto;
//#endregion

export const DELIVERY_NOTE_STATUSES = [
    { labelKey: 'deliveryNote.status.draft', value: 1 },
    { labelKey: 'deliveryNote.status.confirmed', value: 2 },
    { labelKey: 'deliveryNote.status.loading', value: 3 },
    { labelKey: 'deliveryNote.status.loaded', value: 4 },
    { labelKey: 'deliveryNote.status.inTransit', value: 5 },
    { labelKey: 'deliveryNote.status.delivered', value: 6 },
    { labelKey: 'deliveryNote.status.cancelled', value: 7 },
    { labelKey: 'deliveryNote.status.closed', value: 8 },
];

export const DELIVERY_NOTE_VEHICLE_TYPES = [
    { labelKey: 'deliveryNote.vehicleType.van', value: 1 },
    { labelKey: 'deliveryNote.vehicleType.truck', value: 2 },
    { labelKey: 'deliveryNote.vehicleType.tractor', value: 3 }
];

export const DELIVERY_NOTE_TRANSPORT_METHODS = [
    { labelKey: 'deliveryNote.transportMethod.truck', value: 1 },
    { labelKey: 'deliveryNote.transportMethod.plane', value: 2 },
    { labelKey: 'deliveryNote.transportMethod.train', value: 3 },
    { labelKey: 'deliveryNote.transportMethod.ship', value: 4 }
];




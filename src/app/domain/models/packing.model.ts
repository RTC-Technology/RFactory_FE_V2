//#region Dto

export interface PackingCheckDto {
    id: number;

    checkNo: string;
    warehouseId: number;
    pickingPlanId: number;

    status: number;

    startedAt?: string | null;
    completedAt?: string | null;
    checkedBy?: number | null;

    remark?: string | null;

    packingCheckItems?: PackingCheckItemDto[] | null;
    packingPackages: PackingPackageDto[];
}

export interface PackingCheckItemDto {
    id: number;
    packingCheckId?: number | null;

    productId: number;
    unitId: number;
    lotId?: number | null;
    serialNo: string;

    requiredQty?: number | null;
    pickedQty?: number | null;
    packedQty?: number | null;
    remainingQty?: number | null;
    discrepancyQty?: number | null;

    status: number;

    remark?: string | null;

    uId: number;
}

export interface PackingPackageDto {
    id: number;
    packingCheckId?: number | null;

    packageNo: string;
    packageType: number;
    barcode?: string | null;

    weight: number;
    length: number;
    width: number;
    height: number;
    volume: number;

    status: number;

    packedAt?: string | null;
    packedBy?: number | null;

    remark?: string | null;

    packingPackageItems: PackingPackageItemDto[];
}

export interface PackingPackageItemDto {
    id: number;
    packingPackageId?: number | null;
    packingCheckItemId?: number | null;

    productId: number;
    unitId: number;
    lotId?: number | null;
    serialNo: string;

    quantity: number;
    barcode: string;

    scannedAt?: string | null;
    scannedBy?: number | null;

    remark?: string | null;
}

export interface PackingScanLogDto {
    id: number;
    packingCheckId?: number | null;
    packingCheckItemId?: number | null;
    packingPackageId?: number | null;

    productId?: number | null;
    lotId?: number | null;
    serialNo?: string | null;
    barcode?: string | null;

    quantity?: number | null;

    scanType: number;
    result: number;

    errorCode?: string | null;
    errorMessage?: string | null;

    scannedAt: string;
    scannedBy?: number | null;
}

//#endregion


//#region Request

export type PackingCheckRequest = Omit<PackingCheckDto, 'id'> & {
    packingCheckItems?: PackingCheckItemRequest[];
    packingPackages?: PackingPackageRequest[];
};
export type PackingCheckItemRequest = Omit<PackingCheckItemDto, 'id'>;
export type PackingPackageRequest = Omit<PackingPackageDto, 'id'> & {
    packingPackageItems?: PackingPackageItemRequest[];
};
export type PackingPackageItemRequest = Omit<PackingPackageItemDto, 'id'>;
export type PackingScanLogRequest = Omit<PackingScanLogDto, 'id'>;

//#endregion


//#region Status

export const PACKING_CHECK_STATUSES = [
    { labelKey: 'packingCheck.status.draft', value: 1 },
    { labelKey: 'packingCheck.status.checking', value: 2 },
    { labelKey: 'packingCheck.status.discrepancy', value: 3 },
    { labelKey: 'packingCheck.status.completed', value: 4 },
    { labelKey: 'packingCheck.status.cancelled', value: 5 },
    { labelKey: 'packingCheck.status.closed', value: 6 },
];

export const PACKING_CHECK_ITEM_STATUSES = [
    { labelKey: 'packingCheckItem.status.pending', value: 1 },
    { labelKey: 'packingCheckItem.status.checking', value: 2 },
    { labelKey: 'packingCheckItem.status.short', value: 3 },
    { labelKey: 'packingCheckItem.status.excess', value: 4 },
    { labelKey: 'packingCheckItem.status.matched', value: 5 },
    { labelKey: 'packingCheckItem.status.wrongProduct', value: 6 },
    { labelKey: 'packingCheckItem.status.completed', value: 7 },
];

export const PACKING_PACKAGE_TYPES = [
    { labelKey: 'packingPackage.type.carton', value: 1 },
    { labelKey: 'packingPackage.type.pallet', value: 2 },
    { labelKey: 'packingPackage.type.bag', value: 3 },
    { labelKey: 'packingPackage.type.crate', value: 4 },
    { labelKey: 'packingPackage.type.other', value: 5 },
];

export const PACKING_PACKAGE_STATUSES = [
    { labelKey: 'packingPackage.status.open', value: 1 },
    { labelKey: 'packingPackage.status.packing', value: 2 },
    { labelKey: 'packingPackage.status.packed', value: 3 },
    { labelKey: 'packingPackage.status.closed', value: 4 },
    { labelKey: 'packingPackage.status.cancelled', value: 5 },
];

export const PACKING_SCAN_LOG_TYPES = [
    { labelKey: 'packingScanLog.type.scan', value: 1 },
    { labelKey: 'packingScanLog.type.manual', value: 2 },
    { labelKey: 'packingScanLog.type.remove', value: 3 },
    { labelKey: 'packingScanLog.type.adjust', value: 4 },
];

export const PACKING_SCAN_LOG_RESULTS = [
    { labelKey: 'packingScanLog.result.success', value: 1 },
    { labelKey: 'packingScanLog.result.wrongProduct', value: 2 },
    { labelKey: 'packingScanLog.result.excess', value: 3 },
    { labelKey: 'packingScanLog.result.duplicate', value: 4 },
    { labelKey: 'packingScanLog.result.invalidBarcode', value: 5 },
    { labelKey: 'packingScanLog.result.wrongLot', value: 6 },
    { labelKey: 'packingScanLog.result.wrongSerial', value: 7 },
    { labelKey: 'packingScanLog.result.notInOrder', value: 8 },
];

//#endregion
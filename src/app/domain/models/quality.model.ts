
//#region Dto

export interface QualitySpecificationDto {
    id: number;
    specificationCode: string;
    specificationName: string;
    version: string;
    inspectionType: number;
    status: number;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    remark?: string | null;
}

export interface QualitySpecificationItemDto {
    id: number;
    qualitySpecificationId?: number | null;
    sequenceNo: number;
    parameterCode: string;
    parameterName: string;
    unitId?: number | null;
    targetValue?: string | null;
    minValue?: number | null;
    maxValue?: number | null;
    isRequired?: boolean | null;
    remark?: string | null;
}

export interface QualitySpecificationProductDto {
    id: number;
    qualitySpecificationId?: number | null;
    productId?: number | null;
}

//#endregion

//#region Request
export type QualitySpecificationRequest = Omit<QualitySpecificationDto, 'id'> & {
    qualitySpecificationItems?: QualitySpecificationItemRequest[] | null;
    qualitySpecificationProducts?: QualitySpecificationProductRequest[] | null;
};
export type QualitySpecificationItemRequest = Omit<QualitySpecificationItemDto, 'id'>;
export type QualitySpecificationProductRequest = Omit<QualitySpecificationProductDto, 'id'>;
//#endregion

//#region Enum
export const QUALITY_INSPECTION_TYPES = [
    { labelKey: 'qualitySpecification.inspectionType.iqc', value: 1 },
    { labelKey: 'qualitySpecification.inspectionType.ipqc', value: 2 },
    { labelKey: 'qualitySpecification.inspectionType.oqc', value: 3 },
    { labelKey: 'qualitySpecification.inspectionType.fqc', value: 4 },
];

export const QUALITY_STATUSES = [
    { labelKey: 'qualitySpecification.status.draft', value: 1 },
    { labelKey: 'qualitySpecification.status.pendingApproval', value: 2 },
    { labelKey: 'qualitySpecification.status.approval', value: 3 },
    { labelKey: 'qualitySpecification.status.active', value: 4 },
    { labelKey: 'qualitySpecification.status.inactive', value: 5 },
    { labelKey: 'qualitySpecification.status.expired', value: 6 },
    { labelKey: 'qualitySpecification.status.cancelled', value: 7 },
];
//#endregion



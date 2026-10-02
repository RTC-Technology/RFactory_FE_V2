
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

export interface InspectionPlanDto {
    id: number;
    planCode: string;
    planName: string;
    productId: number;
    routingId: number;
    qualitySpecificationId: number
    inspectionType: number;
    version: string;
    status: number;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    approvedBy?: number | null;
    approvedAt?: string | null;
    remark?: string | null;
}

export interface InspectionItemDto {
    id: number;
    inspectionPlanId?: number | null;
    qualitySpecificationItemId: number;
    sequenceNo: number;
    inspectionMethod: string;
    sampleSize?: number | null;
    frequency: string;
    isRequired: boolean;
    remark?: string | null;
}

export interface InspectionExecutionDto {
    id: number;
    executionNo: string;
    inspectionPlanId: number;
    productId: number;
    lotNo?: string | null;
    serialNo?: string | null;
    productionOrderId?: number | null;
    inspectionType: number;
    status: number;
    sampleSize?: number | null;
    startedAt?: string | null;
    completedAt?: string | null;
    inspectorId?: number | null;
    remark?: string | null;
}

export interface InspectionResultDto {
    id: number;
    inspectionExecutionId?: number | null;
    inspectionItemId: number;
    sampleNo?: number | null;
    actualValue: string;
    numericValue?: number | null;
    textValue?: string | null;
    booleanValue?: boolean | null;
    result: number;
    inspectionTime?: string | null;
    inspectorId?: number | null;
    remark?: string | null;
}

//#endregion

//#region Request
export type QualitySpecificationRequest = Omit<QualitySpecificationDto, 'id'> & {
    qualitySpecificationItems?: QualitySpecificationItemRequest[] | null;
    qualitySpecificationProducts?: QualitySpecificationProductRequest[] | null;
};
export type QualitySpecificationItemRequest = Omit<QualitySpecificationItemDto, 'id'>;
export type QualitySpecificationProductRequest = Omit<QualitySpecificationProductDto, 'id'>;


export type InspectionPlanRequest = Omit<InspectionPlanDto, 'id'> & {
    inspectionItems?: InspectionItemRequest[] | null;
};
export type InspectionItemRequest = Omit<InspectionItemDto, 'id'>;
export type InspectionExecutionRequest = Omit<InspectionExecutionDto, 'id'> & {
    inspectionResults?: InspectionResultRequest[] | null;
};
export type InspectionResultRequest = Omit<InspectionResultDto, 'id'>;


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

export const INSPECTION_PLAN_TYPES = [
    { labelKey: 'inspectionPlan.type.iqc', value: 1 },
    { labelKey: 'inspectionPlan.type.ipqc', value: 2 },
    { labelKey: 'inspectionPlan.type.oqc', value: 3 },
    { labelKey: 'inspectionPlan.type.fqc', value: 4 },
];

export const INSPECTION_PLAN_STATUSES = [
    { labelKey: 'inspectionPlan.status.draft', value: 1 },
    { labelKey: 'inspectionPlan.status.pendingApproval', value: 2 },
    { labelKey: 'inspectionPlan.status.approval', value: 3 },
    { labelKey: 'inspectionPlan.status.active', value: 4 },
    { labelKey: 'inspectionPlan.status.inactive', value: 5 },
    { labelKey: 'inspectionPlan.status.expired', value: 6 },
    { labelKey: 'inspectionPlan.status.cancelled', value: 7 },
];

export const INSPECTION_EXECUTION_TYPE = [
    { labelKey: 'inspectionExecution.type.iqc', value: 1 },
    { labelKey: 'inspectionExecution.type.ipqc', value: 2 },
    { labelKey: 'inspectionExecution.type.oqc', value: 3 },
    { labelKey: 'inspectionExecution.type.fqc', value: 4 },
];

export const INSPECTION_EXECUTION_STATUSES = [
    { labelKey: 'inspectionExecution.status.pending', value: 1 },
    { labelKey: 'inspectionExecution.status.inProgress', value: 2 },
    { labelKey: 'inspectionExecution.status.passed', value: 3 },
    { labelKey: 'inspectionExecution.status.failed', value: 4 },
    { labelKey: 'inspectionExecution.status.partiallyPassed', value: 5 },
    { labelKey: 'inspectionExecution.status.cancelled', value: 6 },
];

export const INSPECTION_RESULTS = [
    { labelKey: 'inspectionResults.result.pending', value: 1, severity: 'info' as const },
    { labelKey: 'inspectionResults.result.pass', value: 2, severity: 'success' as const },
    { labelKey: 'inspectionResults.result.fail', value: 3, severity: 'danger' as const },
    { labelKey: 'inspectionResults.result.na', value: 4, severity: 'secondary' as const },
];

export function inspectionResultOf(status?: number | null) {
    return INSPECTION_RESULTS.find(s => s.value === status);
}

//#endregion



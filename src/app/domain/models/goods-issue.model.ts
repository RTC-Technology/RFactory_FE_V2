export interface GoodsIssueDto {
    id: number;
    issueNo: string;
    issueType: number;
    warehouseId: number;
    referenceType?: string | null;
    referenceId?: number | null;
    issueDate: string;
    status?: number | null;
    remark?: string | null;
    approvedBy?: number | null;
    approvedDate?: string | null;
    postedBy?: number | null;
    postedDate?: string | null;
}

export enum GoodsReceiptStatus {
    Purchase = 1,
    Production = 2,
    Return = 3,
    TransferIn = 4,
    Adjustment = 5,
}

export interface GoodsIssueDetailDto {
    id: number;
    goodsIssueId: number;
    productId: number;
    unitId: number;
    locationId: number;
    lotNo?: string | null;
    serialNo?: string | null;
    quantity?: number | null;
    unitPrice?: number | null;
    remark?: string | null;
}

export type GoodsIssueRequest = Omit<GoodsIssueDto, 'id'> & {
    /**
     * Toàn bộ danh sách dòng, thay thế những gì phiếu đang có: dòng vắng mặt sẽ bị xoá.
     * Bỏ trống (undefined) nếu chỉ sửa phần đầu phiếu — mảng rỗng nghĩa là "phiếu này
     * không còn dòng nào".
     */
    goodsIssueDetails?: GoodsIssueDetailRequest[];
};

export type GoodsIssueDetailRequest = Omit<GoodsIssueDetailDto, 'id'>;


export const GOODS_ISSUE_STATUSES = [
    {
        labelKey: 'goodsIssue.status.purchase',
        value: 1,
    },
    {
        labelKey: 'goodsIssue.status.production',
        value: 2,
    },
    {
        labelKey: 'goodsIssue.status.return',
        value: 3,
    },
    {
        labelKey: 'goodsIssue.status.transferIn',
        value: 4,
    },
    {
        labelKey: 'goodsIssue.status.adjustment',
        value: 5,
    },
];
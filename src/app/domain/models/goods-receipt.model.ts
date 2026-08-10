export interface GoodsReceiptDto {
       id: number;
       receiptNo: string;
       warehouseId: number;
       supplierId?: number | null;
       referenceType?: string | null;
       referenceId?: number | null;
       receiptDate: string;
       remark?: string | null;
       approvedBy?: number | null;
       approvedDate?: string | null;
       postedBy?: number | null;
       postedDate?: string | null;
       receiptType: number;
}


export enum GoodsReceiptStatus {
       Purchase = 1,
       Production = 2,
       Return = 3,
       TransferIn = 4,
       Adjustment = 5,
}

export interface GoodsReceiptDetailDto {
       id: number;
       goodsReceiptId: number;
       productId: number;
       unitId: number;
       locationId?: number | null;
       lotNo?: string | null;
       serialNo?: string | null;
       quantity: number;
       receivedQty: number;
       unitPrice?: number | null;
       remark?: string | null;
}


export type GoodsReceiptRequest = Omit<GoodsReceiptDto, 'id'>;
export type GoodsReceiptDetailRequest = Omit<GoodsReceiptDetailDto, 'id'>;
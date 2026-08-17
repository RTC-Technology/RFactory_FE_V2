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
       receiptDate: string | null;
       expireDate: string;
}


/**
 * Một dòng gửi kèm phiếu nhập. `id` bằng 0 là dòng mới; giá trị khác phải là dòng đang
 * thuộc chính phiếu đó. Không có `goodsReceiptId` — phiếu chứa payload tự gán.
 */
export interface GoodsReceiptLineRequest {
       id: number;
       productId: number;
       unitId: number;
       locationId?: number | null;
       lotNo?: string | null;
       serialNo?: string | null;
       quantity: number;
       receivedQty: number;
       unitPrice?: number | null;
       remark?: string | null;
       expireDate: string;
}

export type GoodsReceiptRequest = Omit<GoodsReceiptDto, 'id'> & {
       /**
        * Toàn bộ danh sách dòng, thay thế những gì phiếu đang có: dòng vắng mặt sẽ bị xoá.
        * Bỏ trống (undefined) nếu chỉ sửa phần đầu phiếu — mảng rỗng nghĩa là "phiếu này
        * không còn dòng nào".
        */
       goodsReceiptDetails?: GoodsReceiptLineRequest[];
};

export type GoodsReceiptDetailRequest = Omit<GoodsReceiptDetailDto, 'id'>;


export const GOODS_RECEIPT_TYPES = [
       {
              labelKey: 'goodsReceipt.receiptType.purchase',
              value: 1,
       },
       {
              labelKey: 'goodsReceipt.receiptType.production',
              value: 2,
       },
       {
              labelKey: 'goodsReceipt.receiptType.return',
              value: 3,
       },
       {
              labelKey: 'goodsReceipt.receiptType.transferIn',
              value: 4,
       },
       {
              labelKey: 'goodsReceipt.receiptType.adjustment',
              value: 5,
       },
];

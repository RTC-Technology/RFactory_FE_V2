export interface QrCodeGenerateRequest {
  entityType: 'PRODUCT' | 'LOCATION' | 'MACHINE' | 'EMPLOYEE' | 'GOODS_RECEIPT' | 'INVENTORY' | 'CUSTOM';
  entityId?: number | null;
  code?: string | null;
  title?: string | null;
  subtitle?: string | null;
}

export interface QrCodeDto {
  payload: string;
  entityType: string;
  entityId?: number | null;
  code: string;
  labelTitle: string;
  labelSubtitle: string;
  generatedAt: string;
}

export interface QrScanRequest {
  payload: string;
}

export interface QrScanResultDto {
  found: boolean;
  entityType: string;
  entityId?: number | null;
  code: string;
  title: string;
  subtitle: string;
  status: string;
  location: string;
  attributes: Record<string, string>;
  actionRoute: string;
}

export interface QrItemLookupDto {
  id: number;
  entityType: string;
  code: string;
  name: string;
  description: string;
  payload: string;
}

export interface QrBatchPrintRequest {
  entityType: string;
  entityIds: number[];
}

export const QR_ENTITY_TYPES: Array<{ labelKey: string; value: string; icon: string }> = [
  { labelKey: 'qr.entity.product', value: 'PRODUCT', icon: 'box' },
  { labelKey: 'qr.entity.location', value: 'LOCATION', icon: 'map-pin' },
  { labelKey: 'qr.entity.machine', value: 'MACHINE', icon: 'cpu' },
  { labelKey: 'qr.entity.employee', value: 'EMPLOYEE', icon: 'user' },
  { labelKey: 'qr.entity.goodsReceipt', value: 'GOODS_RECEIPT', icon: 'file-text' },
  { labelKey: 'qr.entity.inventory', value: 'INVENTORY', icon: 'database' },
  { labelKey: 'qr.entity.custom', value: 'CUSTOM', icon: 'qr-code' },
];

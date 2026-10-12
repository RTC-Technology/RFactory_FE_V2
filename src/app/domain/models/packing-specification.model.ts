export interface PackingSpecificationDto {
  id: number;
  specCode: string;
  specName: string;
  productId?: number | null;
  productCode?: string | null;
  productName?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  packagingType: string;
  quantityPerPack: number;
  packUnitId?: number | null;
  packUnitName?: string | null;

  lengthMm: number;
  widthMm: number;
  heightMm: number;
  volumeM3: number;
  netWeightKg: number;
  grossWeightKg: number;
  tareWeightKg: number;

  innerPackQty?: number | null;
  masterCartonQty?: number | null;
  palletTi?: number | null;
  palletHi?: number | null;
  totalUnitsPerPallet?: number | null;

  labelTemplateId?: number | null;
  labelTemplateName?: string | null;
  barcode?: string | null;
  packagingMaterial?: string | null;
  instructions?: string | null;
  isDefault: boolean;
  status: 'ACTIVE' | 'DRAFT' | 'OBSOLETE';
  createdDate?: string;
}

export interface PackingSpecificationRequest {
  specCode: string;
  specName: string;
  productId?: number | null;
  customerCode?: string | null;
  customerName?: string | null;
  packagingType: string;
  quantityPerPack: number;
  packUnitId?: number | null;

  lengthMm: number;
  widthMm: number;
  heightMm: number;
  volumeM3: number;
  netWeightKg: number;
  grossWeightKg: number;
  tareWeightKg: number;

  innerPackQty?: number | null;
  masterCartonQty?: number | null;
  palletTi?: number | null;
  palletHi?: number | null;
  totalUnitsPerPallet?: number | null;

  labelTemplateId?: number | null;
  barcode?: string | null;
  packagingMaterial?: string | null;
  instructions?: string | null;
  isDefault: boolean;
  status: string;
}

export const PACKAGING_TYPES: Array<{ labelKey: string; value: string; icon: string }> = [
  { labelKey: 'packing.type.box', value: 'BOX', icon: 'pi-box' },
  { labelKey: 'packing.type.carton', value: 'CARTON', icon: 'pi-inbox' },
  { labelKey: 'packing.type.pallet', value: 'PALLET', icon: 'pi-database' },
  { labelKey: 'packing.type.crate', value: 'CRATE', icon: 'pi-table' },
  { labelKey: 'packing.type.bundle', value: 'BUNDLE', icon: 'pi-paperclip' },
];

export const PACKING_STATUSES: Array<{ label: string; value: string; severity: 'success' | 'warn' | 'secondary' }> = [
  { label: 'Active', value: 'ACTIVE', severity: 'success' },
  { label: 'Draft', value: 'DRAFT', severity: 'warn' },
  { label: 'Obsolete', value: 'OBSOLETE', severity: 'secondary' },
];

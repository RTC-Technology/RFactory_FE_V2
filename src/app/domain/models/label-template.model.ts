export interface LabelFieldConfig {
  fieldKey: string;
  label: string;
  fontSize: number;
  bold: boolean;
  visible: boolean;
}

export interface LabelTemplateDto {
  id: number;
  templateCode: string;
  templateName: string;
  entityType: 'PRODUCT' | 'MACHINE' | 'LOCATION' | 'EMPLOYEE';
  widthMm: number;
  heightMm: number;
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  isDefault: boolean;
  isActive: boolean;
  headerText?: string | null;
  footerText?: string | null;
  showQr: boolean;
  showBarcode: boolean;
  showLogo: boolean;
  showBorder: boolean;
  qrSizePx: number;
  fieldsConfigJson?: string | null;
  createdDate?: string;
}

export interface LabelTemplateRequest {
  templateCode: string;
  templateName: string;
  entityType: string;
  widthMm: number;
  heightMm: number;
  orientation: string;
  isDefault: boolean;
  isActive: boolean;
  headerText?: string | null;
  footerText?: string | null;
  showQr: boolean;
  showBarcode: boolean;
  showLogo: boolean;
  showBorder: boolean;
  qrSizePx: number;
  fieldsConfigJson?: string | null;
}

export const TEMPLATE_ENTITY_TYPES: Array<{ labelKey: string; value: string; icon: string }> = [
  { labelKey: 'template.entity.product', value: 'PRODUCT', icon: 'pi-box' },
  { labelKey: 'template.entity.machine', value: 'MACHINE', icon: 'pi-cog' },
  { labelKey: 'template.entity.location', value: 'LOCATION', icon: 'pi-map-pin' },
  { labelKey: 'template.entity.employee', value: 'EMPLOYEE', icon: 'pi-user' },
];

export const DEFAULT_FIELDS_BY_ENTITY: Record<string, LabelFieldConfig[]> = {
  PRODUCT: [
    { fieldKey: 'code', label: 'Product Code / SKU', fontSize: 13, bold: true, visible: true },
    { fieldKey: 'name', label: 'Product Name', fontSize: 14, bold: true, visible: true },
    { fieldKey: 'spec', label: 'Specification', fontSize: 11, bold: false, visible: true },
    { fieldKey: 'date', label: 'Mfg / Batch Date', fontSize: 10, bold: false, visible: true },
  ],
  MACHINE: [
    { fieldKey: 'code', label: 'Asset / Machine Code', fontSize: 14, bold: true, visible: true },
    { fieldKey: 'name', label: 'Machine Name', fontSize: 14, bold: true, visible: true },
    { fieldKey: 'model', label: 'Model / Serial #', fontSize: 11, bold: false, visible: true },
    { fieldKey: 'line', label: 'Assigned Line', fontSize: 11, bold: false, visible: true },
  ],
  LOCATION: [
    { fieldKey: 'code', label: 'Location Code', fontSize: 16, bold: true, visible: true },
    { fieldKey: 'name', label: 'Location Name', fontSize: 14, bold: true, visible: true },
    { fieldKey: 'zone', label: 'Warehouse Zone', fontSize: 12, bold: false, visible: true },
    { fieldKey: 'capacity', label: 'Max Capacity', fontSize: 11, bold: false, visible: true },
  ],
  EMPLOYEE: [
    { fieldKey: 'code', label: 'Employee ID', fontSize: 12, bold: true, visible: true },
    { fieldKey: 'name', label: 'Full Name', fontSize: 15, bold: true, visible: true },
    { fieldKey: 'position', label: 'Position / Role', fontSize: 12, bold: false, visible: true },
    { fieldKey: 'department', label: 'Department / Team', fontSize: 11, bold: false, visible: true },
  ],
};

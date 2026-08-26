/** Mirrors the Product module DTOs plus UnitDto from MasterData. */

export interface ProductTypeDto {
  id: number;
  productTypeCode: string;
  productTypeName: string;
  description?: string | null;
  sortOrder?: number | null;
  isActive: boolean;
}

export interface ProductGroupDto {
  id: number;
  groupNo: string;
  groupName: string;
  parentId: number;
}

export interface ProductDto {
  id: number;
  productCode: string;
  productName: string;
  productTypeId?: number | null;
  defaultUnitId?: number | null;
  drawingNo?: string | null;
  drawingPath?: string | null;
  status?: number | null;
}

export interface BomDto {
  id: number;
  /** The product this BOM produces. */
  productId?: number | null;
  bomCode: string;
  bomName: string;
  version?: string | null;
  status?: number | null;
  isActive: boolean;
}

export interface BomDetailDto {
  id: number;
  bomId?: number | null;
  /** The component consumed, not the product the BOM produces. */
  productId?: number | null;
  quantity?: number | null;
  unitId?: number | null;
  /** Proportional loss, percent of quantity. */
  scrapRate?: number | null;
  /** Loss that does not scale with quantity. */
  fixedScrapQty?: number | null;
}

export interface UnitDto {
  id: number;
  unitCategoryId?: number | null;
  unitCode: string;
  unitName: string;
  symbol?: string | null;
  decimalPlaces?: number | null;
  isBaseUnit: boolean;
  isActive: boolean;
}

export interface UnitCategoryDto {
  id: number;
  unitCategoryCode: string;
  unitCategoryName: string;
  description?: string | null;
  isActive: boolean;
}

/**
 * A conversion between two units. The schema carries both a multiplier and a divisor, so
 * the pair reads as a ratio: one `fromUnit` equals `multiplyValue / divideValue` of
 * `toUnit`. `formulaType` is a bare int with no enum behind it — see FORMULA_TYPES.
 */
export interface UnitConversionDto {
  id: number;
  fromUnitId?: number | null;
  toUnitId?: number | null;
  multiplyValue?: number | null;
  divideValue?: number | null;
  formulaType: number;
  isActive: boolean;
}

export type UnitCategoryRequest = Omit<UnitCategoryDto, 'id'>;
export type UnitConversionRequest = Omit<UnitConversionDto, 'id'>;

/**
 * `UnitConversion.FormulaType` is an int with no enum or lookup table. These labels are
 * an assumption, same situation as the various `Status` columns — change the pairs here
 * if the real coding differs.
 */
export const FORMULA_TYPES = [
  { labelKey: 'unit.formula.ratio', value: 1 },
  { labelKey: 'unit.formula.inverse', value: 2 },
];

/** How much of `toUnit` one `fromUnit` is worth, or null when the ratio is unusable. */
export function conversionFactor(row: UnitConversionDto): number | null {
  const multiply = row.multiplyValue ?? 1;
  const divide = row.divideValue ?? 1;
  if (!divide) return null;
  const factor = multiply / divide;
  // formulaType 2 is read as the reciprocal, so one row can express either direction.
  return row.formulaType === 2 ? (factor ? 1 / factor : null) : factor;
}

export type ProductTypeRequest = Omit<ProductTypeDto, 'id'>;
export type ProductGroupRequest = Omit<ProductGroupDto, 'id'>;
export type ProductRequest = Omit<ProductDto, 'id'>;
export type BomRequest = Omit<BomDto, 'id'>;
export type BomDetailRequest = Omit<BomDetailDto, 'id'>;
export type UnitRequest = Omit<UnitDto, 'id'>;

/**
 * `Product.Status` and `Bom.Status` are nullable ints with no enum or lookup table behind
 * them, the same situation as Line.Status and Machine.Status. These labels are an
 * assumption — change the pairs here if the real coding differs.
 */
export const PRODUCT_STATUSES = [
  { labelKey: 'product.status.inUse', value: 1, severity: 'success' as const },
  { labelKey: 'product.status.stopped', value: 0, severity: 'danger' as const },
];

export function productStatusOf(status?: number | null) {
  return PRODUCT_STATUSES.find(s => s.value === status);
}

/**
 * How much of a component one build actually consumes: the nominal quantity, grown by the
 * proportional scrap rate, plus whatever is lost regardless of batch size.
 */
export function requiredQuantity(line: BomDetailDto): number | null {
  const quantity = line.quantity;
  if (quantity == null) return null;
  const scaled = quantity * (1 + (line.scrapRate ?? 0) / 100);
  return scaled + (line.fixedScrapQty ?? 0);
}

export interface RoutingDto {
  id: number;
  /** The product this routing (process specification) describes. */
  productId?: number | null;
  version?: string | null;
  isActive: boolean;
}

export type RoutingRequest = Omit<RoutingDto, 'id'>;

export interface RoutingOperationDto {
  id: number;
  /** The routing the work step belongs to. */
  routingId?: number | null;
  sequence?: number | null;
  routingOperationCode: string;
  routingOperationName: string;
  description?: string | null;
  isFinishOperation: boolean;
  isOutputOperation: boolean;
}

export type RoutingOperationRequest = Omit<RoutingOperationDto, 'id'>;


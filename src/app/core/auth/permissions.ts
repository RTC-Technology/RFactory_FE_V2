/**
 * Every permission code this application checks, as `<entity>.<action>`.
 *
 * The four actions line up with the API verbs — `view` for GET, `add` for POST, `edit`
 * for PUT, `delete` for DELETE — so a screen's needs read straight off what it calls.
 *
 * Route guards check `view` only. A user who can open a screen but holds no write codes
 * still sees the data; the API refuses the writes, and the toolbar can hide them via
 * `*appHasPermission`.
 *
 * Mirrors `PermissionCodes` on the backend (RFactory.Shared/Constants). The catalogue is
 * seeded into the Function table by the "sync catalogue" action on the permission screen —
 * a code that exists here but not there can never be granted, so the feature stays
 * admin-only with nothing to point at.
 */
export const PERMISSIONS = {
  factory: crud('factory'),
  area: crud('area'),
  line: crud('line'),
  unitCategory: crud('unit-category'),
  unit: crud('unit'),
  unitConversion: crud('unit-conversion'),
  productType: crud('product-type'),
  product: crud('product'),
  bom: crud('bom'),
  bomDetail: crud('bom-detail'),
  shift: crud('shift'),
  shiftBreak: crud('shift-break'),
  machineType: crud('machine-type'),
  machine: crud('machine'),
  organization: crud('organization'),
  user: crud('user'),
  userGroup: crud('user-group'),
  functionGroup: crud('function-group'),
  function: crud('function'),
  menu: crud('menu'),
  warehouse: crud('warehouse'),
  warehouseZone: crud('warehouse-zone'),
  warehouseLocation: crud('warehouse-location'),
  goodsReceipt: crud('goods-receipt'),
  goodsReceiptDetail: crud('goods-receipt-detail'),
  settings: {
    view: 'settings.view',
    edit: 'settings.edit',
  },
} as const;

/**
 * Splits `<entity>.<action>` so a code can be shown as a name instead of raw text.
 *
 * Split on the *last* dot: entities carry hyphens (`goods-receipt-detail`) but never dots,
 * so anything before it is the entity. Returns null for a string that is not a code at all,
 * which the caller renders verbatim rather than guessing at.
 */
export function splitPermissionCode(code: string): { entity: string; action: string } | null {
  const at = code.lastIndexOf('.');
  if (at <= 0 || at === code.length - 1) return null;
  return { entity: code.slice(0, at), action: code.slice(at + 1) };
}

function crud<T extends string>(entity: T) {
  return {
    view: `${entity}.view`,
    add: `${entity}.add`,
    edit: `${entity}.edit`,
    delete: `${entity}.delete`,
    approve: `${entity}.approve`,
    unapprove: `${entity}.unapprove`,
  } as const;
}

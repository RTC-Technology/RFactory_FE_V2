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
  factory:       crud('factory'),
  area:          crud('area'),
  line:          crud('line'),
  unitCategory:   crud('unit-category'),
  unit:           crud('unit'),
  unitConversion: crud('unit-conversion'),
  productType:   crud('product-type'),
  product:       crud('product'),
  bom:           crud('bom'),
  bomDetail:     crud('bom-detail'),
  shift:         crud('shift'),
  shiftBreak:    crud('shift-break'),
  machineType:   crud('machine-type'),
  machine:       crud('machine'),
  organization:  crud('organization'),
  user:          crud('user'),
  userGroup:     crud('user-group'),
  functionGroup: crud('function-group'),
  function:      crud('function'),
  menu:          crud('menu'),
  warehouse:         crud('warehouse'),
  warehouseZone:     crud('warehouse-zone'),
  warehouseLocation: crud('warehouse-location'),
  settings: {
    view: 'settings.view',
    edit: 'settings.edit',
  },
} as const;

function crud<T extends string>(entity: T) {
  return {
    view: `${entity}.view`,
    add: `${entity}.add`,
    edit: `${entity}.edit`,
    delete: `${entity}.delete`,
  } as const;
}

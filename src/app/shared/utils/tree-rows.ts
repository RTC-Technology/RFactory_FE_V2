import { Signal, computed, signal } from '@angular/core';

/** Any self-referencing master-data row: function groups, organizations, … */
export interface HierarchyNode {
  id: number;
  parentId?: number | null;
}

export type DepthRow<T> = T & { depth: number };

/**
 * Orders a flat, self-referencing list depth-first and tags each row with its depth,
 * so a plain table can render the hierarchy by indenting.
 *
 * Rows whose parent is missing are treated as roots. Rows caught in a parent cycle
 * (A→B→A) are unreachable from the root and would otherwise be dropped silently, so
 * they are appended at depth 0 — the declaration screen is the only place anyone can
 * spot and repair them.
 */
export function flattenTree<T extends HierarchyNode>(
  items: T[],
  compare: (a: T, b: T) => number,
): DepthRow<T>[] {
  const ids = new Set(items.map(item => item.id));
  const byParent = new Map<number | null, T[]>();

  for (const item of items) {
    const parent = item.parentId != null && ids.has(item.parentId) ? item.parentId : null;
    const bucket = byParent.get(parent);
    bucket ? bucket.push(item) : byParent.set(parent, [item]);
  }

  const rows: DepthRow<T>[] = [];
  const walk = (parentId: number | null, depth: number) => {
    for (const child of (byParent.get(parentId) ?? []).sort(compare)) {
      rows.push({ ...child, depth });
      walk(child.id, depth + 1);
    }
  };
  walk(null, 0);

  const emitted = new Set(rows.map(row => row.id));
  for (const item of items) {
    if (!emitted.has(item.id)) rows.push({ ...item, depth: 0 });
  }
  return rows;
}

/**
 * Expand/collapse state over a `flattenTree` result.
 *
 * Owns only the visibility question; what to do about a selection that a collapse just
 * hid is the screen's call, so `toggle` reports which rows it swallowed rather than
 * reaching into the caller's state.
 */
export class CollapsibleTree<T extends HierarchyNode> {
  private readonly _collapsed = signal<ReadonlySet<number>>(new Set());

  /**
   * @param rows       depth-ordered rows, straight from `flattenTree`
   * @param searchTerm the table's active filter text; while it is non-empty collapse
   *                   state stands down, otherwise a match inside a closed branch
   *                   could never be reached
   */
  constructor(
    private readonly rows: Signal<DepthRow<T>[]>,
    private readonly searchTerm: Signal<string>,
  ) {}

  /** Ids some row points at — i.e. exactly the rows that can be collapsed. */
  readonly parentIds = computed(() =>
    new Set(this.rows().map(row => row.parentId).filter((id): id is number => id != null)));

  readonly visibleRows = computed(() => {
    const rows = this.rows();
    if (this.searchTerm().trim()) return rows;

    const collapsed = this._collapsed();
    if (!collapsed.size) return rows;

    const byId = new Map(rows.map(row => [row.id, row]));
    const isHidden = (row: DepthRow<T>): boolean => {
      let parentId = row.parentId ?? null;
      while (parentId != null) {
        if (collapsed.has(parentId)) return true;
        parentId = byId.get(parentId)?.parentId ?? null;
      }
      return false;
    };
    return rows.filter(row => !isHidden(row));
  });

  readonly allCollapsed = computed(() => {
    const parents = this.parentIds();
    return parents.size > 0 && [...parents].every(id => this._collapsed().has(id));
  });

  hasChildren(id: number): boolean {
    return this.parentIds().has(id);
  }

  isCollapsed(id: number): boolean {
    return this._collapsed().has(id);
  }

  /** Flips one branch. Returns the ids that just went out of view, empty when expanding. */
  toggle(id: number): ReadonlySet<number> {
    const next = new Set(this._collapsed());
    if (next.has(id)) {
      next.delete(id);
      this._collapsed.set(next);
      return new Set();
    }

    next.add(id);
    this._collapsed.set(next);
    return this.descendantIds(id);
  }

  toggleAll(): void {
    this._collapsed.set(this.allCollapsed() ? new Set() : new Set(this.parentIds()));
  }

  /** `id` plus everything beneath it — the set that can never become its own parent. */
  descendantIds(id: number): ReadonlySet<number> {
    const ids = new Set<number>([id]);
    let grew = true;
    // The list is flat and small, so sweeping it until nothing new turns up beats
    // building an index for a handful of rows.
    while (grew) {
      grew = false;
      for (const row of this.rows()) {
        if (row.parentId != null && ids.has(row.parentId) && !ids.has(row.id)) {
          ids.add(row.id);
          grew = true;
        }
      }
    }
    return ids;
  }
}

import {
  RouteReuseStrategy,
  ActivatedRouteSnapshot,
  DetachedRouteHandle,
} from '@angular/router';

/**
 * TabReuseStrategy – lưu trữ component state của mỗi route vào cache.
 * Khi user chuyển tab → component cũ được detach (không destroy).
 * Khi quay lại tab → component được attach lại từ cache (giữ nguyên state).
 * Khi tab bị đóng → xóa cache của route đó.
 */
export class TabReuseStrategy implements RouteReuseStrategy {
  /** Cache: key = route path, value = detached component handle */
  private readonly _cache = new Map<string, DetachedRouteHandle>();

  // ─── Angular Router hooks ────────────────────────────────────────────────

  /**
   * Có nên detach (lưu cache) route hiện tại không?
   * → Có nếu route có component (là leaf route, không phải layout)
   */
  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return !!route.component;
  }

  /**
   * Lưu detached handle vào cache.
   * Nếu handle = null (route bị destroy hoàn toàn) → xóa khỏi cache.
   */
  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = this._getKey(route);
    if (handle) {
      this._cache.set(key, handle);
    } else {
      this._cache.delete(key);
    }
  }

  /**
   * Có nên attach từ cache không?
   * → Có nếu cache đã có route này.
   */
  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    return this._cache.has(this._getKey(route));
  }

  /**
   * Lấy handle từ cache để reattach.
   */
  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    return this._cache.get(this._getKey(route)) ?? null;
  }

  /**
   * Có nên reuse route đang active không (cùng routeConfig = không reload)?
   * → Có nếu cùng routeConfig (standard behavior).
   */
  shouldReuseRoute(
    future: ActivatedRouteSnapshot,
    curr: ActivatedRouteSnapshot
  ): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  // ─── Public API (dùng bởi TabService) ────────────────────────────────────

  /**
   * Xóa cache của một route cụ thể.
   * Gọi khi tab bị đóng → lần mở lại tab đó sẽ khởi tạo component mới.
   */
  clearRoute(route: string): void {
    const key = this._normalizeRoute(route);
    this._cache.delete(key);
  }

  /** Xóa toàn bộ cache (reset). */
  clearAll(): void {
    this._cache.clear();
  }

  /** Số lượng route đang được cache. */
  get cacheSize(): number {
    return this._cache.size;
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  private _getKey(route: ActivatedRouteSnapshot): string {
    // Tạo key từ full path (vd: "dashboard", "users", "settings")
    const segments = route.pathFromRoot
      .filter(r => r.url.length > 0)
      .map(r => r.url.map(seg => seg.path).join('/'));
    return segments.join('/');
  }

  private _normalizeRoute(route: string): string {
    // Bỏ leading slash: "/dashboard" → "dashboard"
    return route.replace(/^\/+/, '');
  }
}

import { Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouteReuseStrategy } from '@angular/router';
import { BehaviorSubject, filter, map } from 'rxjs';
import { Tab } from '../../domain/models/tab.model';
import { MenuService } from './menu.service';
import { TabReuseStrategy } from '../strategies/tab-reuse.strategy';

const FALLBACK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;

@Injectable({ providedIn: 'root' })
export class TabService {
  private readonly _tabs = new BehaviorSubject<Tab[]>([]);
  readonly tabs$ = this._tabs.asObservable();
  readonly activeTabId = signal<string>('');

  /** True nếu còn ít nhất 1 tab mở — dùng để layout ẩn/hiện router-outlet. */
  readonly hasTabs = toSignal(this.tabs$.pipe(map(tabs => tabs.length > 0)), { initialValue: true });

  constructor(
    private readonly router: Router,
    private readonly reuseStrategy: RouteReuseStrategy,
    private readonly menuService: MenuService,
  ) {
    // No seeded Dashboard tab: the session opens on whatever the URL points at, so a
    // deep link lands on exactly one tab. Hitting "/" still yields Dashboard, because
    // the router redirects there and the sync below picks it up.

    // A deep link, a browser back/forward, or a redirect changes the route without
    // going through the tab strip. The strip therefore follows the router, not the
    // other way round — otherwise Dashboard stays highlighted while an entirely
    // different component renders in the outlet.
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this._syncWithUrl(e.urlAfterRedirects));

    // This service is first injected by the shell, which the router only instantiates
    // *after* the initial navigation has completed — that NavigationEnd is already
    // gone by the time the subscription above exists. Seed from the settled URL.
    this._syncWithUrl(this.router.url);
  }

  /**
   * True khi URL vừa điều hướng tới nằm *trong* shell — tức là có thanh tab để đồng bộ.
   *
   * ShellComponent gắn ở route rỗng cấp cao nhất, /login là anh em bên cạnh nó và render
   * toàn màn hình, không có thanh tab nào. Service này là singleton nên nó vẫn sống sót
   * khi shell bị destroy: một lần đăng xuất (hoặc phiên hết hạn đá về /login) vẫn bắn ra
   * NavigationEnd, và nếu không lọc thì "Login" được thêm vào strip như một tab bình
   * thường — đúng cái tab thừa xuất hiện cạnh Dashboard sau khi đăng nhập lại.
   *
   * Kiểm theo cấu trúc chứ không hard-code '/login': thêm route công khai nào nữa
   * (quên mật khẩu, đăng ký…) thì nó tự đứng ngoài mà không phải nhớ sửa ở đây.
   */
  private _isInsideShell(): boolean {
    return this.router.routerState.snapshot.root.firstChild?.routeConfig?.path === '';
  }

  /**
   * Focuses the tab owning `url`, opening one when nothing matches.
   *
   * Deliberately does not navigate: it runs *because* a navigation just finished.
   */
  private _syncWithUrl(url: string): void {
    if (!this._isInsideShell()) return;

    const route = url.split(/[?#]/, 1)[0];

    const existing = this.tabs.find(t => t.route === route);
    if (existing) {
      this.activeTabId.set(existing.id);
      return;
    }

    const item = this.menuService.findByRoute(route);
    const tab: Tab = {
      // No menu entry yet on a cold deep link — the menu request is still in flight.
      // Keying off the route keeps the id stable once applyMenuLabels() fills the
      // label in, and openTab() dedupes by route anyway.
      id: item?.id ?? route,
      title: item?.label ?? this._titleFromRoute(route),
      route,
      icon: item?.icon ?? FALLBACK_ICON,
      closeable: true,
    };

    this._tabs.next([...this.tabs, tab]);
    this.activeTabId.set(tab.id);
  }

  /**
   * Re-labels tabs that were opened before the menu arrived. On a cold deep link the
   * tab is created from the URL alone, so it starts with a guessed title and the
   * generic icon; ShellComponent calls this once GET /api/auth/menus resolves.
   */
  applyMenuLabels(): void {
    let changed = false;
    const relabelled = this.tabs.map(tab => {
      const item = this.menuService.findByRoute(tab.route);
      if (!item || (item.label === tab.title && (item.icon ?? FALLBACK_ICON) === tab.icon)) return tab;
      changed = true;
      return { ...tab, title: item.label, icon: item.icon ?? tab.icon };
    });

    if (changed) this._tabs.next(relabelled);
  }

  /** "/factory-structure" → "Factory structure". Only used for routes the menu doesn't
   *  cover (e.g. /forbidden), so it never has to be pretty. */
  private _titleFromRoute(route: string): string {
    const segment = route.split('/').filter(Boolean).pop() ?? 'Trang';
    const words = segment.replace(/[-_]/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  get tabs(): Tab[] {
    return this._tabs.getValue();
  }

  // ─── Open / Switch ────────────────────────────────────────────────────────

  /** Mở tab mới hoặc focus tab đã tồn tại (không duplicate theo route) */
  openTab(tab: Omit<Tab, 'closeable'> & { closeable?: boolean }): void {
    const existing = this.tabs.find(t => t.route === tab.route);
    if (existing) {
      this.setActiveTab(existing.id);
      return;
    }

    const newTab: Tab = { closeable: true, ...tab };
    this._tabs.next([...this.tabs, newTab]);
    this.setActiveTab(newTab.id);
  }

  /** Chuyển sang tab theo id và điều hướng router */
  setActiveTab(id: string): Promise<boolean> {
    const tab = this.tabs.find(t => t.id === id);
    if (!tab) return Promise.resolve(false);
    this.activeTabId.set(id);
    return this.router.navigate([tab.route]);
  }

  // ─── Close ────────────────────────────────────────────────────────────────

  /** Đóng tab theo id.
   *  - Xóa cache route để lần mở lại sẽ reset state.
   *  - Nếu đóng tab đang active → focus tab kế cận.
   *  - Nếu đóng hết tất cả tab → không còn tab nào, hiển thị nền trống.
   */
  closeTab(id: string): void {
    const currentTabs = this.tabs;
    const idx = currentTabs.findIndex(t => t.id === id);
    if (idx === -1) return;

    const closedTab = currentTabs[idx];
    const updated = currentTabs.filter(t => t.id !== id);
    this._tabs.next(updated);

    if (updated.length === 0) {
      // Không còn tab nào: bỏ active + xóa cache, không điều hướng đi đâu
      // cả — layout sẽ tự hiển thị nền trống (xem ShellComponent.hasTabs).
      this.activeTabId.set('');
      this._clearRouteCache(closedTab.route);
      return;
    }

    if (this.activeTabId() === id) {
      // Tab đang đóng là tab active: phải điều hướng đi trước, để router
      // detach + store route hiện tại vào cache của RouteReuseStrategy;
      // chỉ sau khi đó cache mới thực sự tồn tại để mà xóa. Xóa trước khi
      // navigate là no-op (chưa có gì trong cache), rồi navigate lại ghi
      // đè state cũ vào cache → tab tưởng đã đóng vẫn "sống" khi mở lại.
      const newActive = updated[Math.min(idx, updated.length - 1)];
      this.setActiveTab(newActive.id).then(() => {
        this._clearRouteCache(closedTab.route);
      });
    } else {
      // Tab không active: route của nó đã được router detach/cache từ lần
      // chuyển tab trước đó rồi, nên xóa ngay là an toàn.
      this._clearRouteCache(closedTab.route);
    }
  }

  /**
   * Xoá sạch strip và toàn bộ state component đang cache. Gọi khi đăng xuất.
   *
   * Khác `closeAll()` ở chỗ không giữ lại tab đầu và không điều hướng: người dùng đang
   * rời khỏi shell. Service là singleton nên nếu không dọn, tài khoản đăng nhập kế tiếp
   * kế thừa nguyên si tab của tài khoản trước — kèm cả instance component còn giữ dữ
   * liệu cũ trong cache của TabReuseStrategy.
   */
  reset(): void {
    this._tabs.next([]);
    this.activeTabId.set('');
    const strategy = this.reuseStrategy as TabReuseStrategy;
    if (typeof strategy.clearAll === 'function') strategy.clearAll();
  }

  closeAll(): void {
    const first = this.tabs[0];
    if (!first) return;
    const removed = this.tabs.slice(1);
    this._tabs.next([first]);
    // Điều hướng về tab đầu trước, rồi mới xóa cache của các tab đã đóng —
    // cùng lý do như closeTab(): nếu tab active nằm trong `removed`, cache
    // của nó chỉ được router ghi vào SAU khi navigate() chạy xong.
    this.setActiveTab(first.id).then(() => {
      removed.forEach(t => this._clearRouteCache(t.route));
    });
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private _clearRouteCache(route: string): void {
    const strategy = this.reuseStrategy as TabReuseStrategy;
    if (typeof strategy.clearRoute === 'function') {
      strategy.clearRoute(route);
    }
  }
}

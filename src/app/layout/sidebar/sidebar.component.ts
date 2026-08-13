import { Component, HostBinding, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteAccessService } from '../../core/auth/route-access.service';
import { MenuService } from '../../core/services/menu.service';
import { TabService } from '../../core/services/tab.service';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../../core/services/i18n.service';
import { MenuItem } from '../../domain/models/menu-item.model';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly menuService = inject(MenuService);
  private readonly tabService = inject(TabService);
  private readonly authService = inject(AuthService);
  private readonly routeAccess = inject(RouteAccessService);
  readonly i18n = inject(I18nService);

  readonly activeTabId = this.tabService.activeTabId;
  readonly currentUser = this.authService.currentUser;

  /**
   * GET /api/auth/menus đã lọc theo IsAdmin/FunctionId, nhưng đó chỉ là cái cổng admin
   * đặt trên *bản ghi menu*. Lọc thêm theo yêu cầu của route để người dùng không thấy mục
   * dẫn tới màn hình họ không vào được — trừ mục admin đã đánh dấu công khai, xem `_isVisible`.
   */
  readonly menuItems = computed(() => this._prune(this.menuService.menuItems()));

  private _prune(items: MenuItem[]): MenuItem[] {
    const kept: MenuItem[] = [];

    for (const item of items) {
      const children = item.children?.length ? this._prune(item.children) : undefined;

      // Nhóm cha không có route riêng: giữ lại chỉ khi còn ít nhất một menu con vào được,
      // nếu không nó là header bấm vào chẳng xổ ra gì.
      if (!item.route) {
        if (children?.length) kept.push({ ...item, children });
        continue;
      }

      if (this._isVisible(item)) {
        kept.push(children?.length ? { ...item, children } : { ...item, children: undefined });
      }
    }

    return kept;
  }

  /**
   * Mục không gắn Function là mục admin đã cố ý để công khai, nên nó được hiện bất kể route
   * đòi quyền gì. Ý định khai báo trên dòng menu thắng suy luận từ route.
   *
   * ⚠ Đây CHỈ là hiển thị. `permissionGuard` vẫn đọc `data.permissions` của route và không
   * biết gì về dòng menu, nên một mục công khai trỏ vào route có gác sẽ hiện ra rồi đá người
   * dùng sang /forbidden khi bấm. Muốn nó dùng được thật thì tài khoản phải giữ đủ mã route
   * đòi — API phía sau cũng gác độc lập, không cách nào lách từ FE.
   */
  private _isVisible(item: MenuItem): boolean {
    return item.functionId == null || this.routeAccess.canAccess(item.route);
  }

  collapsed = false;
  /** Tracks which group ids are expanded in the tree */
  expandedGroups = new Set<string>();

  @HostBinding('class.is-collapsed')
  get isCollapsed() { return this.collapsed; }

  // ── Collapse ──────────────────────────────────────────────────────────────
  toggleCollapse(): void { this.collapsed = !this.collapsed; }

  // ── Tree expand/collapse ───────────────────────────────────────────────────
  toggleGroup(id: string): void {
    if (this.expandedGroups.has(id)) {
      this.expandedGroups.delete(id);
    } else {
      this.expandedGroups.add(id);
    }
  }

  isGroupExpanded(id: string): boolean {
    return this.expandedGroups.has(id);
  }

  // ── Tab open ──────────────────────────────────────────────────────────────
  openTab(item: MenuItem): void {
    if (!item.route) return; // group items don't open tabs

    // Collapsed rail: close the flyout once a child is picked
    if (this.collapsed) {
      this.expandedGroups.clear();
    }

    this.tabService.openTab({
      id: item.id,
      title: item.label,
      route: item.route,
      icon: item.icon ?? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`,
      closeable: true,
    });
  }

  isActive(item: MenuItem): boolean {
    if (!item.route) return false;
    const activeTab = this.tabService.tabs.find(t => t.id === this.activeTabId());
    return activeTab?.route === item.route;
  }

  /** True if any child of this group is the active tab */
  isGroupActive(item: MenuItem): boolean {
    if (!item.children?.length) return false;
    return item.children.some(child => this.isActive(child));
  }

  /** On first render, auto-expand groups that have the active route */
  isGroupAutoExpanded(item: MenuItem): boolean {
    return this.isGroupActive(item) || this.expandedGroups.has(item.id);
  }
}

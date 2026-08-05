import { Component, HostBinding, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  readonly i18n = inject(I18nService);

  readonly activeTabId = this.tabService.activeTabId;
  readonly currentUser = this.authService.currentUser;

  /** GET /api/auth/menus đã lọc theo IsAdmin/FunctionId ở backend rồi, nên chỉ cần hiển thị nguyên cây trả về. */
  readonly menuItems = this.menuService.menuItems;

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

import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TabBarComponent } from '../tab-bar/tab-bar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { TabService } from '../../core/services/tab.service';
import { MenuService } from '../../core/services/menu.service';
import { I18nService } from '../../core/services/i18n.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TabBarComponent, TopbarComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit, OnDestroy {
  private readonly tabService = inject(TabService);
  private readonly menuService = inject(MenuService);
  readonly i18n = inject(I18nService);

  /** Còn tab nào mở không — hết tab thì ẩn router-outlet, hiện nền trống. */
  readonly hasTabs = this.tabService.hasTabs;

  ngOnInit(): void {
    // Shell chỉ render khi authGuard đã xác nhận đăng nhập, nên load menu ở đây
    // cover cả 2 trường hợp: vừa login xong và F5 lại trang với session cũ.
    this.menuService.load().subscribe({
      // A deep link opens its tab before the menu exists, so that tab starts with a
      // title guessed from the URL. Now that the real labels are here, apply them.
      next: () => this.tabService.applyMenuLabels(),
      error: () => {},
    });
  }

  /**
   * Rời khỏi shell chỉ xảy ra khi phiên kết thúc — /login là route duy nhất nằm ngoài nó.
   * Menu và thanh tab đều nằm trong service singleton nên chúng sống dai hơn component
   * này; dọn ở đây để lần đăng nhập sau bắt đầu từ trạng thái trắng thay vì thừa hưởng
   * tab và menu của người vừa đăng xuất.
   */
  ngOnDestroy(): void {
    this.tabService.reset();
    this.menuService.clear();
  }
}

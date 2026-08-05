import { Component, inject, signal, computed, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../core/services/i18n.service';
import { TabService } from '../../core/services/tab.service';
import { Tab } from '../../domain/models/tab.model';
import { IconComponent } from '../../shared/components/icon.component';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [CommonModule, IconComponent, ClickOutsideDirective],
  templateUrl: './tab-bar.component.html',
  styleUrl: './tab-bar.component.scss',
})
export class TabBarComponent implements AfterViewChecked {
  private readonly tabService = inject(TabService);
  readonly i18n = inject(I18nService);

  @ViewChild('scrollRef') scrollRef!: ElementRef<HTMLElement>;

  readonly tabs$ = this.tabService.tabs$;
  readonly activeTabId = this.tabService.activeTabId;

  /** Overflow dropdown open state */
  overflowOpen = false;

  selectTab(tab: Tab): void {
    this.tabService.setActiveTab(tab.id);
    this.overflowOpen = false;
  }

  closeTab(event: MouseEvent, tab: Tab): void {
    event.stopPropagation();
    this.tabService.closeTab(tab.id);
  }

  trackByTab(_: number, tab: Tab): string {
    return tab.id;
  }

  /** Scroll active tab into view after any change */
  ngAfterViewChecked(): void {
    this._scrollActiveIntoView();
  }

  private _scrollActiveIntoView(): void {
    if (!this.scrollRef) return;
    const el = this.scrollRef.nativeElement.querySelector('.tab--active') as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }
}

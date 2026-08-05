import { Directive, ElementRef, EventEmitter, HostListener, Output, inject } from '@angular/core';

/**
 * Emits when a click lands outside the host element — used to auto-close
 * dropdowns/popovers. Host the directive on the *wrapper* that contains both
 * the toggle button and the panel, not just the panel: that way a click on
 * the toggle button counts as "inside" and doesn't fight with the button's
 * own (click) handler that already opens/closes it.
 */
@Directive({ selector: '[appClickOutside]', standalone: true })
export class ClickOutsideDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @Output() appClickOutside = new EventEmitter<void>();

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.appClickOutside.emit();
    }
  }
}

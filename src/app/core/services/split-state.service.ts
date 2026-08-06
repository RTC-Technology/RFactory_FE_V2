import { Injectable, inject } from '@angular/core';
import { SecureStorageService } from './secure-storage.service';

/**
 * Remembers splitter panel sizes.
 *
 * PrimeNG can persist these itself via `stateStorage="local"`, but it writes plain JSON
 * straight to localStorage, outside SecureStorageService. Driving `panelSizes` by hand
 * keeps every entry the app owns behind the same door.
 */
@Injectable({ providedIn: 'root' })
export class SplitStateService {
  private readonly storage = inject(SecureStorageService);

  /**
   * One array per key, owned by this service.
   *
   * Two reasons it cannot just hand back the caller's fallback. The template writes that
   * fallback as an array literal, which Angular memoises into a constant shared by every
   * instance of the component — and PrimeNG's splitter mutates the `panelSizes` array it
   * is given as the user drags, so it would be writing into that shared constant. Owning
   * the array also keeps its identity stable across change detection, so the splitter is
   * not handed a "new" value on every cycle.
   */
  private readonly _owned = new Map<string, number[]>();

  sizes(key: string, fallback: number[]): number[] {
    let owned = this._owned.get(key);
    if (owned) return owned;

    const saved = this.storage.get<number[]>(`split:${key}`);
    // Guard the length too: a stored pair would break a three-panel splitter if the
    // layout ever changed under a key that was already in use.
    owned = saved?.length === fallback.length ? [...saved] : [...fallback];
    this._owned.set(key, owned);
    return owned;
  }

  /** PrimeNG reports sizes as `(string | number)[]`, so they are coerced at the boundary
   *  rather than leaving strings to come back out of storage later. */
  save(key: string, sizes: readonly (string | number)[]): void {
    const numeric = sizes.map(Number).filter(n => Number.isFinite(n));
    if (numeric.length !== sizes.length) return;

    // Update in place so the splitter keeps the array instance it is already bound to.
    const owned = this._owned.get(key);
    if (owned) owned.splice(0, owned.length, ...numeric);
    else this._owned.set(key, [...numeric]);

    this.storage.set(`split:${key}`, [...numeric]);
  }
}

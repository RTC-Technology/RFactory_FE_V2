import { HttpClient } from '@angular/common/http';
import { inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { ApiResponse } from '../../domain/models/api-response.model';

/**
 * Shared client for the backend's uniform CRUD controllers — every one of them exposes
 * the same five routes over `ApiResponse<T>`, so subclasses only supply a base URL.
 *
 * Holds the collection in a signal: these are small master-data sets read by several
 * panels at once, and one cached list beats every panel refetching.
 *
 * Note there are no server-side filters. Callers that need "children of X" filter the
 * loaded list themselves.
 */
export abstract class CrudApiService<TDto extends { id: number }, TRequest> {
  protected readonly http = inject(HttpClient);

  /** Set by the subclass; only read inside methods, never during construction. */
  protected abstract readonly baseUrl: string;

  private readonly _items = signal<TDto[]>([]);
  private readonly _loading = signal(false);

  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();

  load(): Observable<TDto[]> {
    this._loading.set(true);
    return this.http.get<ApiResponse<TDto[]>>(this.baseUrl).pipe(
      map(res => res.data ?? []),
      tap({
        next: items => { this._items.set(items); this._loading.set(false); },
        error: () => this._loading.set(false),
      }),
    );
  }

  create(body: TRequest): Observable<TDto> {
    return this.http.post<ApiResponse<TDto>>(this.baseUrl, body).pipe(map(res => res.data));
  }

  /** The backend maps the whole payload onto the entity, so `body` must carry every
   *  field — omitting one blanks that column rather than leaving it alone. */
  update(id: number, body: TRequest): Observable<TDto> {
    return this.http.put<ApiResponse<TDto>>(`${this.baseUrl}/${id}`, body).pipe(map(res => res.data));
  }

  remove(id: number): Observable<void> {
    return this.http.delete<ApiResponse<unknown>>(`${this.baseUrl}/${id}`).pipe(map(() => undefined));
  }
}

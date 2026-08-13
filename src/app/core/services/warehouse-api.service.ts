import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  WarehouseDto, WarehouseRequest,
  WarehouseZoneDto, WarehouseZoneRequest,
  WarehouseLocationDto, WarehouseLocationRequest,
} from '../../domain/models/warehouse.model';

/**
 * Base CRUD client for the warehouse controllers.
 *
 * Unlike the master-data controllers that wrap every response in `ApiResponse<T>`,
 * the warehouse controllers return data directly — `Ok(list)`, `Ok(dto)`,
 * `BadRequest(error)`, `NoContent()` — so this base skips the ApiResponse
 * unwrapping that `CrudApiService` does.
 *
 * The signal-caching pattern (load once, filter locally) is identical.
 */
abstract class WarehouseCrudApiService<TDto extends { id: number }, TRequest> {
  protected readonly http = inject(HttpClient);

  protected abstract readonly baseUrl: string;

  private readonly _items = signal<TDto[]>([]);
  private readonly _loading = signal(false);

  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();

  load(): Observable<TDto[]> {
    this._loading.set(true);
    return this.http.get<TDto[]>(this.baseUrl).pipe(
      tap({
        next: items => { this._items.set(items); this._loading.set(false); },
        error: () => this._loading.set(false),
      }),
    );
  }

  create(body: TRequest): Observable<TDto> {
    return this.http.post<TDto>(this.baseUrl, body);
  }

  update(id: number, body: TRequest): Observable<TDto> {
    return this.http.put<TDto>(`${this.baseUrl}/${id}`, body);
  }

  remove(id: number): Observable<void> {
    return this.http.delete(`${this.baseUrl}/${id}`).pipe(map(() => undefined));
  }
}

// ─── Concrete services ─────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class WarehouseApiService extends WarehouseCrudApiService<WarehouseDto, WarehouseRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/warehouses`;
}

@Injectable({ providedIn: 'root' })
export class WarehouseZoneApiService extends WarehouseCrudApiService<WarehouseZoneDto, WarehouseZoneRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/warehouse-zones`;
}

@Injectable({ providedIn: 'root' })
export class WarehouseLocationApiService extends WarehouseCrudApiService<WarehouseLocationDto, WarehouseLocationRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/warehouse-locations`;
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../domain/models/api-response.model';
import {
  ProductionOrderCreateRequest,
  ProductionOrderDto,
  ProductionOrderFilter,
  ProductionOrderMaterialDto,
  ProductionOrderOperationDto,
  ProductionOrderProgressRequest,
  ProductionOrderUpdateRequest,
} from '../../domain/models/production-order.model';

@Injectable({ providedIn: 'root' })
export class ProductionOrderApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/production-orders`;

  readonly items = signal<ProductionOrderDto[]>([]);
  readonly loading = signal<boolean>(false);

  load(filter?: ProductionOrderFilter): Observable<ProductionOrderDto[]> {
    this.loading.set(true);
    let params = new HttpParams();
    if (filter) {
      if (filter.status != null) params = params.set('status', filter.status.toString());
      if (filter.priority != null) params = params.set('priority', filter.priority.toString());
      if (filter.orderType != null) params = params.set('orderType', filter.orderType.toString());
      if (filter.productId != null) params = params.set('productId', filter.productId.toString());
      if (filter.lineId != null) params = params.set('lineId', filter.lineId.toString());
      if (filter.fromDate) params = params.set('fromDate', filter.fromDate);
      if (filter.toDate) params = params.set('toDate', filter.toDate);
      if (filter.searchKeyword) params = params.set('searchKeyword', filter.searchKeyword);
    }

    return this.http.get<ApiResponse<ProductionOrderDto[]>>(this.baseUrl, { params }).pipe(
      map(res => res.data ?? []),
      tap({
        next: data => {
          this.items.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      })
    );
  }

  getById(id: number): Observable<ProductionOrderDto> {
    return this.http
      .get<ApiResponse<ProductionOrderDto>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.data));
  }

  previewBom(bomId: number, quantity: number): Observable<ProductionOrderMaterialDto[]> {
    const params = new HttpParams().set('bomId', bomId.toString()).set('quantity', quantity.toString());
    return this.http
      .get<ApiResponse<ProductionOrderMaterialDto[]>>(`${this.baseUrl}/preview-bom`, { params })
      .pipe(map(res => res.data ?? []));
  }

  previewRouting(routingId: number): Observable<ProductionOrderOperationDto[]> {
    const params = new HttpParams().set('routingId', routingId.toString());
    return this.http
      .get<ApiResponse<ProductionOrderOperationDto[]>>(`${this.baseUrl}/preview-routing`, { params })
      .pipe(map(res => res.data ?? []));
  }

  create(body: ProductionOrderCreateRequest): Observable<ProductionOrderDto> {
    return this.http
      .post<ApiResponse<ProductionOrderDto>>(this.baseUrl, body)
      .pipe(
        map(res => res.data),
        tap(created => {
          this.items.update(list => [created, ...list]);
        })
      );
  }

  update(id: number, body: ProductionOrderUpdateRequest): Observable<ProductionOrderDto> {
    return this.http
      .put<ApiResponse<ProductionOrderDto>>(`${this.baseUrl}/${id}`, body)
      .pipe(
        map(res => res.data),
        tap(updated => {
          this.items.update(list => list.map(item => (item.id === id ? updated : item)));
        })
      );
  }

  delete(id: number): Observable<boolean> {
    return this.http
      .delete<ApiResponse<boolean>>(`${this.baseUrl}/${id}`)
      .pipe(
        map(res => res.data ?? true),
        tap(() => {
          this.items.update(list => list.filter(item => item.id !== id));
        })
      );
  }

  release(id: number): Observable<ProductionOrderDto> {
    return this.http
      .post<ApiResponse<ProductionOrderDto>>(`${this.baseUrl}/${id}/release`, {})
      .pipe(
        map(res => res.data),
        tap(updated => this.updateLocalItem(updated))
      );
  }

  start(id: number): Observable<ProductionOrderDto> {
    return this.http
      .post<ApiResponse<ProductionOrderDto>>(`${this.baseUrl}/${id}/start`, {})
      .pipe(
        map(res => res.data),
        tap(updated => this.updateLocalItem(updated))
      );
  }

  pause(id: number, remark?: string): Observable<ProductionOrderDto> {
    return this.http
      .post<ApiResponse<ProductionOrderDto>>(`${this.baseUrl}/${id}/pause`, { remark })
      .pipe(
        map(res => res.data),
        tap(updated => this.updateLocalItem(updated))
      );
  }

  complete(id: number): Observable<ProductionOrderDto> {
    return this.http
      .post<ApiResponse<ProductionOrderDto>>(`${this.baseUrl}/${id}/complete`, {})
      .pipe(
        map(res => res.data),
        tap(updated => this.updateLocalItem(updated))
      );
  }

  cancel(id: number, remark?: string): Observable<ProductionOrderDto> {
    return this.http
      .post<ApiResponse<ProductionOrderDto>>(`${this.baseUrl}/${id}/cancel`, { remark })
      .pipe(
        map(res => res.data),
        tap(updated => this.updateLocalItem(updated))
      );
  }

  close(id: number): Observable<ProductionOrderDto> {
    return this.http
      .post<ApiResponse<ProductionOrderDto>>(`${this.baseUrl}/${id}/close`, {})
      .pipe(
        map(res => res.data),
        tap(updated => this.updateLocalItem(updated))
      );
  }

  resetBom(id: number): Observable<ProductionOrderDto> {
    return this.http
      .post<ApiResponse<ProductionOrderDto>>(`${this.baseUrl}/${id}/reset-bom`, {})
      .pipe(
        map(res => res.data),
        tap(updated => this.updateLocalItem(updated))
      );
  }

  duplicate(id: number): Observable<ProductionOrderDto> {
    return this.http
      .post<ApiResponse<ProductionOrderDto>>(`${this.baseUrl}/${id}/duplicate`, {})
      .pipe(
        map(res => res.data),
        tap(created => {
          this.items.update(list => [created, ...list]);
        })
      );
  }

  recordProgress(id: number, body: ProductionOrderProgressRequest): Observable<ProductionOrderDto> {
    return this.http
      .post<ApiResponse<ProductionOrderDto>>(`${this.baseUrl}/${id}/progress`, body)
      .pipe(
        map(res => res.data),
        tap(updated => this.updateLocalItem(updated))
      );
  }

  private updateLocalItem(updated: ProductionOrderDto): void {
    this.items.update(list => list.map(item => (item.id === updated.id ? updated : item)));
  }
}

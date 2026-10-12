import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../domain/models/api-response.model';
import {
  PackingSpecificationDto,
  PackingSpecificationRequest,
} from '../../domain/models/packing-specification.model';

@Injectable({ providedIn: 'root' })
export class PackingSpecificationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/packing-specifications`;

  readonly items = signal<PackingSpecificationDto[]>([]);
  readonly loading = signal<boolean>(false);

  load(): Observable<PackingSpecificationDto[]> {
    this.loading.set(true);
    return this.http.get<ApiResponse<PackingSpecificationDto[]>>(this.baseUrl).pipe(
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

  getById(id: number): Observable<PackingSpecificationDto> {
    return this.http
      .get<ApiResponse<PackingSpecificationDto>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.data));
  }

  getByProductId(productId: number): Observable<PackingSpecificationDto[]> {
    return this.http
      .get<ApiResponse<PackingSpecificationDto[]>>(`${this.baseUrl}/product/${productId}`)
      .pipe(map(res => res.data ?? []));
  }

  getDefaultByProductId(productId: number): Observable<PackingSpecificationDto> {
    return this.http
      .get<ApiResponse<PackingSpecificationDto>>(`${this.baseUrl}/product/${productId}/default`)
      .pipe(map(res => res.data));
  }

  create(body: PackingSpecificationRequest): Observable<PackingSpecificationDto> {
    return this.http
      .post<ApiResponse<PackingSpecificationDto>>(this.baseUrl, body)
      .pipe(map(res => res.data));
  }

  update(id: number, body: PackingSpecificationRequest): Observable<PackingSpecificationDto> {
    return this.http
      .put<ApiResponse<PackingSpecificationDto>>(`${this.baseUrl}/${id}`, body)
      .pipe(map(res => res.data));
  }

  remove(id: number): Observable<boolean> {
    return this.http
      .delete<ApiResponse<boolean>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.data));
  }

  setDefault(id: number): Observable<boolean> {
    return this.http
      .post<ApiResponse<boolean>>(`${this.baseUrl}/${id}/set-default`, {})
      .pipe(map(res => res.data));
  }
}

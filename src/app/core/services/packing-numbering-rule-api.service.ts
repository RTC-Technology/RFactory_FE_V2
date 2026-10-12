import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../domain/models/api-response.model';
import {
  GeneratePackingCodeRequest,
  GeneratedPackingCodesDto,
  PackingNumberingRuleDto,
  PackingNumberingRuleRequest,
} from '../../domain/models/packing-numbering-rule.model';

@Injectable({ providedIn: 'root' })
export class PackingNumberingRuleApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/packing-numbering-rules`;

  readonly items = signal<PackingNumberingRuleDto[]>([]);
  readonly loading = signal<boolean>(false);

  load(): Observable<PackingNumberingRuleDto[]> {
    this.loading.set(true);
    return this.http.get<ApiResponse<PackingNumberingRuleDto[]>>(this.baseUrl).pipe(
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

  getById(id: number): Observable<PackingNumberingRuleDto> {
    return this.http
      .get<ApiResponse<PackingNumberingRuleDto>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.data));
  }

  getByScope(scope: string): Observable<PackingNumberingRuleDto[]> {
    return this.http
      .get<ApiResponse<PackingNumberingRuleDto[]>>(`${this.baseUrl}/scope/${scope}`)
      .pipe(map(res => res.data ?? []));
  }

  getDefaultByScope(scope: string): Observable<PackingNumberingRuleDto> {
    return this.http
      .get<ApiResponse<PackingNumberingRuleDto>>(`${this.baseUrl}/scope/${scope}/default`)
      .pipe(map(res => res.data));
  }

  preview(id: number): Observable<string> {
    return this.http
      .get<ApiResponse<string>>(`${this.baseUrl}/${id}/preview`)
      .pipe(map(res => res.data));
  }

  create(body: PackingNumberingRuleRequest): Observable<PackingNumberingRuleDto> {
    return this.http
      .post<ApiResponse<PackingNumberingRuleDto>>(this.baseUrl, body)
      .pipe(map(res => res.data));
  }

  update(id: number, body: PackingNumberingRuleRequest): Observable<PackingNumberingRuleDto> {
    return this.http
      .put<ApiResponse<PackingNumberingRuleDto>>(`${this.baseUrl}/${id}`, body)
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

  generateCodes(request: GeneratePackingCodeRequest): Observable<GeneratedPackingCodesDto> {
    return this.http
      .post<ApiResponse<GeneratedPackingCodesDto>>(`${this.baseUrl}/generate-codes`, request)
      .pipe(map(res => res.data));
  }
}

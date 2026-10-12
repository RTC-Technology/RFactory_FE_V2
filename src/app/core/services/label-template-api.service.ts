import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../domain/models/api-response.model';
import {
  LabelTemplateDto,
  LabelTemplateRequest,
} from '../../domain/models/label-template.model';

@Injectable({ providedIn: 'root' })
export class LabelTemplateApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/label-templates`;

  readonly items = signal<LabelTemplateDto[]>([]);
  readonly loading = signal<boolean>(false);

  load(): Observable<LabelTemplateDto[]> {
    this.loading.set(true);
    return this.http.get<ApiResponse<LabelTemplateDto[]>>(this.baseUrl).pipe(
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

  getById(id: number): Observable<LabelTemplateDto> {
    return this.http
      .get<ApiResponse<LabelTemplateDto>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.data));
  }

  getByEntityType(entityType: string): Observable<LabelTemplateDto[]> {
    return this.http
      .get<ApiResponse<LabelTemplateDto[]>>(`${this.baseUrl}/entity/${entityType}`)
      .pipe(map(res => res.data ?? []));
  }

  getDefaultByEntityType(entityType: string): Observable<LabelTemplateDto> {
    return this.http
      .get<ApiResponse<LabelTemplateDto>>(`${this.baseUrl}/entity/${entityType}/default`)
      .pipe(map(res => res.data));
  }

  create(body: LabelTemplateRequest): Observable<LabelTemplateDto> {
    return this.http
      .post<ApiResponse<LabelTemplateDto>>(this.baseUrl, body)
      .pipe(map(res => res.data));
  }

  update(id: number, body: LabelTemplateRequest): Observable<LabelTemplateDto> {
    return this.http
      .put<ApiResponse<LabelTemplateDto>>(`${this.baseUrl}/${id}`, body)
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

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../domain/models/api-response.model';
import {
  DetailedProductionPlanCreateRequest,
  DetailedProductionPlanDto,
  DetailedProductionPlanFilter,
  DetailedProductionPlanUpdateRequest,
  GenerateOrdersFromPlanRequest,
  GenerateOrdersResultDto,
  MasterProductionPlanDto,
  PlanAllocationCalculationRequest,
  PlanAllocationCalculationResultDto,
  ValidateQuantitiesRequest,
  ValidateQuantitiesResultDto,
} from '../../domain/models/detailed-production-plan.model';

@Injectable({ providedIn: 'root' })
export class DetailedProductionPlanApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/detailed-production-plans`;

  readonly items = signal<DetailedProductionPlanDto[]>([]);
  readonly loading = signal<boolean>(false);

  load(filter?: DetailedProductionPlanFilter): Observable<DetailedProductionPlanDto[]> {
    this.loading.set(true);
    let params = new HttpParams();
    if (filter) {
      if (filter.keyword) params = params.set('keyword', filter.keyword);
      if (filter.workshopId != null) params = params.set('workshopId', filter.workshopId.toString());
      if (filter.status != null) params = params.set('status', filter.status.toString());
      if (filter.fromDate) params = params.set('fromDate', filter.fromDate);
      if (filter.toDate) params = params.set('toDate', filter.toDate);
    }

    return this.http.get<ApiResponse<DetailedProductionPlanDto[]>>(this.baseUrl, { params }).pipe(
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

  getById(id: number): Observable<DetailedProductionPlanDto> {
    return this.http
      .get<ApiResponse<DetailedProductionPlanDto>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.data));
  }

  create(request: DetailedProductionPlanCreateRequest): Observable<DetailedProductionPlanDto> {
    return this.http
      .post<ApiResponse<DetailedProductionPlanDto>>(this.baseUrl, request)
      .pipe(map(res => res.data));
  }

  update(id: number, request: DetailedProductionPlanUpdateRequest): Observable<DetailedProductionPlanDto> {
    return this.http
      .put<ApiResponse<DetailedProductionPlanDto>>(`${this.baseUrl}/${id}`, request)
      .pipe(map(res => res.data));
  }

  delete(id: number): Observable<boolean> {
    return this.http
      .delete<ApiResponse<boolean>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.data ?? true));
  }

  changeStatus(id: number, status: number, remark?: string): Observable<DetailedProductionPlanDto> {
    return this.http
      .put<ApiResponse<DetailedProductionPlanDto>>(`${this.baseUrl}/${id}/status`, { status, remark })
      .pipe(map(res => res.data));
  }

  getMasterPlans(): Observable<MasterProductionPlanDto[]> {
    return this.http
      .get<ApiResponse<MasterProductionPlanDto[]>>(`${this.baseUrl}/master-plans`)
      .pipe(map(res => res.data ?? []));
  }

  getMasterPlanById(id: number): Observable<MasterProductionPlanDto> {
    return this.http
      .get<ApiResponse<MasterProductionPlanDto>>(`${this.baseUrl}/master-plans/${id}`)
      .pipe(map(res => res.data));
  }

  calculateAllocation(request: PlanAllocationCalculationRequest): Observable<PlanAllocationCalculationResultDto> {
    return this.http
      .post<ApiResponse<PlanAllocationCalculationResultDto>>(`${this.baseUrl}/calculate-allocation`, request)
      .pipe(map(res => res.data));
  }

  validateQuantities(request: ValidateQuantitiesRequest): Observable<ValidateQuantitiesResultDto> {
    return this.http
      .post<ApiResponse<ValidateQuantitiesResultDto>>(`${this.baseUrl}/validate-quantities`, request)
      .pipe(map(res => res.data));
  }

  generateProductionOrders(request: GenerateOrdersFromPlanRequest): Observable<GenerateOrdersResultDto> {
    return this.http
      .post<ApiResponse<GenerateOrdersResultDto>>(`${this.baseUrl}/generate-orders`, request)
      .pipe(map(res => res.data));
  }
}

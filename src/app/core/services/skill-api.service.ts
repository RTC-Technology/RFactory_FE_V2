import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SkillDto, SkillRequest, EmployeeSkillDto, EmployeeSkillRequest } from '../../domain/models/skill.model';
import { CrudApiService } from './crud-api.service';
import { ApiResponse } from '../../domain/models/api-response.model';

/** Skill catalogue — global list, no parent entity. */
@Injectable({ providedIn: 'root' })
export class SkillApiService extends CrudApiService<SkillDto, SkillRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/hr/skills`;
}

/**
 * Employee-skill assignments.
 *
 * `load()` fetches the entire list; callers filter by employeeId in memory.
 * `loadByEmployee(id)` fetches only that employee's rows — used when the
 * employee changes selection so we avoid re-downloading the whole dataset.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeSkillApiService extends CrudApiService<EmployeeSkillDto, EmployeeSkillRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/hr/employee-skills`;

  /** Load skills for a single employee by query param — more efficient than load(). */
  loadByEmployee(employeeId: number): Observable<EmployeeSkillDto[]> {
    const params = new HttpParams().set('employeeId', employeeId);
    this['_loading'].set(true);
    return this.http.get<ApiResponse<EmployeeSkillDto[]>>(this.baseUrl, { params }).pipe(
      map(res => res.data ?? []),
      tap({
        next: items => { this['_items'].set(items); this['_loading'].set(false); },
        error: () => this['_loading'].set(false),
      }),
    );
  }
}

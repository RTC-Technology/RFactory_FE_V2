import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../domain/models/api-response.model';
import {
  FunctionDto, FunctionGroupDto, FunctionGroupRequest, FunctionRequest, PermissionSyncResult,
} from '../../domain/models/function-dto.model';
import { CrudApiService } from './crud-api.service';

/**
 * The permission catalogue. A menu item's `functionId` points at a Function here:
 * null means the item is public, otherwise only holders of that function see it
 * (see MenuService.GetMenusForUserAsync on the backend).
 */
@Injectable({ providedIn: 'root' })
export class FunctionApiService extends CrudApiService<FunctionDto, FunctionRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/administration/functions`;

  /** Writes any catalogue entry the database is missing. Additive — safe to re-run. */
  syncCatalog(): Observable<PermissionSyncResult> {
    return this.http
      .post<ApiResponse<PermissionSyncResult>>(`${this.baseUrl}/sync-catalog`, {})
      .pipe(map(res => res.data));
  }
}

@Injectable({ providedIn: 'root' })
export class FunctionGroupApiService extends CrudApiService<FunctionGroupDto, FunctionGroupRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/administration/function-groups`;
}

import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../domain/models/api-response.model';
import { UserGroupDto, UserGroupRequest } from '../../domain/models/user-group.model';
import { CrudApiService } from './crud-api.service';

/**
 * User groups plus their two assignment sets. Both sets are read and written whole —
 * the backend PUTs replace rather than merge, matching how a checkbox list is edited.
 */
@Injectable({ providedIn: 'root' })
export class UserGroupApiService extends CrudApiService<UserGroupDto, UserGroupRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/administration/user-groups`;

  functionIds(groupId: number): Observable<number[]> {
    return this.http
      .get<ApiResponse<number[]>>(`${this.baseUrl}/${groupId}/functions`)
      .pipe(map(res => res.data ?? []));
  }

  setFunctionIds(groupId: number, functionIds: number[]): Observable<void> {
    return this.http
      .put<ApiResponse<unknown>>(`${this.baseUrl}/${groupId}/functions`, { functionIds })
      .pipe(map(() => undefined));
  }

  userIds(groupId: number): Observable<number[]> {
    return this.http
      .get<ApiResponse<number[]>>(`${this.baseUrl}/${groupId}/users`)
      .pipe(map(res => res.data ?? []));
  }

  setUserIds(groupId: number, userIds: number[]): Observable<void> {
    return this.http
      .put<ApiResponse<unknown>>(`${this.baseUrl}/${groupId}/users`, { userIds })
      .pipe(map(() => undefined));
  }
}

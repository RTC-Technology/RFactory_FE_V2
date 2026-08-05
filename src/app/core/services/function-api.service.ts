import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../domain/models/api-response.model';
import { FunctionDto } from '../../domain/models/function-dto.model';

const FUNCTIONS_URL = `${environment.apiUrl}/administration/functions`;

/**
 * Read-only access to the function (permission) catalogue. A menu item's
 * `functionId` points here: null = public, otherwise only users holding that
 * function see the item (see MenuService.GetMenusForUserAsync on the backend).
 */
@Injectable({ providedIn: 'root' })
export class FunctionApiService {
  private readonly http = inject(HttpClient);

  private readonly _functions = signal<FunctionDto[]>([]);
  readonly functions = this._functions.asReadonly();

  load(): Observable<FunctionDto[]> {
    return this.http.get<ApiResponse<FunctionDto[]>>(FUNCTIONS_URL).pipe(
      map(res => res.data ?? []),
      tap(items => this._functions.set(items)),
    );
  }
}

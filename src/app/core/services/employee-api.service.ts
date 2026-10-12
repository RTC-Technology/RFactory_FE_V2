import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { EmployeeDto, EmployeeRequest } from '../../domain/models/employee.model';
import { CrudApiService } from './crud-api.service';

/** Employee master data — one record per staff member, referenced by purchase orders. */
@Injectable({ providedIn: 'root' })
export class EmployeeApiService extends CrudApiService<EmployeeDto, EmployeeRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/hr/employee`;
}
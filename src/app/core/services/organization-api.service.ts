import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
	CompanyDto,
	CompanyRequest,
	DepartmentDto,
	DepartmentRequest,
	OrganizationDto, OrganizationRequest, ProductionTeamDto, ProductionTeamEmployeeDto, ProductionTeamEmployeeRequest, ProductionTeamRequest, UserDto, UserRequest,
	WorkCenterDto,
	WorkCenterRequest,
	WorkshopDto,
	WorkshopRequest,
} from '../../domain/models/organization.model';
import { CrudApiService } from './crud-api.service';

@Injectable({ providedIn: 'root' })
export class OrganizationApiService extends CrudApiService<OrganizationDto, OrganizationRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/master-data/organizations`;
}

/** Users live under Administration, not MasterData — different route prefix. */
@Injectable({ providedIn: 'root' })
export class UserApiService extends CrudApiService<UserDto, UserRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/administration/users`;
}

@Injectable({ providedIn: 'root' })
export class CompanyApiService extends CrudApiService<CompanyDto, CompanyRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/organization/company`;
}

@Injectable({ providedIn: 'root' })
export class WorkshopApiService extends CrudApiService<WorkshopDto, WorkshopRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/organization/workshop`;
}

@Injectable({ providedIn: 'root' })
export class DepartmentApiService extends CrudApiService<DepartmentDto, DepartmentRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/organization/department`;
}

@Injectable({ providedIn: 'root' })
export class WorkCenterApiService extends CrudApiService<WorkCenterDto, WorkCenterRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/organization/work-center`;
}

@Injectable({ providedIn: 'root' })
export class ProductionTeamApiService extends CrudApiService<ProductionTeamDto, ProductionTeamRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/organization/production-team`;
}

@Injectable({ providedIn: 'root' })
export class ProductionTeamEmployeeApiService extends CrudApiService<ProductionTeamEmployeeDto, ProductionTeamEmployeeRequest> {
	protected readonly baseUrl = `${environment.apiUrl}/organization/production-team/employees`;
}


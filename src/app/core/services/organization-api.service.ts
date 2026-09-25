import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  CompanyDto,
  CompanyRequest,
  OrganizationDto, OrganizationRequest, UserDto, UserRequest,
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


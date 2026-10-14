import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PositionDto, PositionRequest } from '../../domain/models/position.model';
import { CrudApiService } from './crud-api.service';

@Injectable({ providedIn: 'root' })
export class PositionApiService extends CrudApiService<PositionDto, PositionRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/hr/positions`;
}

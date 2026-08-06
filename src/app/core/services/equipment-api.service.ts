import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  MachineDto, MachineRequest,
  MachineTypeDto, MachineTypeRequest,
} from '../../domain/models/equipment.model';
import { CrudApiService } from './crud-api.service';

@Injectable({ providedIn: 'root' })
export class MachineTypeApiService extends CrudApiService<MachineTypeDto, MachineTypeRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/equipment/machine-types`;
}

@Injectable({ providedIn: 'root' })
export class MachineApiService extends CrudApiService<MachineDto, MachineRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/equipment/machines`;
}

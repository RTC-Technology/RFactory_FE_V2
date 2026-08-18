import { Injectable } from '@angular/core';
import { CrudApiService } from './crud-api.service';
import { InventoryDto, InventoryTransactionDto } from '../../domain/models/inventory.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class InventoryApiService extends CrudApiService<InventoryDto, InventoryDto> {
  protected readonly baseUrl = `${environment.apiUrl}/inventorys`;

}


@Injectable({
  providedIn: 'root',
})
export class InventoryTransactionApiService extends CrudApiService<InventoryTransactionDto, InventoryTransactionDto> {
  protected readonly baseUrl = `${environment.apiUrl}/inventory/transactions`;

}
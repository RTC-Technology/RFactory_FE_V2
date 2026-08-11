import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  GoodsReceiptDto, GoodsReceiptDetailDto,
  GoodsReceiptRequest,
  GoodsReceiptDetailRequest
} from '../../domain/models/goods-receipt.model';
import { CrudApiService } from './crud-api.service';

@Injectable({
  providedIn: 'root',
})
export class GoodsReceiptApiService extends CrudApiService<GoodsReceiptDto, GoodsReceiptRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/goods-receipt`;
}

@Injectable({
  providedIn: 'root',
})
export class GoodsReceiptDetailApiService extends CrudApiService<GoodsReceiptDetailDto, GoodsReceiptDetailRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/goods-receipt-detail`;
}


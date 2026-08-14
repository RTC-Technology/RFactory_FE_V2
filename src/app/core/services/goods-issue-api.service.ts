import { Injectable } from '@angular/core';
import { GoodsIssueDetailDto, GoodsIssueDetailRequest, GoodsIssueDto, GoodsIssueRequest } from '../../domain/models/goods-issue.model';
import { CrudApiService } from './crud-api.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class GoodsIssueApiService extends CrudApiService<GoodsIssueDto, GoodsIssueRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/goods-issue/issues`;
}

@Injectable({
  providedIn: 'root',
})
export class GoodsIssueDetailApiService extends CrudApiService<GoodsIssueDetailDto, GoodsIssueDetailRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/goods-issue/details`;
}


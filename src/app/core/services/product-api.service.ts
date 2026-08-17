import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  BomDetailDto, BomDetailRequest, BomDto, BomRequest,
  ProductDto, ProductRequest, ProductTypeDto, ProductTypeRequest,
  RoutingDto, RoutingOperationDto, RoutingOperationRequest, RoutingRequest,
  UnitCategoryDto, UnitCategoryRequest, UnitConversionDto, UnitConversionRequest,
  UnitDto, UnitRequest,
} from '../../domain/models/product.model';
import { CrudApiService } from './crud-api.service';

@Injectable({ providedIn: 'root' })
export class ProductTypeApiService extends CrudApiService<ProductTypeDto, ProductTypeRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/product/product-types`;
}

@Injectable({ providedIn: 'root' })
export class ProductApiService extends CrudApiService<ProductDto, ProductRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/product/products`;
}

@Injectable({ providedIn: 'root' })
export class BomApiService extends CrudApiService<BomDto, BomRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/product/boms`;
}

@Injectable({ providedIn: 'root' })
export class BomDetailApiService extends CrudApiService<BomDetailDto, BomDetailRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/product/bom-details`;
}

@Injectable({ providedIn: 'root' })
export class RoutingApiService extends CrudApiService<RoutingDto, RoutingRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/product/routings`;
}

@Injectable({ providedIn: 'root' })
export class RoutingOperationApiService extends CrudApiService<RoutingOperationDto, RoutingOperationRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/product/routing-operations`;
}

/** Units and their categories/conversions live under MasterData — different prefix. */
@Injectable({ providedIn: 'root' })
export class UnitApiService extends CrudApiService<UnitDto, UnitRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/units`;
}

@Injectable({ providedIn: 'root' })
export class UnitCategoryApiService extends CrudApiService<UnitCategoryDto, UnitCategoryRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/unit-categories`;
}

@Injectable({ providedIn: 'root' })
export class UnitConversionApiService extends CrudApiService<UnitConversionDto, UnitConversionRequest> {
  protected readonly baseUrl = `${environment.apiUrl}/master-data/unit-conversions`;
}

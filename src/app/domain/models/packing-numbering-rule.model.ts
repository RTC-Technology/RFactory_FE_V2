export interface PackingNumberingRuleDto {
  id: number;
  ruleCode: string;
  ruleName: string;
  targetScope: 'CARTON' | 'PALLET' | 'INNER_BOX' | 'SPEC' | 'LOT';
  prefix?: string | null;
  suffix?: string | null;
  dateFormat: string;
  sequenceLength: number;
  currentSequence: number;
  resetPeriod: 'DAILY' | 'MONTHLY' | 'YEARLY' | 'NEVER';
  lastResetDate?: string | null;
  includeCheckDigit: boolean;
  isDefault: boolean;
  isActive: boolean;
  description?: string | null;
  samplePreview: string;
  createdDate?: string;
}

export interface PackingNumberingRuleRequest {
  ruleCode: string;
  ruleName: string;
  targetScope: string;
  prefix?: string | null;
  suffix?: string | null;
  dateFormat: string;
  sequenceLength: number;
  currentSequence: number;
  resetPeriod: string;
  includeCheckDigit: boolean;
  isDefault: boolean;
  isActive: boolean;
  description?: string | null;
}

export interface GeneratePackingCodeRequest {
  targetScope?: string | null;
  ruleId?: number | null;
  count: number;
}

export interface GeneratedPackingCodesDto {
  ruleCode: string;
  targetScope: string;
  generatedCodes: string[];
  generatedAt: string;
}

export const RULE_SCOPES: Array<{ label: string; value: string; icon: string }> = [
  { label: 'Master Carton', value: 'CARTON', icon: 'pi-inbox' },
  { label: 'Pallet Container', value: 'PALLET', icon: 'pi-database' },
  { label: 'Inner Box', value: 'INNER_BOX', icon: 'pi-box' },
  { label: 'Packing Specification Code', value: 'SPEC', icon: 'pi-file' },
  { label: 'Production Lot / Batch', value: 'LOT', icon: 'pi-tags' },
];

export const DATE_FORMATS: Array<{ label: string; value: string; example: string }> = [
  { label: 'YYYYMMDD (20261012)', value: 'YYYYMMDD', example: '20261012' },
  { label: 'YYMMDD (261012)', value: 'YYMMDD', example: '261012' },
  { label: 'YYYYMM (202610)', value: 'YYYYMM', example: '202610' },
  { label: 'YYWW (26W42 - Year & Week)', value: 'YYWW', example: '26W42' },
  { label: 'None (No date in sequence)', value: 'NONE', example: '' },
];

export const RESET_PERIODS: Array<{ label: string; value: string }> = [
  { label: 'Daily (Every midnight)', value: 'DAILY' },
  { label: 'Monthly (1st of every month)', value: 'MONTHLY' },
  { label: 'Yearly (1st of every year)', value: 'YEARLY' },
  { label: 'Never (Continuous sequential)', value: 'NEVER' },
];

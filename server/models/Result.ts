import {DocumentRecord, JsonObject, JsonValue, getDocumentStore} from '../datastore/documentStore';
import {listAccounts} from './Account';

function toJsonValue(value: unknown): JsonValue {
  if (value === null || value === undefined) {
    return {} as JsonObject;
  }
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return value;
    case "object":
      if (Array.isArray(value)) {
        return value.map(toJsonValue) as JsonValue;
      }
      return Object.entries(value as Record<string, unknown>)
        .reduce((acc, [key, val]) => {
          acc[key] = toJsonValue(val);
          return acc;
        }, {} as JsonObject);
    default:
      return null;
  }
}


export interface ResultDocument {
  uid: string;
  deleted: boolean;
  dateRun: string;
  boptestVersion: string;
  isShared: boolean;
  tags: string[];
  thermalDiscomfort: number;
  energyUse: number;
  cost: number;
  emissions: number;
  iaq: number;
  timeRatio: number;
  peakElectricity: number;
  peakGas?: number;
  peakDistrictHeating?: number;
  timePeriod: string;
  controlStep: string;
  electricityPrice: string;
  weatherForecastUncertainty: string;
  scenario: JsonObject;
  accountId: number;
  buildingTypeUid: string;
  buildingTypeName: string;
}

export type ResultData = Omit<ResultDocument, 'uid'> & { uid: string };

const COLLECTION = 'results';

function mapRecordToDocument(record: DocumentRecord<JsonObject>): ResultDocument {
  const raw = record.data as Record<string, any>;
  const buildingTypeUid = typeof raw.buildingTypeUid === 'string' && raw.buildingTypeUid.length > 0
    ? raw.buildingTypeUid
    : raw.buildingTypeId !== undefined
      ? String(raw.buildingTypeId)
      : 'unknown-building';
  const buildingTypeName = typeof raw.buildingTypeName === 'string' && raw.buildingTypeName.length > 0
    ? raw.buildingTypeName
    : buildingTypeUid;
  const data = raw as ResultDocument;
  return {
    uid: data.uid,
    deleted: data.deleted,
    dateRun: data.dateRun,
    boptestVersion: data.boptestVersion,
    isShared: data.isShared,
    tags: data.tags,
    thermalDiscomfort: data.thermalDiscomfort,
    energyUse: data.energyUse,
    cost: data.cost,
    emissions: data.emissions,
    iaq: data.iaq,
    timeRatio: data.timeRatio,
    peakElectricity: data.peakElectricity,
    peakGas: data.peakGas,
    peakDistrictHeating: data.peakDistrictHeating,
    timePeriod: data.timePeriod,
    controlStep: data.controlStep,
    electricityPrice: data.electricityPrice,
    weatherForecastUncertainty: data.weatherForecastUncertainty,
    scenario: data.scenario,
    accountId: data.accountId,
    buildingTypeUid,
    buildingTypeName,
  };
}

export async function createResult(data: ResultData): Promise<DocumentRecord<ResultDocument>> {
  const store = await getDocumentStore();

  const normalized: JsonObject = {
    uid: data.uid,
    deleted: data.deleted,
    dateRun: data.dateRun,
    boptestVersion: data.boptestVersion,
    isShared: data.isShared,
    tags: data.tags,
    thermalDiscomfort: data.thermalDiscomfort,
    energyUse: data.energyUse,
    cost: data.cost,
    emissions: data.emissions,
    iaq: data.iaq,
    timeRatio: data.timeRatio,
    peakElectricity: data.peakElectricity,
    peakGas: data.peakGas ?? null,
    peakDistrictHeating: data.peakDistrictHeating ?? null,
    timePeriod: data.timePeriod,
    controlStep: data.controlStep,
    electricityPrice: data.electricityPrice,
    weatherForecastUncertainty: data.weatherForecastUncertainty,
    scenario: toJsonValue(data.scenario),
    accountId: data.accountId,
    buildingTypeUid: data.buildingTypeUid ?? 'unknown-building',
    buildingTypeName:
      data.buildingTypeName ?? data.buildingTypeUid ?? 'Unknown Building',
  };

  const existing = await store.findOneByField<JsonObject>(COLLECTION, 'uid', data.uid);
  if (existing) {
    const updated = await store.replace<JsonObject>(COLLECTION, existing.docId, normalized);
    return (updated ?? existing) as unknown as DocumentRecord<ResultDocument>;
  }

  const record = await store.insert<JsonObject>(COLLECTION, normalized);
  return record as unknown as DocumentRecord<ResultDocument>;
}

export async function findResultById(id: number): Promise<DocumentRecord<ResultDocument> | null> {
  const store = await getDocumentStore();
  const record = await store.findByNumericId<JsonObject>(COLLECTION, id);
  return record ? (record as unknown as DocumentRecord<ResultDocument>) : null;
}

export async function findResultByUid(uid: string): Promise<DocumentRecord<ResultDocument> | null> {
  const store = await getDocumentStore();
  const record = await store.findOneByField<JsonObject>(COLLECTION, 'uid', uid);
  return record ? (record as unknown as DocumentRecord<ResultDocument>) : null;
}

export async function listResults(): Promise<Array<DocumentRecord<ResultDocument>>> {
  const store = await getDocumentStore();
  const records = await store.findAll<JsonObject>(COLLECTION);
  return records as unknown as Array<DocumentRecord<ResultDocument>>;
}

export async function findResultsByAccountId(accountId: number): Promise<Array<DocumentRecord<ResultDocument>>> {
  const store = await getDocumentStore();
  const records = await store.findManyByField<JsonObject>(COLLECTION, 'accountId', accountId);
  return records as unknown as Array<DocumentRecord<ResultDocument>>;
}

export async function replaceResult(record: DocumentRecord<ResultDocument>): Promise<DocumentRecord<ResultDocument>> {
  const store = await getDocumentStore();
  const normalized: JsonObject = {
    uid: record.data.uid,
    deleted: record.data.deleted,
    dateRun: record.data.dateRun,
    boptestVersion: record.data.boptestVersion,
    isShared: record.data.isShared,
    tags: record.data.tags,
    thermalDiscomfort: record.data.thermalDiscomfort,
    energyUse: record.data.energyUse,
    cost: record.data.cost,
    emissions: record.data.emissions,
    iaq: record.data.iaq,
    timeRatio: record.data.timeRatio,
    peakElectricity: record.data.peakElectricity,
    peakGas: record.data.peakGas ?? null,
    peakDistrictHeating: record.data.peakDistrictHeating ?? null,
    timePeriod: record.data.timePeriod,
    controlStep: record.data.controlStep,
    electricityPrice: record.data.electricityPrice,
    weatherForecastUncertainty: record.data.weatherForecastUncertainty,
    scenario: toJsonValue(record.data.scenario),
    accountId: record.data.accountId,
    buildingTypeUid: record.data.buildingTypeUid ?? 'unknown-building',
    buildingTypeName:
      record.data.buildingTypeName ??
      record.data.buildingTypeUid ??
      'Unknown Building',
  };

  const updated = await store.replace<JsonObject>(COLLECTION, record.docId, normalized);
  if (!updated) {
    throw new Error(`Result with docId ${record.docId} not found`);
  }
  return updated as unknown as DocumentRecord<ResultDocument>;
}

interface RangeFilter {
  min?: number;
  max?: number;
}

export interface SharedResultFilters {
  buildingTypeUid?: string;
  buildingTypeName?: string;
  tags?: string[];
  scenario?: Record<string, string>;
  cost?: RangeFilter;
  energy?: RangeFilter;
  thermalDiscomfort?: RangeFilter;
  aqDiscomfort?: RangeFilter;
  emissions?: RangeFilter;
  accountId?: number;
  boptestVersion?: string;
}

export interface SharedResultQueryOptions {
  limit: number;
  cursor?: number;
  filters?: SharedResultFilters;
  sortDirection?: 'asc' | 'desc';
}

interface QueryRow {
  doc_id: string;
  collection: string;
  numeric_id: number | string;
  data: ResultDocument;
  created_at: string;
  updated_at: string;
}

function mapQueryRowToRecord(row: QueryRow): DocumentRecord<ResultDocument> {
  return {
    docId: row.doc_id,
    collection: row.collection,
    numericId: typeof row.numeric_id === 'number' ? row.numeric_id : parseInt(row.numeric_id, 10),
    data: row.data,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export interface SharedResultQueryOutput {
  records: Array<DocumentRecord<ResultDocument>>;
  nextCursor: number | null;
  hasNext: boolean;
}

function applyFilterConditions(
  filters: SharedResultFilters | undefined,
  params: Array<number | string | number[]>,
  conditions: string[]
) {
  if (!filters) {
    return;
  }

  if (filters.buildingTypeUid) {
    params.push(String(filters.buildingTypeUid).toLowerCase());
    conditions.push(`LOWER(data->>'buildingTypeUid') = $${params.length}`);
  } else if (filters.buildingTypeName) {
    params.push(filters.buildingTypeName.toLowerCase());
    conditions.push(`LOWER(data->>'buildingTypeName') = $${params.length}`);
  }

  if (filters.tags && filters.tags.length > 0) {
    params.push(JSON.stringify(filters.tags));
    conditions.push(`(data->'tags') @> $${params.length}::jsonb`);
  }

  if (filters.boptestVersion) {
    params.push(filters.boptestVersion.toLowerCase());
    conditions.push(`LOWER(data->>'boptestVersion') = $${params.length}`);
  }

  if (typeof filters.accountId === 'number' && Number.isFinite(filters.accountId)) {
    params.push(filters.accountId);
    conditions.push(`(data->>'accountId')::bigint = $${params.length}::bigint`);
  }

  if (filters.scenario) {
    const scenarioEntries = Object.entries(filters.scenario)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, value as string]);
    if (scenarioEntries.length > 0) {
      const scenarioObject: Record<string, string> = {};
      scenarioEntries.forEach(([key, value]) => {
        scenarioObject[key] = value;
      });
      params.push(JSON.stringify(scenarioObject));
      conditions.push(`(data->'scenario') @> $${params.length}::jsonb`);
    }
  }

  const pushRange = (field: string, range?: RangeFilter) => {
    if (!range) {
      return;
    }
    if (range.min !== undefined && Number.isFinite(range.min)) {
      params.push(range.min);
      conditions.push(`COALESCE((data->>'${field}')::double precision, 0) >= $${params.length}`);
    }
    if (range.max !== undefined && Number.isFinite(range.max)) {
      params.push(range.max);
      conditions.push(`COALESCE((data->>'${field}')::double precision, 0) <= $${params.length}`);
    }
  };

  pushRange('cost', filters.cost);
  pushRange('energyUse', filters.energy);
  pushRange('thermalDiscomfort', filters.thermalDiscomfort);
  pushRange('iaq', filters.aqDiscomfort);
  pushRange('emissions', filters.emissions);
}

export async function querySharedResultDocuments(
  options: SharedResultQueryOptions
): Promise<SharedResultQueryOutput> {
  const {limit, cursor, filters, sortDirection = 'desc'} = options;
  const store = await getDocumentStore();
  const pool = store.getPool();

  const params: Array<number | string | number[]> = [];
  const conditions: string[] = [`collection = 'results'`, `(data->>'deleted')::boolean = false`];

  if (typeof cursor === 'number' && Number.isFinite(cursor)) {
    params.push(cursor);
    if (sortDirection === 'asc') {
      conditions.push(`numeric_id > $${params.length}`);
    } else {
      conditions.push(`numeric_id < $${params.length}`);
    }
  }

  applyFilterConditions(filters, params, conditions);

  const accountIdsSharingAll = (await listAccounts())
    .filter(account => account.shareAllResults === true)
    .map(account => account.id);

  if (accountIdsSharingAll.length > 0) {
    params.push(accountIdsSharingAll);
    const placeholder = `$${params.length}`;
    conditions.push(
      `((data->>'isShared')::boolean = true OR (data->>'accountId')::bigint = ANY(${placeholder}::bigint[]))`
    );
  } else {
    conditions.push(`(data->>'isShared')::boolean = true`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(limit || 0, 1), 100);
  const orderDirection = sortDirection === 'asc' ? 'ASC' : 'DESC';
  const sql = `
    SELECT doc_id, collection, numeric_id, data, created_at, updated_at
    FROM documents
    ${whereClause}
    ORDER BY numeric_id ${orderDirection}
    LIMIT ${safeLimit + 1}
  `;

  const {rows} = await pool.query(sql, params);
  const mapped = rows.map(row => mapQueryRowToRecord(row as unknown as QueryRow));

  const hasNext = mapped.length > safeLimit;
  const trimmed = hasNext ? mapped.slice(0, safeLimit) : mapped;
  const nextCursor = hasNext ? trimmed[trimmed.length - 1].numericId : null;

  return {
    records: trimmed,
    nextCursor,
    hasNext,
  };
}

export interface UserResultQueryOptions extends SharedResultQueryOptions {
  accountId: number;
}

export async function queryUserResultDocuments(
  options: UserResultQueryOptions
): Promise<SharedResultQueryOutput> {
  const {limit, cursor, filters, sortDirection = 'desc', accountId} = options;
  const store = await getDocumentStore();
  const pool = store.getPool();

  const params: Array<number | string | number[]> = [accountId];
  const conditions: string[] = [
    `collection = 'results'`,
    `(data->>'deleted')::boolean = false`,
    `(data->>'accountId')::bigint = $1::bigint`,
  ];

  const effectiveFilters: SharedResultFilters = {
    ...(filters || {}),
    accountId,
  };

  if (typeof cursor === 'number' && Number.isFinite(cursor)) {
    params.push(cursor);
    const placeholder = `$${params.length}`;
    if (sortDirection === 'asc') {
      conditions.push(`numeric_id > ${placeholder}`);
    } else {
      conditions.push(`numeric_id < ${placeholder}`);
    }
  }

  applyFilterConditions(effectiveFilters, params, conditions);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(limit || 0, 1), 100);
  const orderDirection = sortDirection === 'asc' ? 'ASC' : 'DESC';
  const sql = `
    SELECT doc_id, collection, numeric_id, data, created_at, updated_at
    FROM documents
    ${whereClause}
    ORDER BY numeric_id ${orderDirection}
    LIMIT ${safeLimit + 1}
  `;

  const {rows} = await pool.query(sql, params);
  const mapped = rows.map(row => mapQueryRowToRecord(row as unknown as QueryRow));

  const hasNext = mapped.length > safeLimit;
  const trimmed = hasNext ? mapped.slice(0, safeLimit) : mapped;
  const nextCursor = hasNext ? trimmed[trimmed.length - 1].numericId : null;

  return {
    records: trimmed,
    nextCursor,
    hasNext,
  };
}

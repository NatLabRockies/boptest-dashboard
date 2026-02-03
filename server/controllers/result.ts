import {
  SignatureDetails,
  Result,
  Account,
  BuildingType,
} from '../../common/interfaces';
import {
  findAccountById,
  findAccountsByIds,
} from '../models/Account';
import {getAccountByAPIKey} from './account';
import {
  createResult,
  listResults,
  findResultsByAccountId,
  findResultById,
  findResultByUid,
  replaceResult,
  ResultDocument,
  querySharedResultDocuments,
  SharedResultQueryOptions,
  queryUserResultDocuments,
  UserResultQueryOptions,
} from '../models/Result';
import {upsertResultFacet} from '../models/ResultFacet';
import {DocumentRecord, JsonObject} from '../datastore/documentStore';
import {getBoptestTestcaseIds} from '../utils/boptest';

function jsonObjectToPlain(value: JsonObject | undefined | null): Record<string, any> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as unknown as Record<string, any>;
}

function toJsonObject(value: any): JsonObject {
  if (value && typeof value === 'object') {
    return value as JsonObject;
  }
  return {};
}


function sanitizeAccountForResult(account: Account): Account {
  return {
    ...account,
    apiKey: '',
    apiKeySalt: '',
    results: [],
  };
}

function toResult(
  record: DocumentRecord<ResultDocument>,
  account: Account
): Result {
  const data = record.data;
  const buildingType: BuildingType = {
    uid: data.buildingTypeUid || 'unknown-building',
    name:
      data.buildingTypeName ||
      data.buildingTypeUid ||
      'Unknown Building',
  };
  return {
    id: record.numericId,
    uid: data.uid,
    deleted: data.deleted,
    dateRun: new Date(data.dateRun),
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
    scenario: jsonObjectToPlain(data.scenario),
    account: sanitizeAccountForResult(account),
    buildingType,
  };
}

async function hydrateResults(
  records: Array<DocumentRecord<ResultDocument>>
): Promise<Result[]> {
  if (records.length === 0) {
    return [];
  }

  const accountIds = Array.from(new Set(records.map(r => r.data.accountId)));

  const accounts = await findAccountsByIds(accountIds);

  const accountMap = new Map(accounts.map(account => [account.id, account]));

  const hydrated: Result[] = [];

  records.forEach(record => {
    const account = accountMap.get(record.data.accountId);
    if (!account) {
      console.warn(
        `Skipping result ${record.data.uid}: missing account ${record.data.accountId}`
      );
      return;
    }

    hydrated.push(toResult(record, account));
  });

  return hydrated;
}

export async function getSharedResultByUid(uid: string): Promise<Result | null> {
  const record = await findResultByUid(uid);
  if (!record || record.data.deleted) {
    return null;
  }

  const hydrated = await hydrateResults([record]);
  if (hydrated.length === 0) {
    return null;
  }

  const result = hydrated[0];
  const shareAll = result.account.shareAllResults;
  const canShare = shareAll === true || result.isShared;
  if (!canShare) {
    return null;
  }

  return sanitizeSharedResult(result);
}

function sanitizeSharedResult(result: Result): Result {
  const account: any = {...result.account};
  delete account.apiKey;
  delete account.apiKeySalt;
  delete account.shareAllResults;
  delete account.results;
  delete account.id;

  return {
    ...result,
    account: account as Account,
    buildingType: result.buildingType,
  };
}

export async function getResults(): Promise<Result[]> {
  const records = await listResults();
  const active = records.filter(record => !record.data.deleted);
  return hydrateResults(active);
}

export async function getAllSharedResults(): Promise<Result[]> {
  const records = await listResults();
  const active = records.filter(record => !record.data.deleted);
  const hydrated = await hydrateResults(active);

  const filtered = hydrated.filter(result => {
    const shareAll = result.account.shareAllResults;
    if (shareAll === true) {
      return true;
    }
    return result.isShared;
  });

  return filtered.map(sanitizeSharedResult);
}

export interface SharedResultsPage {
  results: Result[];
  pageInfo: {
    hasNext: boolean;
    nextCursor: number | null;
  };
}

export async function getSharedResultsPage(
  options: SharedResultQueryOptions
): Promise<SharedResultsPage> {
  const {records, hasNext, nextCursor} = await querySharedResultDocuments(options);
  const hydrated = await hydrateResults(records);
  const sanitized = hydrated.map(sanitizeSharedResult);

  return {
    results: sanitized,
    pageInfo: {
      hasNext,
      nextCursor,
    },
  };
}

export async function getUserResultsPage(
  options: UserResultQueryOptions
): Promise<SharedResultsPage> {
  const {records, hasNext, nextCursor} = await queryUserResultDocuments(options);
  let hydrated = await hydrateResults(records);

  const {filters} = options;
  if (filters) {
    hydrated = hydrated.filter(result => {
      const {buildingType} = result;
      if (filters.buildingTypeUid) {
        const targetUid = String(filters.buildingTypeUid).toLowerCase();
        const resultUid = String(buildingType?.uid ?? '').toLowerCase();
        if (targetUid && !resultUid.includes(targetUid)) {
          return false;
        }
      } else if (filters.buildingTypeName) {
        const targetName = String(filters.buildingTypeName).toLowerCase();
        const resultName = String(buildingType?.name ?? '').toLowerCase();
        if (targetName && !resultName.includes(targetName)) {
          return false;
        }
      }
      return true;
    });
  }

  return {
    results: hydrated,
    pageInfo: {
      hasNext,
      nextCursor,
    },
  };
}

export async function getAllResultsForUser(userId: string): Promise<Result[]> {
  const accountId = parseInt(userId, 10);
  if (Number.isNaN(accountId)) {
    throw new Error('Invalid user ID');
  }

  const account = await findAccountById(accountId);
  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  const records = await findResultsByAccountId(accountId);
  const active = records.filter(record => !record.data.deleted);

  return hydrateResults(active);
}

function buildResultDocument(
  result: any,
  account: Account,
  buildingTypeUid: string,
  buildingTypeName: string
): ResultDocument {
  const tempUncertainty = result.scenario?.temperature_uncertainty;
  const solarUncertainty = result.scenario?.solar_uncertainty;
  const weatherForecastUncertainty =
    result.scenario?.weatherForecastUncertainty ??
    [
      tempUncertainty ? `Temperature: ${tempUncertainty}` : null,
      solarUncertainty ? `Solar GHI: ${solarUncertainty}` : null,
    ]
      .filter(Boolean)
      .join(', ');

  return {
    uid: result.uid,
    deleted: false,
    dateRun: new Date(result.dateRun).toISOString(),
    boptestVersion: result.boptestVersion,
    isShared: result.isShared,
    tags: result.tags || [],
    thermalDiscomfort: result.kpis.tdis_tot,
    energyUse: result.kpis.ener_tot,
    cost: result.kpis.cost_tot,
    emissions: result.kpis.emis_tot,
    iaq: result.kpis.idis_tot,
    timeRatio: result.kpis.time_rat,
    peakElectricity: result.kpis.pele_tot,
    peakGas: result.kpis.pgas_tot,
    peakDistrictHeating: result.kpis.pdih_tot,
    timePeriod: result.scenario.timePeriod,
    controlStep: result.controlStep,
    electricityPrice: result.scenario.electricityPrice,
    weatherForecastUncertainty,
    scenario: toJsonObject(result.scenario),
    accountId: account.id,
    buildingTypeUid,
    buildingTypeName,
  };
}

async function createResultAndAssociatedModels(result: any) {
  const account = await getAccountByAPIKey(result.account.apiKey);
  const buildingTypeUid = String(result.buildingType?.uid ?? 'unknown');
  const buildingTypeName = String(
    result.buildingType?.name ?? result.buildingType?.uid ?? 'Unknown Building'
  );

  const document = buildResultDocument(result, account, buildingTypeUid, buildingTypeName);
  await createResult(document);

  const scenarioValues: Record<string, string[]> = {};
  if (result.scenario && typeof result.scenario === 'object') {
    for (const key of Object.keys(result.scenario)) {
      const value = result.scenario[key];
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          scenarioValues[key] = value
            .filter(item => item !== undefined && item !== null)
            .map(item => String(item));
        } else {
          scenarioValues[key] = [String(value)];
        }
      }
    }
  }

  await upsertResultFacet(
    buildingTypeUid,
    buildingTypeName,
    scenarioValues,
    Array.isArray(result.tags) ? result.tags.map((tag: any) => String(tag)) : [],
    typeof result.boptestVersion === 'string' ? result.boptestVersion : undefined
  );
}

export async function createResults(results: any[]): Promise<PromiseSettledResult<void>[]> {
  const testcaseIds = await getBoptestTestcaseIds();
  return Promise.allSettled(
    results.map(async (result: any) => {
      if (testcaseIds) {
        const uid = String(result?.buildingType?.uid ?? '').trim().toLowerCase();
        const name = String(result?.buildingType?.name ?? '').trim().toLowerCase();
        const matches =
          (uid && testcaseIds.has(uid)) || (name && testcaseIds.has(name));
        if (!matches) {
          const details = uid || name || 'missing';
          throw new Error(`Unknown test case uid/name: ${details}`);
        }
      }
      await createResultAndAssociatedModels(result);
    })
  );
}

export async function toggleShared(id: number, share: boolean, sessionId: number): Promise<void> {
  const record = await findResultById(id);
  if (!record) {
    throw new Error('Result not found');
  }

  if (record.data.accountId !== sessionId) {
    throw new Error('Not authorized');
  }

  record.data.isShared = share;
  await replaceResult(record);
}

function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  const entries = keys.map(key => `"${key}":${stableStringify(value[key])}`);
  return `{${entries.join(',')}}`;
}

function scenarioWithoutSeed(value: JsonObject | undefined | null): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, any> = {};
  Object.keys(value as Record<string, any>).forEach(key => {
    if (key === 'seed') {
      return;
    }
    result[key] = (value as Record<string, any>)[key];
  });
  return result;
}

function getScenarioSignature(value: JsonObject | undefined | null): string {
  return stableStringify(scenarioWithoutSeed(value));
}

export async function getSignatureDetailsForResult(id: string): Promise<SignatureDetails> {
  const targetRecord = await findResultByUid(id);
  if (!targetRecord) {
    throw new Error(`Result with uid ${id} not found`);
  }

  const records = await listResults();
  const targetSignature = getScenarioSignature(targetRecord.data.scenario);
  const matching = records.filter(
    record => getScenarioSignature(record.data.scenario) === targetSignature
  );

  const hydratedResults = await hydrateResults(matching);
  const targetResult = hydratedResults.find(result => result.uid === id);

  if (!targetResult) {
    throw new Error(`Hydrated result with uid ${id} not found`);
  }

  return getKPIRanges(hydratedResults, targetResult);
}

function getKPIRanges(results: Result[], result: Result): SignatureDetails {
  let tdMin = result.thermalDiscomfort;
  let tdMax = result.thermalDiscomfort;

  let energyMin = result.energyUse;
  let energyMax = result.energyUse;

  let costMin = result.cost;
  let costMax = result.cost;

  let emissionsMin = result.emissions;
  let emissionsMax = result.emissions;

  let iaqMin = result.iaq;
  let iaqMax = result.iaq;

  let timeMin = result.timeRatio;
  let timeMax = result.timeRatio;

  let peakElectricityMin = result.peakElectricity;
  let peakElectricityMax = result.peakElectricity;

  let peakGasMin = result.peakGas || 0.0;
  let peakGasMax = result.peakGas || 0.0;

  let peakDistrictHeatingMin = result.peakDistrictHeating || 0.0;
  let peakDistrictHeatingMax = result.peakDistrictHeating || 0.0;

  results.forEach(res => {
    if (res.thermalDiscomfort < tdMin) {
      tdMin = res.thermalDiscomfort;
    }

    if (res.thermalDiscomfort > tdMax) {
      tdMax = res.thermalDiscomfort;
    }

    if (res.energyUse < energyMin) {
      energyMin = res.energyUse;
    }

    if (res.energyUse > energyMax) {
      energyMax = res.energyUse;
    }

    if (res.cost < costMin) {
      costMin = res.cost;
    }

    if (res.cost > costMax) {
      costMax = res.cost;
    }

    if (res.emissions < emissionsMin) {
      emissionsMin = res.emissions;
    }

    if (res.emissions > emissionsMax) {
      emissionsMax = res.emissions;
    }

    if (res.iaq < iaqMin) {
      iaqMin = res.iaq;
    }

    if (res.iaq > iaqMax) {
      iaqMax = res.iaq;
    }

    if (res.timeRatio < timeMin) {
      timeMin = res.timeRatio;
    }

    if (res.timeRatio > timeMax) {
      timeMax = res.timeRatio;
    }

    if (res.peakElectricity < peakElectricityMin) {
      peakElectricityMin = res.peakElectricity;
    }

    if (res.peakElectricity > peakElectricityMax) {
      peakElectricityMax = res.peakElectricity;
    }

    if (res.peakGas && res.peakGas < peakGasMin) {
      peakGasMin = res.peakGas;
    }

    if (res.peakGas && res.peakGas > peakGasMax) {
      peakGasMax = res.peakGas;
    }

    if (res.peakDistrictHeating && res.peakDistrictHeating < peakDistrictHeatingMin) {
      peakDistrictHeatingMin = res.peakDistrictHeating;
    }

    if (res.peakDistrictHeating && res.peakDistrictHeating > peakDistrictHeatingMax) {
      peakDistrictHeatingMax = res.peakDistrictHeating;
    }
  });

  return {
    numResults: results.length,
    thermalDiscomfort: {
      min: tdMin,
      max: tdMax,
    },
    energyUse: {
      min: energyMin,
      max: energyMax,
    },
    cost: {
      min: costMin,
      max: costMax,
    },
    emissions: {
      min: emissionsMin,
      max: emissionsMax,
    },
    iaq: {
      min: iaqMin,
      max: iaqMax,
    },
    timeRatio: {
      min: timeMin,
      max: timeMax,
    },
    peakElectricity: {
      min: peakElectricityMin,
      max: peakElectricityMax,
    },
    peakGas: {
      min: peakGasMin,
      max: peakGasMax,
    },
    peakDistrictHeating: {
      min: peakDistrictHeatingMin,
      max: peakDistrictHeatingMax,
    },
  };
}

import {FilterValues, ResultFacet} from '../../../common/interfaces';

export interface ResultFilterRequest {
  buildingTypeUid?: string;
  buildingTypeName?: string;
  tags?: string[];
  scenario?: Record<string, string>;
  boptestVersion?: string;
  costMin?: number;
  costMax?: number;
  energyMin?: number;
  energyMax?: number;
  thermalDiscomfortMin?: number;
  thermalDiscomfortMax?: number;
  aqDiscomfortMin?: number;
  aqDiscomfortMax?: number;
}

export interface FilterChangePayload {
  buildingTypeName: string;
  filters: FilterValues;
}

export const buildFilterRequest = (
  payload: FilterChangePayload,
  buildingFacets: ResultFacet[]
): ResultFilterRequest => {
  const request: ResultFilterRequest = {};

  if (payload.buildingTypeName) {
    const facet = buildingFacets.find(
      item => item.buildingTypeName === payload.buildingTypeName
    );
    if (facet) {
      request.buildingTypeUid = facet.buildingTypeUid;
    } else {
      request.buildingTypeName = payload.buildingTypeName;
    }
  }

  const scenarioEntries = Object.entries(
    payload.filters.scenario || {}
  ).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (scenarioEntries.length > 0) {
    const scenarioObject: Record<string, string> = {};
    scenarioEntries.forEach(([key, value]) => {
      scenarioObject[key] = String(value);
    });
    request.scenario = scenarioObject;
  }

  if (payload.filters.tags && payload.filters.tags.length > 0) {
    request.tags = payload.filters.tags;
  }

  if (payload.filters.boptestVersion) {
    request.boptestVersion = payload.filters.boptestVersion;
  }

  const assignRange = (
    range: {min: number; max: number} | undefined,
    minKey: keyof ResultFilterRequest,
    maxKey: keyof ResultFilterRequest
  ) => {
    if (!range) {
      return;
    }
    if (range.min !== undefined && range.min !== null) {
      (request as Record<string, number>)[minKey as string] = range.min;
    }
    if (range.max !== undefined && range.max !== null) {
      (request as Record<string, number>)[maxKey as string] = range.max;
    }
  };

  assignRange(payload.filters.cost, 'costMin', 'costMax');
  assignRange(payload.filters.energy, 'energyMin', 'energyMax');
  assignRange(
    payload.filters.thermalDiscomfort,
    'thermalDiscomfortMin',
    'thermalDiscomfortMax'
  );
  assignRange(payload.filters.aqDiscomfort, 'aqDiscomfortMin', 'aqDiscomfortMax');

  return request;
};

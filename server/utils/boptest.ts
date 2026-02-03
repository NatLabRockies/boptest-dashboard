import http from 'http';
import https from 'https';

const DEFAULT_BOPTEST_BASE_URL = 'https://api.boptest.net';
const TESTCASE_PATH = '/testcases';
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedIds: Set<string> | null = null;
let cachedAt = 0;
let inflight: Promise<Set<string> | null> | null = null;

const getBoptestBaseUrl = (): string => {
  const raw = process.env.BOPTEST_API_BASE_URL || process.env.BOPTEST_API_BASE;
  return raw && raw.trim().length > 0 ? raw.trim() : DEFAULT_BOPTEST_BASE_URL;
};

const fetchJson = (url: URL): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const client = url.protocol === 'http:' ? http : https;
    const req = client.get(url, res => {
      const status = res.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        res.resume();
        reject(new Error(`BOPTEST testcases status ${status}`));
        return;
      }

      let payload = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        payload += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(payload));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
  });

export async function getBoptestTestcaseIds(): Promise<Set<string> | null> {
  const now = Date.now();
  if (cachedIds && now - cachedAt < CACHE_TTL_MS) {
    return cachedIds;
  }

  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const baseUrl = getBoptestBaseUrl();
      const url = new URL(TESTCASE_PATH, baseUrl);
      const response = await fetchJson(url);
      if (!Array.isArray(response)) {
        throw new Error('BOPTEST testcases response not an array');
      }
      const ids = new Set<string>();
      response.forEach(item => {
        if (!item || typeof item !== 'object') {
          return;
        }
        const value = (item as {testcaseid?: unknown}).testcaseid;
        if (typeof value === 'string' && value.trim().length > 0) {
          ids.add(value.trim().toLowerCase());
        }
      });
      cachedIds = ids;
      cachedAt = Date.now();
      return cachedIds;
    } catch (error) {
      console.warn('Unable to fetch BOPTEST testcases; skipping validation.', error);
      cachedIds = null;
      cachedAt = 0;
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

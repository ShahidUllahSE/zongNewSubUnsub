import { XMLParser } from 'fast-xml-parser';
import { RawSubUnsubRequest } from '../types/soap';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  removeNSPrefix: true, // Strips soapenv:, secp:, tem: prefixes cleanly
});

/**
 * Searches recursively for a key (case-insensitive) in an object
 */
function findValueCaseInsensitive(obj: any, targetKey: string): string | undefined {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }

  const targetLower = targetKey.toLowerCase();
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === targetLower) {
      const val = obj[key];
      if (val !== null && val !== undefined) {
        return String(val).trim();
      }
      return undefined;
    }
  }

  // Traverse children
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const found = findValueCaseInsensitive(obj[key], targetKey);
      if (found !== undefined) {
        return found;
      }
    }
  }

  return undefined;
}

export function parseSoapRequest(rawXml: string): RawSubUnsubRequest {
  if (!rawXml || typeof rawXml !== 'string' || rawXml.trim().length === 0) {
    return {};
  }

  try {
    const parsed = parser.parse(rawXml);

    return {
      msisdn: findValueCaseInsensitive(parsed, 'Msisdn'),
      idService: findValueCaseInsensitive(parsed, 'IdService'),
      idChannel: findValueCaseInsensitive(parsed, 'IdChannel'),
      idChannelOption: findValueCaseInsensitive(parsed, 'IdChannelOption'),
      idBundle: findValueCaseInsensitive(parsed, 'IdBundle'),
      timestamp: findValueCaseInsensitive(parsed, 'Timestamp'),
    };
  } catch (error) {
    return {};
  }
}

import { ZongResponseCode, ZongResponseDescription } from '../constants/zongCodes';

export function buildSoapResponse(code: ZongResponseCode, customDescription?: string): string {
  const description = customDescription || ZongResponseDescription[code] || 'Unknown';

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:secp="http://www.example.org/secp/">
  <soapenv:Header/>
  <soapenv:Body>
    <secp:subUnsubResponse>
      <Code>${code}</Code>
      <Description>${description}</Description>
    </secp:subUnsubResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}

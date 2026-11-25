import http from 'http';
import { createApp } from '../src/app';
import { prisma, connectDatabase, disconnectDatabase } from '../src/db/prisma';

const TEST_PORT = 8099;
const TEST_MSISDN = '923001234567';

function sendHttpRequest(options: http.RequestOptions, body?: string): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Zong Reverse Flow Integration Tests ---');
  await connectDatabase();

  const app = createApp();
  const server = app.listen(TEST_PORT);

  try {
    // Clean up test data
    await prisma.reverseFlowLog.deleteMany({ where: { msisdn: TEST_MSISDN } });
    await prisma.subscriber.deleteMany({ where: { msisdn: TEST_MSISDN } });

    console.log('[Test Setup] Cleaned previous test data for', TEST_MSISDN);

    // ==========================================
    // 1. Test WSDL endpoint
    // ==========================================
    console.log('\n[1] Testing GET /api/zong?wsdl ...');
    const wsdlRes = await sendHttpRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/zong?wsdl',
      method: 'GET',
    });

    if (wsdlRes.statusCode === 200 && wsdlRes.body.includes('<wsdl:definitions') && wsdlRes.body.includes('targetNamespace="http://www.example.org/secp/"')) {
      console.log('  ✔ PASS: WSDL served successfully with correct targetNamespace');
    } else {
      throw new Error(`WSDL test failed: Status ${wsdlRes.statusCode}`);
    }

    // ==========================================
    // 2. Test Subscription (Code 0: Success)
    // ==========================================
    console.log('\n[2] Testing Subscription Success (Code 0) ...');
    const subXml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:secp="http://www.example.org/secp/">
  <soapenv:Header/>
  <soapenv:Body>
    <secp:subunsub>
      <Msisdn>${TEST_MSISDN}</Msisdn>
      <IdChannel>18</IdChannel>
      <IdChannelOption>1</IdChannelOption>
      <IdService>1</IdService>
      <IdBundle>95006464</IdBundle>
      <Timestamp>20261125160000</Timestamp>
    </secp:subunsub>
  </soapenv:Body>
</soapenv:Envelope>`;

    const subRes = await sendHttpRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/zong',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': '"http://www.example.org/secp/subunsub"',
          'Content-Length': Buffer.byteLength(subXml),
        },
      },
      subXml
    );

    if (subRes.body.includes('<Code>0</Code>') && subRes.body.includes('<Description>success</Description>')) {
      console.log('  ✔ PASS: Subscription response returned Code 0 (Success)');
    } else {
      throw new Error(`Subscription test failed: Response: ${subRes.body}`);
    }

    // Verify DB
    const subDb = await prisma.subscriber.findUnique({ where: { msisdn: TEST_MSISDN } });
    if (subDb && subDb.status === 'ACTIVE') {
      console.log('  ✔ PASS: Database subscriber status is ACTIVE');
    } else {
      throw new Error(`DB verification failed: expected status ACTIVE, got ${subDb?.status}`);
    }

    // ==========================================
    // 3. Test Already Subscribed (Code 2)
    // ==========================================
    console.log('\n[3] Testing Already Subscribed (Code 2) ...');
    const dupSubRes = await sendHttpRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/zong',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(subXml),
        },
      },
      subXml
    );

    if (dupSubRes.body.includes('<Code>2</Code>') && dupSubRes.body.includes('<Description>Already Subscribed</Description>')) {
      console.log('  ✔ PASS: Duplicate subscription returned Code 2 (Already Subscribed)');
    } else {
      throw new Error(`Duplicate subscription test failed: Response: ${dupSubRes.body}`);
    }

    // ==========================================
    // 4. Test Un-Subscription Success (Code 0)
    // ==========================================
    console.log('\n[4] Testing Un-Subscription Success (Code 0) ...');
    const unsubXml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:secp="http://www.example.org/secp/">
  <soapenv:Header/>
  <soapenv:Body>
    <secp:subunsub>
      <Msisdn>${TEST_MSISDN}</Msisdn>
      <IdChannel>19</IdChannel>
      <IdChannelOption>2</IdChannelOption>
      <IdService>1</IdService>
      <IdBundle>95006464</IdBundle>
      <Timestamp>20261125160500</Timestamp>
    </secp:subunsub>
  </soapenv:Body>
</soapenv:Envelope>`;

    const unsubRes = await sendHttpRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/zong',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(unsubXml),
        },
      },
      unsubXml
    );

    if (unsubRes.body.includes('<Code>0</Code>') && unsubRes.body.includes('<Description>success</Description>')) {
      console.log('  ✔ PASS: Un-Subscription response returned Code 0 (Success)');
    } else {
      throw new Error(`Un-subscription test failed: Response: ${unsubRes.body}`);
    }

    const unsubDb = await prisma.subscriber.findUnique({ where: { msisdn: TEST_MSISDN } });
    if (unsubDb && unsubDb.status === 'INACTIVE') {
      console.log('  ✔ PASS: Database subscriber status is updated to INACTIVE');
    } else {
      throw new Error(`DB verification failed: expected status INACTIVE, got ${unsubDb?.status}`);
    }

    // ==========================================
    // 5. Test Already Unsubscribed (Code 3)
    // ==========================================
    console.log('\n[5] Testing Already Unsubscribed (Code 3) ...');
    const dupUnsubRes = await sendHttpRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/zong',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(unsubXml),
        },
      },
      unsubXml
    );

    if (dupUnsubRes.body.includes('<Code>3</Code>') && dupUnsubRes.body.includes('<Description>Already Unsubscribed</Description>')) {
      console.log('  ✔ PASS: Duplicate unsubscription returned Code 3 (Already Unsubscribed)');
    } else {
      throw new Error(`Duplicate unsubscription test failed: Response: ${dupUnsubRes.body}`);
    }

    // ==========================================
    // 6. Test Missing Parameters (Code -1)
    // ==========================================
    console.log('\n[6] Testing Missing Parameters (Code -1) ...');
    const missingParamXml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:secp="http://www.example.org/secp/">
  <soapenv:Header/>
  <soapenv:Body>
    <secp:subunsub>
      <Msisdn>${TEST_MSISDN}</Msisdn>
      <IdChannel>18</IdChannel>
      <!-- IdChannelOption is missing -->
      <IdService>1</IdService>
      <Timestamp>20261125161000</Timestamp>
    </secp:subunsub>
  </soapenv:Body>
</soapenv:Envelope>`;

    const missingRes = await sendHttpRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/zong',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(missingParamXml),
        },
      },
      missingParamXml
    );

    if (missingRes.body.includes('<Code>-1</Code>') && missingRes.body.includes('<Description>Missing Parameters</Description>')) {
      console.log('  ✔ PASS: Missing parameter returned Code -1 (Missing Parameters)');
    } else {
      throw new Error(`Missing parameter test failed: Response: ${missingRes.body}`);
    }

    // ==========================================
    // 7. Test Invalid IdService (Code -2)
    // ==========================================
    console.log('\n[7] Testing Invalid IdService (Code -2) ...');
    const invalidServiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:secp="http://www.example.org/secp/">
  <soapenv:Header/>
  <soapenv:Body>
    <secp:subunsub>
      <Msisdn>${TEST_MSISDN}</Msisdn>
      <IdChannel>18</IdChannel>
      <IdChannelOption>1</IdChannelOption>
      <IdService>999</IdService>
      <Timestamp>20261125161500</Timestamp>
    </secp:subunsub>
  </soapenv:Body>
</soapenv:Envelope>`;

    const invalidServiceRes = await sendHttpRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/zong',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(invalidServiceXml),
        },
      },
      invalidServiceXml
    );

    if (invalidServiceRes.body.includes('<Code>-2</Code>') && invalidServiceRes.body.includes('<Description>Invalid IdService</Description>')) {
      console.log('  ✔ PASS: Invalid service ID returned Code -2 (Invalid IdService)');
    } else {
      throw new Error(`Invalid service ID test failed: Response: ${invalidServiceRes.body}`);
    }

    // ==========================================
    // 8. Test Invalid Parameters (Code -3)
    // ==========================================
    console.log('\n[8] Testing Invalid Parameters (Code -3) ...');
    const invalidParamXml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:secp="http://www.example.org/secp/">
  <soapenv:Header/>
  <soapenv:Body>
    <secp:subunsub>
      <Msisdn>03001234567</Msisdn> <!-- Invalid MSISDN format, should start with 92 -->
      <IdChannel>18</IdChannel>
      <IdChannelOption>1</IdChannelOption>
      <IdService>1</IdService>
      <Timestamp>20261125162000</Timestamp>
    </secp:subunsub>
  </soapenv:Body>
</soapenv:Envelope>`;

    const invalidParamRes = await sendHttpRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/zong',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(invalidParamXml),
        },
      },
      invalidParamXml
    );

    if (invalidParamRes.body.includes('<Code>-3</Code>') && invalidParamRes.body.includes('<Description>Invalid Parameters</Description>')) {
      console.log('  ✔ PASS: Invalid parameter returned Code -3 (Invalid Parameters)');
    } else {
      throw new Error(`Invalid parameter test failed: Response: ${invalidParamRes.body}`);
    }

    // ==========================================
    // 9. Test Audit Logs in Database
    // ==========================================
    console.log('\n[9] Verifying Reverse Flow Logs in Database ...');
    // Wait briefly for async log inserts
    await new Promise((r) => setTimeout(r, 500));
    const logs = await prisma.reverseFlowLog.findMany({
      where: { msisdn: TEST_MSISDN },
      orderBy: { createdAt: 'desc' },
    });

    if (logs.length >= 4) {
      console.log(`  ✔ PASS: Found ${logs.length} logged transactions for ${TEST_MSISDN}`);
    } else {
      throw new Error(`Audit log verification failed: expected at least 4 logs, got ${logs.length}`);
    }

    console.log('\n======================================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED 100% SUCCESSFULLY! 🎉');
    console.log('======================================================\n');
  } finally {
    server.close();
    await disconnectDatabase();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});

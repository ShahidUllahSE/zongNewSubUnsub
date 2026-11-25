import http from 'http';
import { createApp } from '../src/app';
import { prisma, connectDatabase, disconnectDatabase } from '../src/db/prisma';

const PORT = 8098;
const DUMMY_MSISDN = '923129876543';

function sendSoap(xml: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: '/api/zong',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(xml),
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve(body));
      }
    );
    req.on('error', reject);
    req.write(xml);
    req.end();
  });
}

function getSubXml(msisdn: string, option: '1' | '2', channel = '18', bundle = '95006464') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:secp="http://www.example.org/secp/">
  <soapenv:Header/>
  <soapenv:Body>
    <secp:subunsub>
      <Msisdn>${msisdn}</Msisdn>
      <IdChannel>${channel}</IdChannel>
      <IdChannelOption>${option}</IdChannelOption>
      <IdService>1</IdService>
      <IdBundle>${bundle}</IdBundle>
      <Timestamp>20261125163000</Timestamp>
    </secp:subunsub>
  </soapenv:Body>
</soapenv:Envelope>`;
}

async function runLiveDemo() {
  await connectDatabase();
  const app = createApp();
  const server = app.listen(PORT);

  try {
    console.log(`\n======================================================`);
    console.log(`🚀 LIVE DEMO TESTING FOR MSISDN: ${DUMMY_MSISDN}`);
    console.log(`======================================================\n`);

    // Step 0: Ensure fresh state
    await prisma.subscriber.deleteMany({ where: { msisdn: DUMMY_MSISDN } });
    await prisma.reverseFlowLog.deleteMany({ where: { msisdn: DUMMY_MSISDN } });

    // -----------------------------------------------------------------
    // CASE 1: Fresh Subscription (Option: 1)
    // -----------------------------------------------------------------
    console.log('▶ Case 1: Fresh Subscription Request (CRM Channel 18)...');
    const res1 = await sendSoap(getSubXml(DUMMY_MSISDN, '1', '18'));
    console.log('   Response XML:', res1.replace(/\s+/g, ' '));

    const db1 = await prisma.subscriber.findUnique({ where: { msisdn: DUMMY_MSISDN } });
    console.log('   👉 DB Subscriber Status:', db1?.status, '| Channel:', db1?.channelId, '| Subscribed At:', db1?.subscribedAt);

    // -----------------------------------------------------------------
    // CASE 2: Duplicate Subscription (Option: 1 again)
    // -----------------------------------------------------------------
    console.log('\n▶ Case 2: Duplicate Subscription Request (Same user calls again)...');
    const res2 = await sendSoap(getSubXml(DUMMY_MSISDN, '1', '18'));
    console.log('   Response XML:', res2.replace(/\s+/g, ' '));

    // -----------------------------------------------------------------
    // CASE 3: Un-Subscription (Option: 2)
    // -----------------------------------------------------------------
    console.log('\n▶ Case 3: Un-Subscription Request (MZA App Channel 19)...');
    const res3 = await sendSoap(getSubXml(DUMMY_MSISDN, '2', '19'));
    console.log('   Response XML:', res3.replace(/\s+/g, ' '));

    const db3 = await prisma.subscriber.findUnique({ where: { msisdn: DUMMY_MSISDN } });
    console.log('   👉 DB Subscriber Status:', db3?.status, '| Channel:', db3?.channelId, '| Unsubscribed At:', db3?.unsubscribedAt);

    // -----------------------------------------------------------------
    // CASE 4: Duplicate Un-Subscription (Option: 2 again)
    // -----------------------------------------------------------------
    console.log('\n▶ Case 4: Duplicate Un-Subscription Request...');
    const res4 = await sendSoap(getSubXml(DUMMY_MSISDN, '2', '19'));
    console.log('   Response XML:', res4.replace(/\s+/g, ' '));

    // -----------------------------------------------------------------
    // Audit Logs Check
    // -----------------------------------------------------------------
    await new Promise((r) => setTimeout(r, 400));
    console.log('\n▶ Checking reverse_flow_logs table entries:');
    const logs = await prisma.reverseFlowLog.findMany({
      where: { msisdn: DUMMY_MSISDN },
      orderBy: { id: 'asc' },
    });

    logs.forEach((log, idx) => {
      console.log(`   [Log #${idx + 1}] Option: ${log.channelOption} | Code: ${log.responseCode} (${log.responseDescription}) | Execution: ${log.executionTimeMs}ms`);
    });

    console.log(`\n======================================================`);
    console.log(`✅ LIVE VERIFICATION COMPLETED WITH REAL DATABASE ENTRIES!`);
    console.log(`======================================================\n`);
  } finally {
    server.close();
    await disconnectDatabase();
  }
}

runLiveDemo().catch(console.error);

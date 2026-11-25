# Zong Reverse Flow SOAP Service

A high-performance, robust, and secure Reverse Flow SOAP Service built with **Node.js**, **TypeScript**, **Express**, **Prisma ORM**, and **MySQL**.

This service implements the vendor-side specification documented in **"Reverse Flow: Instruction document"** for **Zong BOSS Integration**.

---

## 📋 Table of Contents
- [Architecture Overview](#architecture-overview)
- [Endpoint & WSDL](#endpoint--wsdl)
- [Request & Response Specification](#request--response-specification)
- [Response Codes](#response-codes)
- [Local Setup & Running](#local-setup--running)
- [Testing & Verification](#testing--verification)
- [Sample Curl Commands](#sample-curl-commands)
- [Production Deployment](#production-deployment)

---

## 🏗 Architecture Overview

When subscription or unsubscription requests originate from Zong BOSS (e.g. via **CRM helpline (18)** or **My Zong App - MZA (19)**), Zong BOSS invokes this service via SOAP.

```
Zong BOSS System (CRM 18, MZA 19)
               │
               ▼ (SOAP 1.1 POST /api/zong)
┌─────────────────────────────────────────────────────────────┐
│                 Zong Reverse Flow Service                   │
│                                                             │
│  [1] Security & Headers Middleware                          │
│  [2] Dynamic WSDL Serving (/api/zong?wsdl)                  │
│  [3] XML Parser & Sanitizer (Namespace-agnostic)            │
│  [4] Strict Parameter Validation (-1, -2, -3)               │
│  [5] Business Logic & Duplicate Prevention (0, 2, 3)        │
│  [6] Prisma ORM + MySQL Database                            │
│  [7] Asynchronous Audit Logging (reverse_flow_logs)         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🌐 Endpoint & WSDL

- **WSDL URL:** `http://<HOST>:<PORT>/api/zong?wsdl`
- **SOAP Endpoint:** `http://<HOST>:<PORT>/api/zong`
- **Health Check:** `http://<HOST>:<PORT>/health`
- **Subscriber Query (Internal):** `http://<HOST>:<PORT>/api/subscribers/:msisdn`

---

## 📑 Request & Response Specification

### 1. Request Envelope (`secp:subunsub`)
```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:secp="http://www.example.org/secp/">
  <soapenv:Header/>
  <soapenv:Body>
    <secp:subunsub>
      <Msisdn>923001234567</Msisdn>
      <IdChannel>18</IdChannel>
      <IdChannelOption>1</IdChannelOption>
      <IdService>1</IdService>
      <IdBundle>95006464</IdBundle>
      <Timestamp>20261125160000</Timestamp>
    </secp:subunsub>
  </soapenv:Body>
</soapenv:Envelope>
```

| Field | Type | Requirement | Description / Expected Value |
|---|---|---|---|
| `Msisdn` | string | Mandatory | Customer MSISDN in `92xxxxxxxxxx` format |
| `IdService` | string | Mandatory | Service ID / Code (`1` - For All Vendors) |
| `IdChannel` | string | Mandatory | `18` (CRM) or `19` (MZA) |
| `IdChannelOption` | string | Mandatory | `1` (Subscription) or `2` (Un-Subscription) |
| `IdBundle` | string | Optional | Bundle identifier / Promo ID |
| `Timestamp` | string | Mandatory | Format `yyyymmddhhmmss` (14 numeric digits) |

### 2. Response Envelope (`secp:subUnsubResponse`)
```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:secp="http://www.example.org/secp/">
  <soapenv:Header/>
  <soapenv:Body>
    <secp:subUnsubResponse>
      <Code>0</Code>
      <Description>success</Description>
    </secp:subUnsubResponse>
  </soapenv:Body>
</soapenv:Envelope>
```

---

## 🔢 Response Codes

| Code | Description | Scenario |
|:---:|---|---|
| `0` | `success` | Subscription or Un-subscription successfully processed |
| `2` | `Already Subscribed` | Received subscription request (`IdChannelOption=1`) for an already active subscriber |
| `3` | `Already Unsubscribed` | Received un-subscription request (`IdChannelOption=2`) for an already inactive/non-existent subscriber |
| `-1` | `Missing Parameters` | Any mandatory parameter (`Msisdn`, `IdService`, `IdChannel`, `IdChannelOption`, `Timestamp`) is missing or empty |
| `-2` | `Invalid IdService` | `IdService` is not equal to `1` |
| `-3` | `Invalid Parameters` | `Msisdn` format invalid, `IdChannelOption` not `1` or `2`, `IdChannel` not `18`/`19`, or `Timestamp` not 14 digits |
| `1` | `Internal error` | Database or unhandled system failure |

---

## 🚀 Local Setup & Running

### 1. Prerequisites
- Node.js (v18+)
- Docker Desktop (for MySQL)

### 2. Start MySQL via Docker
Run a single standalone MySQL container (no docker-compose needed):
```bash
docker run -d --name zong-reverse-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=zong_sub_unsub -p 3308:3306 mysql:8.0
```

### 3. Install Dependencies & Setup Database
```bash
npm install
npx prisma db push
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Build & Run Production Server
```bash
npm run build
npm start
```

---

## ⚡ PM2 Production Deployment (Team Lead Guide)

This application is fully production-ready and optimized for **PM2 Process Manager** with cluster mode and graceful shutdown support (`SIGINT`/`SIGTERM`).

### Step 1: Install dependencies and generate Prisma client
```bash
npm install --production=false
npx prisma db push
```

### Step 2: Build TypeScript into `dist/`
```bash
npm run build
```

### Step 3: Start with PM2
Using the included `ecosystem.config.js`:
```bash
# Cluster mode (uses all CPU cores for high performance)
pm2 start ecosystem.config.js --env production

# Or standalone simple PM2 command
pm2 start dist/index.js --name "zong-reverse-flow"
```

### PM2 Monitoring Commands:
```bash
pm2 status
pm2 logs zong-reverse-flow
pm2 reload zong-reverse-flow   # Zero-downtime graceful reload
pm2 restart zong-reverse-flow
pm2 stop zong-reverse-flow
```

---

## 🧪 Testing & Verification

Run the automated integration test suite covering all 8 response codes, database persistence, and audit logging:
```bash
npm run test:integration
```

---

## 📡 Sample Curl Commands for Testing

### 1. Retrieve WSDL
```bash
curl -i -X GET 'http://localhost:8089/api/zong?wsdl'
```

### 2. Subscribe (Success -> Code 0)
```bash
curl -i -X POST 'http://localhost:8089/api/zong' \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: "http://www.example.org/secp/subunsub"' \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:secp="http://www.example.org/secp/">
  <soapenv:Header/>
  <soapenv:Body>
    <secp:subunsub>
      <Msisdn>923001234567</Msisdn>
      <IdChannel>18</IdChannel>
      <IdChannelOption>1</IdChannelOption>
      <IdService>1</IdService>
      <IdBundle>95006464</IdBundle>
      <Timestamp>20261125160000</Timestamp>
    </secp:subunsub>
  </soapenv:Body>
</soapenv:Envelope>'
```

### 3. Duplicate Subscribe (Already Subscribed -> Code 2)
Run the exact same command above again.

### 4. Unsubscribe (Success -> Code 0)
```bash
curl -i -X POST 'http://localhost:8089/api/zong' \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: "http://www.example.org/secp/subunsub"' \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:secp="http://www.example.org/secp/">
  <soapenv:Header/>
  <soapenv:Body>
    <secp:subunsub>
      <Msisdn>923001234567</Msisdn>
      <IdChannel>18</IdChannel>
      <IdChannelOption>2</IdChannelOption>
      <IdService>1</IdService>
      <IdBundle>95006464</IdBundle>
      <Timestamp>20261125160500</Timestamp>
    </secp:subunsub>
  </soapenv:Body>
</soapenv:Envelope>'
```

### 5. Duplicate Unsubscribe (Already Unsubscribed -> Code 3)
Run the unsubscription command above again.

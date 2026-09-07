### 1. `rfq-comparator/README.md`

```markdown
# RFQ Comparator - SAP CAP Backend Service

An SAP Cloud Application Programming (CAP) model application designed to automate vendor quote processing, compare competing bids, and manage line-item extraction reviews powered by SAP Integration Suite and Google Gemini.
```
<img width="1917" height="865" alt="image" src="https://github.com/user-attachments/assets/425164cf-9390-4936-a972-2173d0937f2e" />

---

## 📌 Project Tracker

### Completed
- ~~Design CDS entities (`RFQs`, `Quotes`, `QuoteLineItems`, `Vendors`)~~
- ~~Provide seed data (`csv`) for initial RFQs, bearing materials, and suppliers~~
- ~~Implement `uploadQuote` action with validation and UUID generation~~
- ~~Set initial quote status to `PROCESSING`~~
- ~~Establish BTP XSUAA `client_credentials` authentication to SAP Integration Suite~~
- ~~Handle synchronous HTTP 200 extraction responses from the iFlow~~
- ~~Persist extracted line items directly into SQLite database~~
- ~~Implement status assignment (`READY` vs `NEEDS_REVIEW` based on confidence score threshold of 0.80)~~
- ~~Implement `reviewLineItem` action to allow buyer overrides and auto-promote quote to `READY`~~
- ~~Implement `compareRFQ` multi-criteria weighted scoring algorithm (Price, Lead Time, Quality)~~

### Backlog & Future Enhancements
- [ ] Migrate local SQLite database to SAP HANA Cloud container (`cds deploy --to hana`)
- [ ] Build SAP Fiori Elements UI application on top of RFQ service entities
- [ ] Implement draft-enabled OData V4 annotations for interactive line item editing
- [ ] Replace `.env` credentials with BTP Destination Service binding
- [ ] Add automated unit and integration tests using `@sap/cds-jest` or Mocha

---

## 🏗 Architecture Overview


```

[Client / UI]
│
▼ (OData V4)
[CAP Service: srv/rfq-service.cjs]
│
├─► [Database (SQLite / HANA)]
│         Stores RFQs, Quotes, QuoteLineItems, Vendors
│
└─► [SAP Integration Suite iFlow]
Sends: { quoteId, rfqId, vendorId, documentUrl }
Receives: { status, totalAmount, lineItems: [...] }

```

---

## ⚙️ Prerequisites & Setup

1. **Node.js**: v18.x or v20.x LTS
2. **SAP CDS Development Kit**:
   ```bash
   npm install -g @sap/cds-dk

```

3. **Install Dependencies**:
```bash
cd rfq-comparator
npm install

```


4. **Configure Environment (`.env`)**:
Create a `.env` file in the project root:
```env
IFLOW_URL=https://<your-cpi-runtime-domain>/http/quote/ingest
IFLOW_TOKEN_URL=https://<your-subaccount>.authentication.<region>[.hana.ondemand.com/oauth/token](https://.hana.ondemand.com/oauth/token)
IFLOW_CLIENT_ID=<your-service-key-clientid>
IFLOW_CLIENT_SECRET=<your-service-key-clientsecret>
TOKEN=<optional-static-or-basic-auth-token>

```



---

## 🚀 Running the Application

Start the CAP server with live reload:

```bash
cds watch

```

Explore endpoints:

* **Service Base**: `http://localhost:4004/rfq`
* **Metadata**: `http://localhost:4004/rfq/$metadata`
* **Entities**:
* `/rfq/RFQs`
* `/rfq/Quotes`
* `/rfq/QuoteLineItems`
* `/rfq/Vendors`



---

## 🧪 Testing the Ingestion Endpoint

Trigger quote processing via cURL:

```bash
curl -X POST http://localhost:4004/rfq/uploadQuote \
  -H "Content-Type: application/json" \
  -d '{
    "rfqId": "c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1",
    "vendorId": "v1111111-1111-1111-1111-111111111111",
    "documentUrl": "[https://raw.githubusercontent.com/shahilsinghyadav/rfq-comparator/main/test-quotes/apex-quote.txt](https://raw.githubusercontent.com/shahilsinghyadav/rfq-comparator/main/test-quotes/apex-quote.txt)"
  }'

```

---

## 📊 Comparison Logic Example

Execute multi-criteria quote evaluation:

```bash
curl -X POST http://localhost:4004/rfq/compareRFQ \
  -H "Content-Type: application/json" \
  -d '{
    "rfqId": "c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1",
    "weights": {
      "priceWeight": 0.50,
      "leadTimeWeight": 0.30,
      "qualityWeight": 0.20
    }
  }'

```

```

---

### 2. `RFQ_AI_Core_Integration/README.md`

```markdown
# RFQ AI Core Integration - SAP Integration Suite iFlow

Cloud Integration Flow (`Process_Vendor_Quote`) designed to ingest vendor quote documents from a URL, extract line items and pricing using Google Gemini 2.5 Flash, compute confidence scores, and return structured extraction payloads to SAP CAP.
```
# Refer to https://github.com/shahilsinghyadav/RFQ_AI_Core_Integration for further AI logic

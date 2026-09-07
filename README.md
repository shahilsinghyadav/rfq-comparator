### 1. `rfq-comparator/README.md`

```markdown
# RFQ Comparator - SAP CAP Backend Service

An SAP Cloud Application Programming (CAP) model application designed to automate vendor quote processing, compare competing bids, and manage line-item extraction reviews powered by SAP Integration Suite and Google Gemini.
```
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

---

## 📌 Project Tracker

### Completed
- ~~Configure HTTPS Sender adapter with `/quote/ingest` endpoint~~
- ~~Set up role-based security (`ESBMessaging.send`) and disable CSRF protection for REST calls~~
- ~~Develop Groovy script (`script1.groovy`) to download document text with mock fallback~~
- ~~Strip Apache Camel internal headers (`CamelHttpUri`, `CamelHttpPath`) to avoid target URL override errors~~
- ~~Formulate Gemini REST JSON payload schema using `responseMimeType: "application/json"`~~
- ~~Configure HTTP Receiver adapter for Google Gemini 2.5 Flash endpoint~~
- ~~Develop Groovy script (`script2.groovy`) to parse model candidates and extract line items~~
- ~~Implement confidence threshold evaluation (< 0.80 flags `NEEDS_REVIEW`, otherwise `READY`)~~
- ~~Assemble synchronous HTTP 200 response containing `{ status, totalAmount, lineItems }` back to CAP~~

### Backlog & Future Enhancements
- [ ] Store Gemini API key in SAP Integration Suite Security Material (`Secure Store`) instead of URL/query parameter
- [ ] Integrate Apache PDFBox or PDF parsing library in Groovy to extract raw binary PDF documents directly
- [ ] Add an Exception Subprocess to catch external timeouts and return formatted error payloads
- [ ] Replace public raw text URLs with SAP BTP Object Store Service (AWS S3 / Azure Blob) integration
- [ ] Automate iFlow packaging and CI/CD promotion across SAP BTP subaccounts

---

## 📐 Integration Pipeline


```

[Inbound: CAP HTTPS POST]
│
▼
[Groovy: script1.groovy] ──────► Downloads document text from documentUrl
│
▼
[Content Modifier: Clear Headers & Set Payload]
│  - Deletes CamelHttp* headers
│  - Formats Gemini REST JSON body
▼
[Local Integration Process: Call Gemini]
│
├──► [HTTP Receiver POST to Google Gemini 2.5 Flash]
│
└──► [Groovy: script2.groovy]
│
▼ Evaluates confidence & builds lineItems array
[Content Modifier: Format Response]
│
▼
[End Event: Returns HTTP 200 JSON to CAP]

```

---

## 🔧 Component Configuration Reference

| Component / Step | Type | Configuration Details |
| :--- | :--- | :--- |
| **Sender Channel** | HTTPS | Address: `/quote/ingest`<br>Authorization: `User Role`<br>User Role: `ESBMessaging.send`<br>CSRF Protected: `Disabled` |
| **Download Document** | Groovy Script (`script1.groovy`) | Ingests inbound body, downloads file bytes via `java.net.URL`, and writes plain text to `extractedDocText` property. |
| **Set LLM Parameters** | Content Modifier | Header: `Content-Type = application/json`<br>Header Delete: `CamelHttp*`, `CamelServletContextPath`<br>Body: Gemini REST format with `responseMimeType: application/json` |
| **Call LLM API** | HTTP Receiver | Address: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=<API_KEY>`<br>Method: `POST` |
| **Extract Response** | Groovy Script (`script2.groovy`) | Parses `candidates[0].content.parts[0].text`, computes `totalAmount`, assesses confidence (< 0.80 flag), outputs `lineItemsPayload`. |
| **Set Final Status** | Content Modifier | Body: `{ "status": "${property.finalStatus}", "totalAmount": ${property.totalAmount}, "lineItems": ${property.lineItemsPayload} }` |

---

## 📂 Repository Contents

* `Process_Vendor_Quote.zip`: Complete iFlow package ready to be uploaded and deployed in SAP Integration Suite.
* `scripts/`:
  * `script1.groovy`: Document fetch and inbound parameter parsing.
  * `script2.groovy`: Gemini output parser, scoring logic, and payload generator.
* `samples/`: Sample quote documents used for pipeline testing and scoring validation.

---

## 📥 Deployment Instructions

1. Open your **SAP Integration Suite** web workspace.
2. Navigate to **Design** $\rightarrow$ **Integrations and APIs**.
3. Select your Target Package (or create a new one).
4. Click **Edit** $\rightarrow$ **Add** $\rightarrow$ **Integration Flow** $\rightarrow$ **Upload**.
5. Upload `Process_Vendor_Quote.zip`.
6. Configure the Gemini API key in the connection step.
7. Click **Save** and **Deploy**.
8. Verify under **Monitor** $\rightarrow$ **Manage Integration Content** that the status transitions to **Started**.

```

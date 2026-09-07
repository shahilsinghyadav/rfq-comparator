namespace my.rfq;

using { cuid, managed } from '@sap/cds/common';

// Organization / Tenant Boundary
entity Orgs : cuid, managed {
  name        : String(100) not null;
  code        : String(20) not null;
  rfqs        : Association to many RFQs on rfqs.org = $self;
  vendors     : Association to many Vendors on vendors.org = $self;
}

// Vendor Master Data
entity Vendors : cuid, managed {
  org         : Association to Orgs not null;
  name        : String(100) not null;
  email       : String(100);
  rating      : Decimal(3, 2); // Historical supplier score 0.00 - 5.00
  quotes      : Association to many Quotes on quotes.vendor = $self;
}

// RFQ Header
entity RFQs : cuid, managed {
  org         : Association to Orgs not null;
  title       : String(200) not null;
  description : String(1000);
  status      : String(20) default 'OPEN'; // OPEN, IN_EVALUATION, CLOSED
  targetDate  : Date;
  lineItems   : Composition of many RFQLineItems on lineItems.rfq = $self;
  quotes      : Association to many Quotes on quotes.rfq = $self;
}

// Required Line Items in RFQ
entity RFQLineItems : cuid, managed {
  rfq             : Association to RFQs not null;
  itemNumber      : Integer not null;
  materialNumber  : String(50) not null;
  description     : String(255);
  targetQuantity  : Decimal(15, 2) not null;
  uom             : String(10) default 'EA';
}

// Vendor Submitted Quote Header
entity Quotes : cuid, managed {
  rfq             : Association to RFQs not null;
  vendor          : Association to Vendors not null;
  documentUrl     : String(1024) not null;
  status          : String(30) default 'PROCESSING'; // PROCESSING, EXTRACTED, NEEDS_REVIEW, READY, COMPARED
  totalAmount     : Decimal(15, 2);
  currency        : String(3) default 'USD';
  rawExtractedJson: LargeString; // Raw LLM extraction dump
  lineItems       : Composition of many QuoteLineItems on lineItems.quote = $self;
  documents       : Composition of many QuoteDocumentChunks on documents.quote = $self;
}

// Parsed Line Items with Confidence Metadata
entity QuoteLineItems : cuid, managed {
  quote           : Association to Quotes not null;
  itemNumber      : Integer;
  materialNumber  : String(50);
  description     : String(255);
  quantity        : Decimal(15, 2);
  unitPrice       : Decimal(15, 2);
  leadTimeDays    : Integer;
  
  // RAG / Extraction Quality Flags
  confidenceScore : Decimal(3, 2); // 0.00 to 1.00
  needsReview     : Boolean default false;
  isReviewed      : Boolean default false;
  reviewNotes     : String(500);
}

// Document Chunks (for HANA Cloud Vector Engine RAG in Week 3)
entity QuoteDocumentChunks : cuid {
  quote           : Association to Quotes not null;
  chunkIndex      : Integer;
  content         : LargeString;
  // Use String for local SQLite dev; compile to REAL_VECTOR in HANA Cloud later
  embedding       : LargeString; 
}
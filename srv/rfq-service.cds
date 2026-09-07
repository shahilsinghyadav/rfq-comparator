using { my.rfq as db } from '../db/schema';

service RFQService @(path: '/rfq', impl: './rfq-service.cjs'){

    // Read-write access to core business objects
    @odata.draft.enabled: false
    entity Orgs             as projection on db.Orgs;
    entity Vendors          as projection on db.Vendors;
    entity RFQs             as projection on db.RFQs;
    entity RFQLineItems     as projection on db.RFQLineItems;
    entity Quotes           as projection on db.Quotes;
    entity QuoteLineItems   as projection on db.QuoteLineItems;

    // Type definitions for action inputs/outputs
    type UploadQuoteResponse {
        quoteId       : UUID;
        status        : String;
        message       : String;
    };

    type WeightOverride {
        priceWeight    : Decimal(3, 2);
        leadTimeWeight : Decimal(3, 2);
        qualityWeight  : Decimal(3, 2);
    };

    type CompareResult {
        quoteId       : UUID;
        vendorName    : String;
        totalPrice    : Decimal(15, 2);
        avgLeadTime   : Integer;
        compositeScore: Decimal(5, 2);
        rank          : Integer;
    };

    // Core Business Actions
    action uploadQuote (
        rfqId         : UUID,
        vendorId      : UUID,
        documentUrl   : String
    ) returns UploadQuoteResponse;

    action reviewLineItem (
        lineItemId    : UUID,
        correctedPrice: Decimal(15, 2),
        correctedQty  : Integer,
        correctedLeadTime: Integer,
        comment       : String
    ) returns QuoteLineItems;

    action compareRFQ (
        rfqId         : UUID,
        weights       : WeightOverride
    ) returns array of CompareResult;
}
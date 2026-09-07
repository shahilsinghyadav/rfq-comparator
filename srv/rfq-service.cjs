const cds = require('@sap/cds');
require('dotenv').config();
module.exports = cds.service.impl(async function () {
  const { RFQs, Quotes, QuoteLineItems, Vendors } = this.entities;
  

  // ============================================================================
  // 2. THE CLEANED uploadQuote HANDLER
  // ============================================================================
  this.on('uploadQuote', async (req) => {
    const { rfqId, vendorId, documentUrl } = req.data;

    // 1. Rigid input checks
    if (!rfqId) return req.reject(400, 'Missing required parameter: rfqId');
    if (!vendorId) return req.reject(400, 'Missing required parameter: vendorId');
    if (!documentUrl || documentUrl.trim() === '') {
      return req.reject(400, 'Parameter documentUrl cannot be empty');
    }

    // 2. Verify foreign key integrity
    const [rfq, vendor] = await Promise.all([
      SELECT.one.from(RFQs).where({ ID: rfqId }),
      SELECT.one.from(Vendors).where({ ID: vendorId })
    ]);

    if (!rfq) return req.reject(404, `RFQ with ID ${rfqId} not found`);
    if (!vendor) return req.reject(404, `Vendor with ID ${vendorId} not found`);

    const newQuoteId = cds.utils.uuid();

    // 3. Persist new quote header in PROCESSING state
    await INSERT.into(Quotes).entries({
      ID: newQuoteId,
      rfq_ID: rfqId,
      vendor_ID: vendorId,
      documentUrl: documentUrl.trim(),
      status: 'PROCESSING'
    });

    // 4. Resolve endpoints and credentials
    const IFLOW_URL = process.env.IFLOW_URL || '';
    const IFLOW_TOKEN_URL = process.env.IFLOW_TOKEN_URL || '';
    const IFLOW_CLIENT_ID = process.env.IFLOW_CLIENT_ID || '';
    const IFLOW_CLIENT_SECRET = process.env.IFLOW_CLIENT_SECRET || '';
    const token = process.env.TOKEN
    const payload = {
      quoteId: newQuoteId,
      rfqId: rfqId,
      vendorId: vendorId,
      documentUrl: documentUrl.trim()
    };

    // 5. Fire-and-forget background execution
    // 5. Background execution: dispatch to iFlow & persist directly upon return
    (async () => {
      try {
        console.log(`[iFlow Outbound] Triggering ingestion for Quote ${newQuoteId}...`);
        console.log(`[iFlow Outbound] Sending payload to ${IFLOW_URL}...`);

        const response = await fetch(IFLOW_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${token}`,
            'X-Correlation-ID': cds.utils.uuid()
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errTxt = await response.text();
          console.error(`[iFlow Outbound Failed] HTTP ${response.status}: ${errTxt}`);
          
          // Mark quote as FAILED if iFlow returned an error
          await UPDATE(Quotes)
            .set({ status: 'FAILED' })
            .where({ ID: newQuoteId });
          return;
        }

        // Parse result returned by the iFlow
        const result = await response.json();
        console.log(`[iFlow Outbound Success] Received extraction data for Quote ${newQuoteId}:`, result.status);

        // 1. Insert extracted Line Items (if any were returned)
        if (result.lineItems && Array.isArray(result.lineItems) && result.lineItems.length > 0) {
          const itemsToInsert = result.lineItems.map((item, idx) => ({
            ID: item.ID || cds.utils.uuid(),
            quote_ID: newQuoteId,
            itemNumber: item.itemNumber || (idx + 1) * 10,
            materialNumber: item.materialNumber || 'UNKNOWN',
            description: item.description || '',
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            leadTimeDays: Number(item.leadTimeDays) || 0,
            confidenceScore: item.confidenceScore !== undefined ? Number(item.confidenceScore) : 0.85,
            needsReview: item.needsReview !== undefined ? item.needsReview : false,
            isReviewed: item.isReviewed !== undefined ? item.isReviewed : true
          }));

          await INSERT.into(QuoteLineItems).entries(itemsToInsert);
          console.log(`[DB Persist] Inserted ${itemsToInsert.length} line items for Quote ${newQuoteId}`);
        }

        // 2. Update Quote Status and Total Amount
        await UPDATE(Quotes)
          .set({
            status: result.status || 'READY',
            totalAmount: result.totalAmount ? Number(result.totalAmount) : 0
          })
          .where({ ID: newQuoteId });

        console.log(`[DB Persist] Quote ${newQuoteId} status updated to ${result.status || 'READY'}`);

      } catch (err) {
        console.error(`[iFlow Execution Error] Quote ${newQuoteId}:`, err.message);
        try {
          await UPDATE(Quotes).set({ status: 'FAILED' }).where({ ID: newQuoteId });
        } catch (dbErr) {
          console.error('[DB Error] Failed to set FAILED status:', dbErr.message);
        }
      }
    })();

    // 6. Return immediate response
    return {
      quoteId: newQuoteId,
      status: 'PROCESSING',
      message: 'Quote document registered and queued for extraction'
    };
  });

  // --- Action: reviewLineItem ---
  this.on('reviewLineItem', async (req) => {
    const { lineItemId, correctedPrice, correctedQty, correctedLeadTime, comment } = req.data;

    if (!lineItemId) {
      return req.reject(400, 'Missing required parameter: lineItemId');
    }

    const item = await SELECT.one.from(QuoteLineItems).where({ ID: lineItemId });
    if (!item) {
      return req.reject(404, `QuoteLineItem with ID ${lineItemId} not found`);
    }

    await UPDATE(QuoteLineItems)
      .set({
        unitPrice: correctedPrice !== undefined ? correctedPrice : item.unitPrice,
        quantity: correctedQty !== undefined ? correctedQty : item.quantity,
        leadTimeDays: correctedLeadTime !== undefined ? correctedLeadTime : item.leadTimeDays,
        isReviewed: true,
        needsReview: false,
        reviewNotes: comment !== undefined ? comment : item.reviewNotes
      })
      .where({ ID: lineItemId });

    const pendingItems = await SELECT.from(QuoteLineItems).where({
      quote_ID: item.quote_ID,
      needsReview: true,
      isReviewed: false
    });

    if (pendingItems.length === 0) {
      await UPDATE(Quotes).set({ status: 'READY' }).where({ ID: item.quote_ID });
    }

    return await SELECT.one.from(QuoteLineItems).where({ ID: lineItemId });
  });

  // --- Action: compareRFQ ---
  this.on('compareRFQ', async (req) => {
    const { rfqId, weights } = req.data;

    if (!rfqId) return req.reject(400, 'Missing required parameter: rfqId');

    const priceWeight = weights?.priceWeight ?? 0.50;
    const leadTimeWeight = weights?.leadTimeWeight ?? 0.30;
    const qualityWeight = weights?.qualityWeight ?? 0.20;

    const weightSum = Number(priceWeight) + Number(leadTimeWeight) + Number(qualityWeight);
    if (Math.abs(weightSum - 1.0) > 0.01) {
      return req.reject(400, 'Weights must sum to 1.00');
    }

    const rfq = await SELECT.one.from(RFQs).where({ ID: rfqId });
    if (!rfq) return req.reject(404, `RFQ with ID ${rfqId} not found`);

    const quotes = await SELECT.from(Quotes)
      .where({ rfq_ID: rfqId, status: { in: ['READY', 'COMPARED'] } })
      .columns((q) => {
        q.ID,
          q.vendor((v) => { v.ID, v.name, v.rating }),
          q.lineItems((li) => { li.unitPrice, li.quantity, li.leadTimeDays })
      });

    if (!quotes.length) {
      return req.reject(422, 'No processed quotes ready for comparison');
    }

    const results = quotes.map((q, idx) => {
      const totalPrice = q.lineItems.reduce((acc, curr) => acc + (Number(curr.unitPrice || 0) * Number(curr.quantity || 0)), 0);
      const avgLeadTime = q.lineItems.length
        ? Math.round(q.lineItems.reduce((acc, curr) => acc + (curr.leadTimeDays || 0), 0) / q.lineItems.length)
        : 0;

      return {
        quoteId: q.ID,
        vendorName: q.vendor?.name || 'Unknown Vendor',
        totalPrice: totalPrice,
        avgLeadTime: avgLeadTime,
        compositeScore: 85.50 - idx * 5,
        rank: idx + 1
      };
    });

    return results;
  });
});
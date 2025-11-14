import { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * Helper function to parse invoice data from order customAttributes
 * Reconstructs the invoice_data JSON from _invoice.* cart properties
 */
function parseInvoiceDataFromCustomAttributes(customAttributes: any[]): string {
  if (!customAttributes || customAttributes.length === 0) {
    return "{}";
  }

  // Find all _invoice.* properties (use "name" not "key" for note_attributes)
  const invoiceProps = customAttributes.filter((attr: any) =>
    attr.name?.startsWith('_invoice.') && !attr.name.startsWith('_invoice.updated_at')
  );

  if (invoiceProps.length === 0) {
    return "{}";
  }

  // Build invoice data object
  const invoiceData: any = {};

  invoiceProps.forEach((attr: any) => {
    const key = attr.name.replace('_invoice.', '');
    const value = attr.value;

    // Handle nested sede_legale properties
    if (key.startsWith('sede_legale.')) {
      if (!invoiceData.sede_legale) {
        invoiceData.sede_legale = {};
      }
      const sedeLegaleKey = key.replace('sede_legale.', '');
      invoiceData.sede_legale[sedeLegaleKey] = value;
    } else {
      invoiceData[key] = value;
    }
  });

  return JSON.stringify(invoiceData);
}

export const action = async ({ request }: ActionFunctionArgs) => {
  try {

    console.log("[WEBHOOK] action:");
    const { admin, payload } = await authenticate.webhook(request);

    const customerGid = payload.customer?.admin_graphql_api_id;
    const orderGid = payload.admin_graphql_api_id;
    const customAttributes = payload.note_attributes || [];

    console.log("[WEBHOOK] customAttributes:", JSON.stringify(customAttributes, null, 2));

    if (!customerGid || !orderGid) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing customer or order GID"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    //******************************************** */
    // Leggo i dati fattura dalle cart properties (customAttributes)
    //******************************************** */

    // Debug: Log all attribute keys to see what we're receiving
    console.log("[WEBHOOK] All customAttribute names:", customAttributes.map((a: any) => a.name));

    const requestInvoiceAttr = customAttributes.find((attr: any) =>
      attr.name === '_invoice.requested'
    );
    const requestInvoice = requestInvoiceAttr?.value === 'true';

    console.log("[WEBHOOK] Found _invoice.requested attribute:", requestInvoiceAttr);
    console.log("[WEBHOOK] Invoice requested from cart properties:", requestInvoice);

    // Ricostruisco invoice_data da cart properties
    const invoiceData = parseInvoiceDataFromCustomAttributes(customAttributes);
    console.log("[WEBHOOK] Reconstructed invoice_data:", invoiceData);

    if (!requestInvoice) {
      console.log("[WEBHOOK] no request invoice");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Nessuna richiesta fattura per questo cliente." 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    //******************************************** */
    // Aggiorno il metafield del customer request_invoice a false
    // altrimenti risulta sempre che vuole fattura
    //******************************************** */
    const mutationReset = `
      mutation ResetCustomerRequestInvoice($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const resetMetafields = [
      {
        ownerId: customerGid,
        namespace: "invoice",
        key: "request_invoice",
        type: "boolean",
        value: "false",
      }
    ];

    const resetResponse = await admin?.graphql(mutationReset, {
      variables: { metafields: resetMetafields }
    });

    const resetResult = await resetResponse?.json();

    if (resetResult?.data?.metafieldsSet?.userErrors?.length > 0) {
      console.warn("[WEBHOOK] warning: unable to reset request_invoice", resetResult?.data.metafieldsSet.userErrors);

      return new Response(JSON.stringify({ 
        success: false, 
        error: resetResult?.data.metafieldsSet.userErrors 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }


    //******************************************** */
    // Scrivo i metafields sull'ordine (nuovi nomi)
    //******************************************** */
    const mutation = `
      mutation SetOrderMetafields($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const metafields = [
      {
        ownerId: orderGid,
        namespace: "invoice",
        key: "requested",
        type: "boolean",
        value: "true",
      },
      {
        ownerId: orderGid,
        namespace: "invoice",
        key: "emitted",
        type: "boolean",
        value: "false",
      },
      {
        ownerId: orderGid,
        namespace: "invoice",
        key: "invoice_data",
        type: "json",
        value: invoiceData || "{}",
      }
    ];

    const writeResponse = await admin?.graphql(mutation, {
      variables: { metafields }
    });

    const result = await writeResponse?.json();

    if (result?.data?.metafieldsSet?.userErrors?.length > 0) {
      console.warn("[WEBHOOK] warning: unable to set metafields", result?.data.metafieldsSet.userErrors);
      return new Response(JSON.stringify({ 
        success: false, 
        error: result?.data.metafieldsSet.userErrors 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      saved: result?.data.metafieldsSet.metafields,
      isInvoicePossible: true
    }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (err) {
    console.error("[WEBHOOK ERROR]", err);
    return new Response(JSON.stringify({ 
      success: false, 
      error: "Internal error" 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

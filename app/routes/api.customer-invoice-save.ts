import { authenticate } from '../shopify.server';

// 👇 GESTIONE OPTIONS (preflight CORS)
export const loader = async ({ request }: { request: Request }) => {

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
  });
};

export const action = async ({ request }: { request: Request }) => {
  const { admin } = await authenticate.admin(request);
  const { customerId, values } = await request.json();

  console.log("[INVOICE-DATA-SAVE] Payload ricevuto:", customerId, values);
  if (!customerId || !values) {
    return new Response(JSON.stringify({ success: false, errors: 'Missing data' }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Determine required fields based on customer_type
  const customerType = values.customer_type || 'company';
  let requiredKeys: string[] = [];

  if (customerType === 'individual') {
    // Individual (Persona Fisica) - only codice_fiscale required
    requiredKeys = ['codice_fiscale'];
  } else {
    // Company (Società) - ragione sociale, partita_iva, codice_fiscale, sede legale required
    requiredKeys = [
      'ragione_sociale',
      'partita_iva',
      'codice_fiscale',
      'sede_legale_via',
      'sede_legale_cap',
      'sede_legale_citta',
      'sede_legale_provincia'
    ];
  }

  const missingFields = requiredKeys.filter((k) => !values[k]);

  // Map metafields with correct types (excluding invoice_data and request_invoice which are handled separately)
  const metafieldsInput = Object.entries(values)
    .filter(([key, value]) => key !== 'invoice_data' && key !== 'request_invoice')
    .map(([key, value]) => ({
      ownerId: `gid://shopify/Customer/${customerId}`,
      namespace: "invoice",
      key,
      type: "single_line_text_field",
      value: String(value),
    }));

  // Structure invoice_data JSON based on customer type
  let invoiceData: any = {
    customer_type: customerType,
    codice_fiscale: values.codice_fiscale,
  };

  // Add optional fields if present
  if (values.pec) invoiceData.pec = values.pec;
  if (values.codice_sdi) invoiceData.codice_sdi = values.codice_sdi;

  if (customerType === 'company') {
    // Company-specific fields
    invoiceData.ragione_sociale = values.ragione_sociale;
    invoiceData.partita_iva = values.partita_iva;

    // Nested sede_legale object
    invoiceData.sede_legale = {
      via: values.sede_legale_via,
      cap: values.sede_legale_cap,
      citta: values.sede_legale_citta,
      provincia: values.sede_legale_provincia,
    };
  }

  metafieldsInput.push({
    ownerId: `gid://shopify/Customer/${customerId}`,
    namespace: "invoice",
    key: "invoice_data",
    type: "json",
    value: JSON.stringify(invoiceData)
  });

  const mutation = `
    mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
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
  console.log("[INVOICE-DATA-SAVE] Mutazione:", mutation);
  console.log("[INVOICE-DATA-SAVE] Variables:", metafieldsInput);

  const response = await admin.graphql(mutation, {
    variables: { metafields: metafieldsInput },
  });

  const result = await response.json();
  console.log("[INVOICE-DATA-SAVE] Payload ricevuto:", result);

  console.log("[INVOICE-DATA-SAVE] errori:", result.data?.metafieldsSet?.userErrors);
  if (result.data?.metafieldsSet?.userErrors?.length > 0) {
    console.error("Metafield error:", result.data.metafieldsSet.userErrors);
    return new Response(JSON.stringify({ success: false, errors: result.data.metafieldsSet.userErrors }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return new Response(JSON.stringify({ 
    success: true, 
    saved: result.data.metafieldsSet.metafields, 
    missingFields, 
    values: values,
    isInvoicePossible: missingFields.length === 0 
  }), {
    status: 200,
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
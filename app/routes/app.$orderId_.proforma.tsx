import { useCallback } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, json } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Badge,
  Banner,
  BlockStack,
} from "@shopify/polaris";
import { PrintIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { Liquid } from "liquidjs";
import fs from "fs";
import path from "path";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const orderId = params.orderId;

  if (!orderId) {
    throw new Response("Order ID missing", { status: 400 });
  }

  const orderGid = `gid://shopify/Order/${orderId}`;

  try {
    // 1. Fetch Order Data with Customer metafields
    const orderQuery = `
      query GetOrderForProforma($id: ID!) {
        order(id: $id) {
          id
          name
          createdAt
          poNumber
          metafield_requested: metafield(namespace: "invoice", key: "requested") { value }
          metafield_order_invoice_data: metafield(namespace: "invoice", key: "invoice_data") { value }
          customer {
            id
            firstName
            lastName
            displayName
            email
            phone
            metafield_partita_iva: metafield(namespace: "invoice", key: "partita_iva") { value }
            metafield_codice_fiscale: metafield(namespace: "invoice", key: "codice_fiscale") { value }
            metafield_pec: metafield(namespace: "invoice", key: "pec") { value }
            metafield_sdi: metafield(namespace: "invoice", key: "codice_sdi") { value }
            metafield_ragione_sociale: metafield(namespace: "invoice", key: "ragione_sociale") { value }
            metafield_customer_type: metafield(namespace: "invoice", key: "customer_type") { value }
            metafield_sede_legale_via: metafield(namespace: "invoice", key: "sede_legale_via") { value }
            metafield_sede_legale_cap: metafield(namespace: "invoice", key: "sede_legale_cap") { value }
            metafield_sede_legale_citta: metafield(namespace: "invoice", key: "sede_legale_citta") { value }
            metafield_sede_legale_provincia: metafield(namespace: "invoice", key: "sede_legale_provincia") { value }
            metafield_invoice_data: metafield(namespace: "invoice", key: "invoice_data") { value }
          }
          billingAddress {
            address1
            address2
            city
            province
            zip
            country
            phone
          }
          shippingAddress {
            address1
            address2
            city
            province
            zip
            country
            phone
          }
          lineItems(first: 100) {
            edges {
              node {
                id
                title
                variantTitle
                sku
                quantity
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                discountedUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                taxLines {
                  rate
                  title
                }
                discountAllocations {
                  allocatedAmountSet {
                    shopMoney {
                      amount
                    }
                  }
                }
              }
            }
          }
          subtotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalShippingPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalTaxSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          paymentGatewayNames
          transactions( first: 10 ) {
            formattedGateway
            amount
            status
          }
        }
      }
    `;

    const orderResponse = await admin.graphql(orderQuery, {
      variables: { id: orderGid },
    });
    const orderResult = await orderResponse.json();
    
    if (!orderResult.data?.order) {
      throw new Response("Order not found", { status: 404 });
    }

    const order = orderResult.data.order;
console.log("LOG: " , order.transactions)
    // 2. Fetch Shop Data with Company metafields
    const shopQuery = `
      query GetShopData {
        shop {
          id
          name
          email
          myshopifyDomain
          billingAddress {
            address1
            address2
            city
            province
            zip
            country
          }
          metafield_partita_iva: metafield(namespace: "company", key: "partita_iva") { value }
          metafield_codice_fiscale: metafield(namespace: "company", key: "codice_fiscale") { value }
          metafield_rea: metafield(namespace: "company", key: "rea") { value }
          metafield_capitale_sociale: metafield(namespace: "company", key: "capitale_sociale") { value }
          metafield_pec: metafield(namespace: "company", key: "pec") { value }
          metafield_sdi: metafield(namespace: "company", key: "codice_sdi") { value }
        }
      }
    `;

    const shopResponse = await admin.graphql(shopQuery);
    const shopResult = await shopResponse.json();
    const shop = shopResult.data?.shop;

    console.log("shop", shop);

    // 3. Parse invoice_data from order (snapshot at purchase time)
    // Priority: order.invoice_data > customer.metafields
    let invoiceDataFromOrder: any = null;
    try {
      if (order.metafield_order_invoice_data?.value) {
        invoiceDataFromOrder = JSON.parse(order.metafield_order_invoice_data.value);
        console.log("[PROFORMA] Using invoice_data from order:", invoiceDataFromOrder);
      }
    } catch (e) {
      console.error("[PROFORMA] Error parsing order invoice_data:", e);
    }

    // Helper function to get invoice field with priority: order.invoice_data > customer.metafield
    const getInvoiceField = (fieldName: string) => {
      if (invoiceDataFromOrder && invoiceDataFromOrder[fieldName] !== undefined) {
        return invoiceDataFromOrder[fieldName];
      }
      const metafieldKey = `metafield_${fieldName}`;
      return order.customer?.[metafieldKey]?.value || null;
    };

    // Get sede_legale - can be nested in invoice_data or individual metafields
    const getSedeLegale = () => {
      if (invoiceDataFromOrder?.sede_legale) {
        return invoiceDataFromOrder.sede_legale;
      }
      // Fallback to individual metafields
      return {
        via: order.customer?.metafield_sede_legale_via?.value || null,
        cap: order.customer?.metafield_sede_legale_cap?.value || null,
        citta: order.customer?.metafield_sede_legale_citta?.value || null,
        provincia: order.customer?.metafield_sede_legale_provincia?.value || null,
      };
    };

    // 4. Prepare data for Liquid template (must match template structure)
    const liquidData = {
      order: {
        order_name: order.name,
        created_at: order.createdAt,
        po_number: order.poNumber || null,
        customer: {
          id: order.customer?.id || null,
          name: order.customer?.displayName || `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() || null,
          email: order.customer?.email || null,
          phone: order.customer?.phone || null,
          metafields: {
            invoice: {
              customer_type: getInvoiceField('customer_type') || 'company',
              ragione_sociale: getInvoiceField('ragione_sociale'),
              partita_iva: getInvoiceField('partita_iva'),
              codice_fiscale: getInvoiceField('codice_fiscale'),
              pec: getInvoiceField('pec'),
              codice_destinatario: getInvoiceField('codice_sdi'),
              sede_legale: getSedeLegale(),
            }
          }
        },
        billing_address: order.billingAddress
          ? {
              address1: order.billingAddress.address1,
              address2: order.billingAddress.address2,
              city: order.billingAddress.city,
              province: order.billingAddress.province,
              zip: order.billingAddress.zip,
              country: order.billingAddress.country,
              phone: order.billingAddress.phone,
            }
          : null,
        shipping_address: order.shippingAddress
          ? {
              address1: order.shippingAddress.address1,
              address2: order.shippingAddress.address2,
              city: order.shippingAddress.city,
              province: order.shippingAddress.province,
              zip: order.shippingAddress.zip,
              country: order.shippingAddress.country,
              phone: order.shippingAddress.phone,
            }
          : null,
        line_items: order.lineItems.edges.map((edge: any) => ({
          title: edge.node.title,
          variant_title: edge.node.variantTitle || "",
          sku: edge.node.sku || "",
          quantity: edge.node.quantity,
          original_price: edge.node.originalUnitPriceSet.shopMoney.amount,
          final_price: edge.node.discountedUnitPriceSet.shopMoney.amount,
          tax_lines: edge.node.taxLines || [],
          line_level_discount_allocations: edge.node.discountAllocations || [],
          final_line_price: (
            parseFloat(edge.node.discountedUnitPriceSet.shopMoney.amount) *
            edge.node.quantity
          ).toFixed(2),
        })),
        line_items_subtotal_price: order.subtotalPriceSet.shopMoney.amount,
        shipping_price: order.totalShippingPriceSet.shopMoney.amount,
        tax_price: order.totalTaxSet.shopMoney.amount,
        total_price: order.totalPriceSet.shopMoney.amount,
        discount_applications: [],
        total_refunded_amount: 0,
        net_payment: order.totalPriceSet.shopMoney.amount,
        total_net_amount: order.totalPriceSet.shopMoney.amount,
        gateway: order.transactions || null,
        payment_terms: null,
        currency: order.totalPriceSet.shopMoney.currencyCode,
      },
      shop: {
        name: shop.name,
        email: shop.email,
        address: shop.billingAddress
          ? {
              address1: shop.billingAddress.address1,
              address2: shop.billingAddress.address2,
              city: shop.billingAddress.city,
              province: shop.billingAddress.province,
              zip: shop.billingAddress.zip,
              country: shop.billingAddress.country,
            }
          : null,
        metafields: {
          company: {
            partita_iva: shop.metafield_partita_iva?.value || null,
            codice_fiscale: shop.metafield_codice_fiscale?.value || null,
            rea: shop.metafield_rea?.value || null,
            capitale_sociale: shop.metafield_capitale_sociale?.value || null,
            pec: shop.metafield_pec?.value || null,
            codice_sdi: shop.metafield_sdi?.value || null,
          }
        }
      },
    };

    console.log("liquidData", liquidData);


    // 4. Render Liquid template
    const engine = new Liquid();
    const templatePath = path.join(process.cwd(), "invoice-proforma-template.liquid");
    const templateContent = fs.readFileSync(templatePath, "utf8");

    // Register custom filters for Liquid
    engine.registerFilter("format_address", (address: any) => {
      if (!address) return "";
      const parts = [
        address.address1,
        address.address2,
        `${address.zip || ""} ${address.city || ""}`.trim(),
        address.province,
        address.country,
      ].filter(Boolean);
      return parts.join(", ");
    });

    engine.registerFilter("date", (value: string, format: string) => {
      const date = new Date(value);
      // Simple date formatting (dd/mm/yyyy)
      if (format.includes("%d/%m/%Y")) {
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      }
      return date.toLocaleDateString("it-IT");
    });

    engine.registerFilter("money", (value: string | number) => {
      const amount = typeof value === "string" ? parseFloat(value) : value;
      return `€${amount.toFixed(2).replace(".", ",")}`;
    });

    engine.registerFilter("payment_method", (gateway: string) => {
      if (!gateway) return "Da definire";
      
      const paymentMethods: Record<string, string> = {
        "cash": "Contanti",
        "manual": "Manuale",
        "bank_transfer": "Bonifico bancario",
        "shopify_payments": "Shopify Payments",
        "paypal": "PayPal",
        "stripe": "Carta di credito",
        "bogus": "Test (Bogus Gateway)",
      };
      
      const lowerGateway = gateway.toLowerCase();
      return paymentMethods[lowerGateway] || gateway;
    });

    const renderedHtml = await engine.parseAndRender(templateContent, liquidData);

    return json({
      renderedHtml,
      orderName: order.name,
      hasCompanyData: !!(
        shop.metafield_partita_iva?.value || shop.metafield_codice_fiscale?.value
      ),
      hasCustomerData: !!(
        order.customer?.metafield_partita_iva?.value ||
        order.customer?.metafield_codice_fiscale?.value
      ),
    });
  } catch (error) {
    console.error("[PROFORMA ERROR]", error);
    throw new Response("Failed to generate proforma invoice", { status: 500 });
  }
};

export default function ProformaInvoicePage() {

  const { renderedHtml, orderName, hasCompanyData, hasCustomerData } =
    useLoaderData<typeof loader>();

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <>
      <style>{`
        /* Screen preview styles */
        .proforma-page-container {
          background: #f6f6f7;
          min-height: 100vh;
          padding: 24px;
        }

        .proforma-invoice-wrapper {
          max-width: 900px;
          margin: 0 auto;
          background: white;
          padding: 40px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border-radius: 8px;
        }

        /* Print-specific styles */
        @media print {
          body {
            background: white;
          }

          .proforma-page-container {
            padding: 0;
            background: white;
          }

          .proforma-invoice-wrapper {
            box-shadow: none;
            border-radius: 0;
            padding: 0;
            max-width: 100%;
          }

          /* Hide Shopify Polaris chrome */
          .Polaris-Page-Header,
          .Polaris-Navigation,
          [data-polaris-layer],
          nav,
          header {
            display: none !important;
          }
        }
      `}</style>

      <Page
        backAction={{ content: "Orders", url: "/app" }}
        title={`Fattura Proforma - ${orderName}`}
        titleMetadata={<Badge tone="info">Proforma</Badge>}
        primaryAction={{
          content: "Stampa",
          icon: PrintIcon,
          onAction: handlePrint,
        }}
      >
        <Layout>
          {(!hasCompanyData || !hasCustomerData) && (
            <Layout.Section>
              <Banner
                title="Attenzione: Dati incompleti"
                tone="warning"
                action={
                  !hasCompanyData
                    ? {
                        content: "Configura dati azienda",
                        url: "/app/company",
                      }
                    : undefined
                }
              >
                <BlockStack gap="200">
                  {!hasCompanyData && (
                    <p>I dati fiscali dell'azienda non sono completi.</p>
                  )}
                  {!hasCustomerData && (
                    <p>I dati fiscali del cliente non sono completi.</p>
                  )}
                </BlockStack>
              </Banner>
            </Layout.Section>
          )}

          <Layout.Section>
            <div className="proforma-page-container">
              <div className="proforma-invoice-wrapper">
                <div
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  className="proforma-content"
                />
              </div>
            </div>
          </Layout.Section>
        </Layout>
      </Page>
    </>
  );
}

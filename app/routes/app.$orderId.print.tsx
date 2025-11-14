// app/routes/app_.$orderId.print.tsx

import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "app/shopify.server";
import { useLoaderData } from "@remix-run/react";
import {
  Text,
  Page,
  Card,
  Layout,
  Divider,
  InlineStack,
  BlockStack,
  Button,
  LegacyCard,
} from "@shopify/polaris";
import { useEffect } from "react";
import { createApp } from "@shopify/app-bridge";
import { Redirect } from "@shopify/app-bridge/actions";

// export const loader = async ({ request, params }: LoaderFunctionArgs) => {
//   const { admin } = await authenticate.admin(request);
//   const orderId = params.orderId;

//   if (!orderId) throw new Response("Order ID missing", { status: 400 });

//   const gid = `gid://shopify/Order/${orderId}`;

//   const query = `
//     query GetOrder($id: ID!) {
//       order(id: $id) {
//         id
//         name
//         createdAt
//         totalPriceSet {
//           shopMoney {
//             amount
//             currencyCode
//           }
//         }
//         # customer {
//           # displayName
//           # email
//         # }
//         lineItems(first: 100) {
//           edges {
//             node {
//               title
//               quantity
//               originalTotalSet {
//                 shopMoney {
//                   amount
//                 }
//               }
//             }
//           }
//         }
//       }
//     }
//   `;

//   const response = await admin.graphql(query, {
//     variables: { id: gid },
//   });

//   const jsonResp = await response.json();
  
//   const orderData = jsonResp?.data?.order;

//   if (!orderData) throw new Response("Order not found", { status: 404 });

//   const items = orderData.lineItems.edges.map((edge: any) => ({
//     name: edge.node.title,
//     qty: edge.node.quantity,
//     price: edge.node.originalTotalSet.shopMoney.amount,
//   }));

//   return {
//     order: {
//       id: orderData.id,
//       name: orderData.name,
//       date: new Date(orderData.createdAt).toLocaleDateString("it-IT"),
//       total: `${orderData.totalPriceSet.shopMoney.amount} ${orderData.totalPriceSet.shopMoney.currencyCode}`,
//       items,
//       customer: {
//         name: orderData.customer?.displayName ?? "Sconosciuto",
//         email: orderData.customer?.email ?? "-",
//       },
//     },
//   } ;
// };

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const orderId = params.orderId;

  if (!orderId) throw new Response("Order ID missing", { status: 400 });

  const gid = `gid://shopify/Order/${orderId}`;

  const query = `
    query GetOrder($id: ID!) {
      order(id: $id) {
        id
        name
        createdAt
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        lineItems(first: 100) {
          edges {
            node {
              title
              quantity
              originalTotalSet {
                shopMoney {
                  amount
                }
              }
            }
          }
        }
        metafield(namespace: "invoice", key: "invoice_data") {
          value
        }
      }
    }
  `;

  const response = await admin.graphql(query, {
    variables: { id: gid },
  });

  const jsonResp = await response.json();
  const orderData = jsonResp?.data?.order;

  if (!orderData) throw new Response("Order not found", { status: 404 });

  const items = orderData.lineItems.edges.map((edge: any) => ({
    name: edge.node.title,
    qty: edge.node.quantity,
    price: edge.node.originalTotalSet.shopMoney.amount,
  }));

  const invoice_data = orderData.metafield?.value
    ? JSON.parse(orderData.metafield.value)
    : {};

  return {
    order: {
      id: orderData.id,
      name: orderData.name,
      date: new Date(orderData.createdAt).toLocaleDateString("it-IT"),
      total: `${orderData.totalPriceSet.shopMoney.amount} ${orderData.totalPriceSet.shopMoney.currencyCode}`,
      items,
      invoice_data,
    },
  };
};


export default function PrintOrderPage() {
  const { order } = useLoaderData<typeof loader>();
  const { invoice_data } = order;
  

  // const printInvoice = () => {
  //   window.print();
  // }

  return (
    <Page
      backAction={{content: 'Settings', url: '#'}}
      title={`Fattura ordine ${order.name}`}
      primaryAction={<Button
        onClick={() => {
          const host = new URLSearchParams(location.search).get("host");
          const orderId = order.id.split("/").pop()!; 
          const orderIdNumeric = orderId.split("/").pop()!;
          debugger ;

          const app = createApp({
            apiKey: import.meta.env.VITE_SHOPIFY_API_KEY!,
            host: host!,
            forceRedirect: true,
          });
        
          const redirect = Redirect.create(app);
        
          redirect.dispatch(Redirect.Action.ADMIN_PATH, {
            path: `/apps/order-printer/app/print?ids[]=${orderId!}`, // 👈 cambia "invoice" con il tuo handle
            newContext: true, // 👈 apre in nuova scheda
          });
          // const orderPrinterUrl = `https://${host}/apps/order-printer/print?ids[]=${orderId}`;
      
          // window.open(orderPrinterUrl, '_blank'); // oppure `location.href = ...`
        }}
      >
        Stampa con Order Printer
      </Button>}
    >
      <Card>
        <Layout>
          {/* Header */}
          <Layout.Section>
            <InlineStack align="space-between">
              <BlockStack>
                <Text as="h1" variant="headingXl">
                  {invoice_data?.ragione_sociale ?? "Intestazione mancante"}
                </Text>
                <Text as="p" tone="subdued" fontWeight="medium">
                  P.IVA {invoice_data?.partita_iva} - CF {invoice_data?.codice_fiscale}
                </Text>
                <Text as="p" tone="subdued">
                  PEC: {invoice_data?.pec}
                </Text>
              </BlockStack>

              <BlockStack align="end">
                <Text as="h2" variant="headingLg">PROFORMA</Text>
                <Text as="p" tone="subdued">Ordine {order.name}</Text>
                <Text as="p" tone="subdued">Data: {order.date}</Text>
              </BlockStack>
            </InlineStack>
          </Layout.Section>

          <Divider />

          {/* Items Table */}
          <Layout.Section>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="p" fontWeight="bold">Prodotto</Text>
                <Text as="p" fontWeight="bold">Quantità</Text>
                <Text as="p" fontWeight="bold">Prezzo</Text>
              </InlineStack>

              {order.items.map((item, index) => (
                <InlineStack key={index} align="space-between">
                  <Text as="p">{item.name}</Text>
                  <Text as="p">{item.qty}</Text>
                  <Text as="p">{item.price} €</Text>
                </InlineStack>
              ))}
            </BlockStack>
          </Layout.Section>

          <Divider />

          {/* Totale */}
          <Layout.Section>
            <InlineStack align="space-between">
              <Text as="p" variant="headingMd">Totale</Text>
              <Text as="p" variant="headingMd">{order.total}</Text>
            </InlineStack>
          </Layout.Section>
        </Layout>
      </Card>
    </Page>
  );
}
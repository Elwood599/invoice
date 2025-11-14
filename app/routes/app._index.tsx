import {
  Card,
  Badge,
  Button,
  IndexFilters,
  IndexTable,
  Text,
  TabProps,
  IndexFiltersProps,
  useIndexResourceState,
  useSetIndexFiltersMode,
} from "@shopify/polaris";
import { ViewIcon, PrintIcon } from "@shopify/polaris-icons";
import { useFetcher, useLoaderData, useLocation, useNavigate } from "@remix-run/react";
import { authenticate } from "app/shopify.server";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useCallback, useEffect, useState } from "react";
import { createApp } from "@shopify/app-bridge";
import { Redirect } from "@shopify/app-bridge/actions";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  return {
    shop: session.shop,
    apiKey: process.env.SHOPIFY_API_KEY || ""
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);

  const first = 15;
  const form = await request.formData(); // ✅
  const after = form.get("after")?.toString();

  const query = `query GetOrders($first: Int!, $after: String) {
      orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
          edges {
              cursor
              node {
                  id
                  name
                  createdAt
                  totalPriceSet {
                      shopMoney {
                          amount
                          currencyCode
                      }
                  }
                  unpaid
                  displayFulfillmentStatus
                  lineItems(first: 100) {
                    edges {
                      node {
                        id
                      }
                    }
                  }
                  customer {
                    displayName
                    firstName
                    lastName
                    email
                    metafield_ragione_sociale: metafield(namespace: "invoice", key: "ragione_sociale") {
                      value
                    }
                  }
                  requested: metafield(namespace: "invoice", key: "requested") {
                      value
                  }
                  emitted: metafield(namespace: "invoice", key: "emitted") {
                      value
                  }
              }
          }
          pageInfo {
              hasNextPage
              endCursor
          }
      }
  }`;

  console.log("Fetching orders with first:", first, "and after:", after);

  const response = await admin.graphql(query, {
    variables: { "first": first, "after": after }
  });
  const json = await response.json();

  // Filter orders where invoice was requested (requested = true)
  const orders = json.data.orders.edges
    .map((edge: any) => edge.node)
    .filter((order: any) => order.requested?.value === "true");

  const pageInfo = json.data.orders.pageInfo;

  console.log(`[ORDERS] Fetched ${orders.length} orders with invoice requested`);

  return { orders, pageInfo };
};

export default function Index() {

  const { shop, apiKey } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const location = useLocation();

  // Get host from URL or sessionStorage
  const getHost = () => {
    const urlHost = new URLSearchParams(window.location.search).get("host");
    if (urlHost) {
      sessionStorage.setItem("shopify_host", urlHost);
      return urlHost;
    }
    return sessionStorage.getItem("shopify_host") || "";
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  /******************************************************************/
  /*********************** MONDO TABS e VIEWS ***********************/
  /******************************************************************/

  const [itemStrings, setItemStrings] = useState([
    'All',
    'Emitted',
    'Not emitted',
  ]);

  const deleteView = (index: number) => {
    const newItemStrings = [...itemStrings];
    newItemStrings.splice(index, 1);
    setItemStrings(newItemStrings);
    setSelected(0);
  };

  const duplicateView = async (name: string) => {
    setItemStrings([...itemStrings, name]);
    setSelected(itemStrings.length);
    await sleep(1);
    return true;
  };

  const tabs: TabProps[] = itemStrings.map((item, index) => ({
    content: item,
    index,
    onAction: () => { },
    id: `${item}-${index}`,
    isLocked: index === 0,
    actions:
      index === 0
        ? []
        : [
          {
            type: 'rename',
            onAction: () => { },
            onPrimaryAction: async (value: string): Promise<boolean> => {
              const newItemsStrings = tabs.map((item, idx) => {
                if (idx === index) {
                  return value;
                }
                return item.content;
              });
              await sleep(1);
              setItemStrings(newItemsStrings);
              return true;
            },
          },
          {
            type: 'duplicate',
            onPrimaryAction: async (value: string): Promise<boolean> => {
              await sleep(1);
              duplicateView(value);
              return true;
            },
          },
          {
            type: 'edit',
          },
          {
            type: 'delete',
            onPrimaryAction: async () => {
              await sleep(1);
              deleteView(index);
              return true;
            },
          },
        ],
  }));
  const [selected, setSelected] = useState(0);
  const onCreateNewView = async (value: string) => {
    await sleep(500);
    setItemStrings([...itemStrings, value]);
    setSelected(itemStrings.length);
    return true;
  };
  const sortOptions: IndexFiltersProps['sortOptions'] = [
    { label: 'Order', value: 'order asc', directionLabel: 'Ascending' },
    { label: 'Order', value: 'order desc', directionLabel: 'Descending' },
    { label: 'Status', value: 'invoiceStatus asc', directionLabel: 'A-Z' },
    { label: 'Status', value: 'invoiceStatus desc', directionLabel: 'Z-A' },
    { label: 'Date', value: 'date asc', directionLabel: 'A-Z' },
    { label: 'Date', value: 'date desc', directionLabel: 'Z-A' },
    { label: 'Total', value: 'total asc', directionLabel: 'Ascending' },
    { label: 'Total', value: 'total desc', directionLabel: 'Descending' },
  ];
  const [sortSelected, setSortSelected] = useState(['order asc']);
  const { mode, setMode } = useSetIndexFiltersMode();
  const onHandleCancel = () => { };

  const onHandleSave = async () => {
    await sleep(1);
    return true;
  };

  const primaryAction: IndexFiltersProps['primaryAction'] =
    selected === 0
      ? {
        type: 'save-as',
        onAction: onCreateNewView,
        disabled: false,
        loading: false,
      }
      : {
        type: 'save',
        onAction: onHandleSave,
        disabled: false,
        loading: false,
      };

  const [queryValue, setQueryValue] = useState('');

  const handleFiltersQueryChange = useCallback(
    (value: string) => setQueryValue(value),
    [],
  );

  const handleQueryValueRemove = useCallback(() => setQueryValue(''), []);
  const handleFiltersClearAll = useCallback(() => {
    handleQueryValueRemove();
  }, [
    handleQueryValueRemove,
  ]);


  const appliedFilters: IndexFiltersProps['appliedFilters'] = [];

  const resourceName = {
    singular: 'order',
    plural: 'orders',
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(orders);

  /******************************************************************/
  /********************* RENDERING DELLA TABELLA ********************/
  /******************************************************************/
  const rowMarkup = orders.map(
    (
      { id, date, customer, total, paymentStatus, fulfillmentStatus, items, invoiceStatus, link, printProforma },
      index,
    ) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
      >
        <IndexTable.Cell>{id}</IndexTable.Cell>
        <IndexTable.Cell>{date}</IndexTable.Cell>
        <IndexTable.Cell>{customer}</IndexTable.Cell>
        <IndexTable.Cell>{total}</IndexTable.Cell>
        <IndexTable.Cell>{paymentStatus}</IndexTable.Cell>
        <IndexTable.Cell>{fulfillmentStatus}</IndexTable.Cell>
        <IndexTable.Cell>{items}</IndexTable.Cell>
        <IndexTable.Cell>{invoiceStatus}</IndexTable.Cell>
        <IndexTable.Cell>{link}</IndexTable.Cell>
        <IndexTable.Cell>{printProforma}</IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  useEffect(() => {
    fetcher.submit({}, { method: "post" });
  }, []);

  useEffect(() => {

    if (fetcher.data?.orders) {

      const rawOrders = fetcher.data?.orders ?? [];

      // Update pagination info
      if (fetcher.data?.pageInfo) {
        setHasNextPage(fetcher.data.pageInfo.hasNextPage);
        setEndCursor(fetcher.data.pageInfo.endCursor);
      }

      // 🔎 Filtro per "Invoice status" (tab)
      const filteredByTab = rawOrders.filter((order: any) => {
        if (itemStrings[selected] === "Emitted") return order.emitted?.value === "true";
        if (itemStrings[selected] === "Not emitted") return order.emitted?.value !== "true";
        return true;
      });

      // 🔎 Filtro per "query search" (text)
      const filteredByQuery = filteredByTab.filter((order: any) => {
        if (!queryValue) return true;

        const term = queryValue.toLowerCase();

        // Build customer search string (all possible customer fields)
        const customerSearchString = [
          order.customer?.metafield_ragione_sociale?.value,
          order.customer?.displayName,
          order.customer?.firstName,
          order.customer?.lastName,
          order.customer?.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return (
          order.name.toLowerCase().includes(term) ||
          `${order.totalPriceSet.shopMoney.amount}`.includes(term) ||
          (order.emitted?.value === "true" ? "emitted" : "not emitted").includes(term) ||
          customerSearchString.includes(term)
        );
      });

      // 🔃 Ordinamento
      const sorted = [...filteredByQuery].sort((a: any, b: any) => {
        const [field, direction] = sortSelected[0].split(" ");

        let aVal = a[field];
        let bVal = b[field];

        if (field === "total") {
          aVal = parseFloat(a.totalPriceSet.shopMoney.amount);
          bVal = parseFloat(b.totalPriceSet.shopMoney.amount);
        }

        if (field === "date") {
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
        }

        if (field === "order") {
          aVal = a.name;
          bVal = b.name;
        }

        if (field === "invoiceStatus") {
          aVal = a.emitted?.value === "true" ? 1 : 0;
          bVal = b.emitted?.value === "true" ? 1 : 0;
        }

        if (aVal < bVal) return direction === "asc" ? -1 : 1;
        if (aVal > bVal) return direction === "asc" ? 1 : -1;
        return 0;
      });


      const parsed = sorted.map((order: any) => {
        const orderId = order.id.split("/").pop()!;

        // Determine customer display name: ragione_sociale > displayName > firstName lastName > email
        const customerDisplay = order.customer?.metafield_ragione_sociale?.value ||
          order.customer?.displayName ||
          (order.customer?.firstName && order.customer?.lastName
            ? `${order.customer.firstName} ${order.customer.lastName}`
            : null) ||
          order.customer?.email ||
          '-';

        return {
          id: <Text as="span" variant="bodyMd" fontWeight="semibold">{order.name}</Text>,
          date: new Date(order.createdAt).toLocaleString("it-IT"),
          customer: <Text as="span">{customerDisplay}</Text>,
          total: `${order.totalPriceSet.shopMoney.amount} ${order.totalPriceSet.shopMoney.currencyCode}`,
          paymentStatus: <Badge progress={order.unpaid ? "incomplete" : "complete"}>{order.unpaid ? "Unpaid" : "Paid"}</Badge>,
          fulfillmentStatus: <Badge progress={order.displayFulfillmentStatus === "FULFILLED" ? "complete" : "incomplete"}>{order.displayFulfillmentStatus.toLowerCase()}</Badge>,
          items: `${order.lineItems?.edges?.length || 0} items`,
          invoiceStatus: order.emitted?.value === "true" ? <Badge tone="success">Emitted</Badge> : <Badge tone="warning">Not emitted</Badge>,
          link: <Button icon={ViewIcon} onClick={() => {
            redirectToOrder(orderId, getHost());
          }}>View</Button>,
          printProforma: <Button icon={PrintIcon} onClick={() => {
            const host = getHost();
            const searchParams = new URLSearchParams();
            if (host) {
              searchParams.set("host", host);
            }
            navigate(`/app/${orderId}/proforma?${searchParams.toString()}`);
          }}>Proforma</Button>,
        };
      })

      setOrders(parsed);
    }
  }, [fetcher, selected, queryValue, sortSelected]);

  return (
    <Card>
      <IndexFilters
        sortOptions={sortOptions}
        sortSelected={sortSelected}
        queryValue={queryValue}
        queryPlaceholder="Searching in all"
        onQueryChange={handleFiltersQueryChange}
        onQueryClear={() => setQueryValue('')}
        onSort={setSortSelected}
        primaryAction={primaryAction}
        cancelAction={{
          onAction: onHandleCancel,
          disabled: false,
          loading: false,
        }}
        tabs={tabs}
        selected={selected}
        onSelect={setSelected}
        canCreateNewView
        onCreateNewView={onCreateNewView}
        // filters={filters}
        filters={[]}
        hideFilters={true}
        appliedFilters={appliedFilters}
        onClearAll={handleFiltersClearAll}
        mode={mode}
        setMode={setMode}
      />
      <IndexTable
        resourceName={resourceName}
        itemCount={orders.length}
        selectable={false}
        selectedItemsCount={
          allResourcesSelected ? 'All' : selectedResources.length
        }
        onSelectionChange={handleSelectionChange}
        headings={[
          { title: 'Order' },
          { title: 'Date' },
          { title: 'Customer' },
          { title: 'Total', alignment: 'end' },
          { title: 'Payment status' },
          { title: 'Fulfillment status' },
          { title: 'Items' },
          { title: 'Invoice emitted' },
          { title: 'Link' },
          { title: 'Proforma' },
        ]}
      >
        {rowMarkup}
      </IndexTable>
      {hasNextPage && (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <Button
            onClick={() => {
              const formData = new FormData();
              formData.append("after", endCursor || "");
              fetcher.submit(formData, { method: "post" });
            }}
            loading={fetcher.state === "submitting"}
          >
            Load more orders
          </Button>
        </div>
      )}
    </Card>
  );

  function redirectToOrder(orderId: string, host: string) {
    const app = createApp({
      apiKey: apiKey,
      host,
      forceRedirect: true,
    });

    const redirect = Redirect.create(app);

    // Use ADMIN_PATH to navigate to the order page
    redirect.dispatch(Redirect.Action.ADMIN_PATH, {
      path: `/orders/${orderId}`,
      newContext: true, // Open in new tab
    });
  }

}
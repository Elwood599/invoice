import { useEffect, useState } from 'react'

import {
  Tile,
  reactExtension,
  useApi,
  useCartSubscription,
  useConnectivitySubscription
} from '@shopify/ui-extensions-react/point-of-sale'

const TileComponent = () => {

  const api = useApi()
  const cart = useCartSubscription()
  const connectivity = useConnectivitySubscription()

  const [enabled, setEnabled] = useState(false)
  const [subtitle, setSubtitle] = useState('')
  const [invoiceRequested, setInvoiceRequested] = useState(false)
  const [isCheckingInvoice, setIsCheckingInvoice] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Check invoice status function
  const checkInvoiceStatus = async () => {
    if (!cart?.customer?.id || connectivity.internetConnected !== "Connected") {
      setInvoiceRequested(false)
      return
    }

    setIsCheckingInvoice(true)
    try {
      // Get session token
      const sessionToken = await api.session.getSessionToken()

      // Fetch shop metafield to get app URL
      const shopQuery = `
        query GetAppUrl {
          shop {
            metafield(namespace: "app_config", key: "app_url") {
              value
            }
          }
        }
      `

      const shopResponse = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ query: shopQuery }),
      })

      const shopResult = await shopResponse.json()
      const appUrl = shopResult.data?.shop?.metafield?.value

      if (!appUrl) {
        console.error('[TILE] App URL not found')
        setInvoiceRequested(false)
        return
      }

      // Fetch invoice data for customer
      const customerId = String(cart.customer.id)
      const invoiceResponse = await fetch(`${appUrl}/api/customer-invoice-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ customerId }),
      })

      const invoiceData = await invoiceResponse.json()
      console.log('[TILE] Invoice data received:', invoiceData)
      const invoiceStatus = invoiceData?.invoice?.emitInvoice || false
      console.log('[TILE] Setting invoiceRequested to:', invoiceStatus)
      setInvoiceRequested(invoiceStatus)
    } catch (error) {
      console.error('[TILE] Error checking invoice status:', error)
      setInvoiceRequested(false)
    } finally {
      setIsCheckingInvoice(false)
    }
  }

  // Fetch invoice status when customer changes or refresh is triggered
  useEffect(() => {
    checkInvoiceStatus()
  }, [cart?.customer?.id, connectivity.internetConnected, refreshTrigger])

  // Watch for cart property changes (triggered from Modal when invoice is toggled)
  useEffect(() => {
    const invoiceUpdatedAt = cart?.properties?.['_invoice_updated_at']

    if (invoiceUpdatedAt) {
      console.log('[TILE] Invoice update property detected, timestamp:', invoiceUpdatedAt)
      setRefreshTrigger(prev => prev + 1)
    }
  }, [cart?.properties])

  // Update tile subtitle based on state
  useEffect(() => {
    const hasCart = +cart.grandTotal > 0
    const hasCustomer = !!cart.customer
    const isConnected = connectivity.internetConnected === "Connected"
    const hasInvoiceInCart = cart?.properties?.['_invoice.requested'] === 'true'

    // Determine tile state based on conditions
    if (!isConnected) {
      // Offline - disabled
      setEnabled(false)
      setSubtitle('⚠️ Offline')
    } else if (!hasCart) {
      // No items in cart - disabled
      setEnabled(false)
      setSubtitle('Empty cart')
    } else if (!hasCustomer) {
      // Has cart but no customer - enabled but warning
      setEnabled(true)
      setSubtitle('⚠️ No customer')
    } else {
      // Has customer - show invoice status
      setEnabled(true)
      if (isCheckingInvoice) {
        setSubtitle('Checking status...')
      } else if (hasInvoiceInCart || invoiceRequested) {
        // Show invoice requested with customer name if available
        const customerName = cart.customer?.firstName ? `${cart.customer.firstName}` : ''
        setSubtitle(customerName ? `✓ Invoice: ${customerName}` : '✓ Invoice requested')
      } else {
        setSubtitle('Ready to request invoice')
      }
    }
  }, [cart.grandTotal, cart.customer, cart.properties, connectivity.internetConnected, invoiceRequested, isCheckingInvoice])

  const handleTilePress = async () => {
    console.log('[TILE] Opening modal... timestamp:', Date.now())

    try {
      const result = await api.action.presentModal()
      console.log('[TILE] presentModal returned:', result, 'timestamp:', Date.now())
    } catch (error) {
      console.log('[TILE] presentModal error:', error)
    }

    // Modal is now closed, refresh the invoice status
    console.log('[TILE] Modal dismissed, refreshing invoice status timestamp:', Date.now())
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <Tile
      title="Invoice"
      subtitle={subtitle}
      onPress={handleTilePress}
      enabled={enabled}
    />
  )
}

export default reactExtension('pos.home.tile.render', () => {
  return <TileComponent />
})

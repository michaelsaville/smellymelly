import EasyPostClient from '@easypost/api'

let client: InstanceType<typeof EasyPostClient> | null = null

export function getEasyPostClient(): InstanceType<typeof EasyPostClient> {
  if (!client) {
    client = new EasyPostClient(process.env.EASYPOST_API_KEY!)
  }
  return client
}

export function isEasyPostConfigured(): boolean {
  return !!process.env.EASYPOST_API_KEY
}

// Smelly Melly's ship-from address (WV workshop)
export function getFromAddress() {
  return {
    company: 'Smelly Melly',
    street1: process.env.SHIP_FROM_STREET || '',
    city: process.env.SHIP_FROM_CITY || '',
    state: process.env.SHIP_FROM_STATE || 'WV',
    zip: process.env.SHIP_FROM_ZIP || '',
    country: 'US',
    phone: process.env.SHIP_FROM_PHONE || '',
  }
}

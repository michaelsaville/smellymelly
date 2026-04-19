import { SquareClient, SquareEnvironment } from 'square'

let client: SquareClient | null = null

export function getSquareClient(): SquareClient {
  if (!client) {
    const env = process.env.SQUARE_ENVIRONMENT === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox
    client = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment: env,
    })
  }
  return client
}

export function getSquareAppId(): string {
  return process.env.SQUARE_APPLICATION_ID || ''
}

export function getSquareLocationId(): string {
  return process.env.SQUARE_LOCATION_ID || ''
}

export function isSquareConfigured(): boolean {
  return !!(
    process.env.SQUARE_ACCESS_TOKEN &&
    process.env.SQUARE_APPLICATION_ID &&
    process.env.SQUARE_LOCATION_ID
  )
}

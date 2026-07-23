import type { Market, Prisma } from '@prisma/client'

export const STANDARD_MARKET_NAMES = ['Nashville CBD', 'Dubai', 'Hamburg'] as const

type MarketStore = {
  market: {
    upsert(args: Prisma.MarketUpsertArgs): Promise<Market>
  }
}

export async function ensureStandardMarkets(db: MarketStore) {
  const markets: Market[] = []

  for (const name of STANDARD_MARKET_NAMES) {
    const market = await db.market.upsert({
      where: { name },
      update: {},
      create: { name },
    })
    markets.push(market)
  }

  return markets
}

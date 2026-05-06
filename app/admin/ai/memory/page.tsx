import { prisma } from '@/app/lib/prisma'
import { MemoryManager } from './MemoryManager'

export const dynamic = 'force-dynamic'

export default async function AIMemoryPage() {
  const samples = await prisma.sM_AIMessageSample.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-dark">
            AI Memory
          </h1>
          <p className="mt-1 text-sm text-brand-brown/60">
            The bot keeps a rolling sample of the last 30 things you&rsquo;ve typed
            so it can learn how you phrase requests. These get sprinkled into
            its system prompt as style hints &mdash; it doesn&rsquo;t quote them back.
            Wipe them anytime; the bot still works, it just starts fresh.
          </p>
        </div>
      </div>

      <MemoryManager
        initial={samples.map((s) => ({
          id: s.id,
          content: s.content,
          createdAt: s.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}

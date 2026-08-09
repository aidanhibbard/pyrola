import { toast } from 'vue-sonner'
import type { BillableUsageRecord } from '@/types/billing/billable-usage-record'
import type { ChatUsageTotals } from '@/types/chat/chat-meta'
import billableUsageRecordSchema from '@/schemas/billing/billable-usage-record-schema'
import computeChatUsageTotals from '@/services/billing/compute-chat-usage-totals'
import readUsageLedger from '@/services/billing/read-usage-ledger'
import {
  getUserPyrolaDir,
  updateChatMeta,
  writeJsonFile,
} from '@/services/pyrola/pyrola-tauri'

const ledgerPath = async (
  projectSlug: string,
  chatId: string,
): Promise<string> => {
  const root = await getUserPyrolaDir()
  return `${root}/chats/${projectSlug}/${chatId}/usage-ledger.json`
}

export type GatewayGenerationClient = {
  getGenerationInfo: (params: {
    id: string
  }) => Promise<{
    totalCost: number
    upstreamInferenceCost: number
    isByok: boolean
  }>
}

export type EnrichGatewayCostResult = {
  record: BillableUsageRecord | null
  records: BillableUsageRecord[]
  usageTotals: ChatUsageTotals | null
}

/**
 * Async cost enrich for AI Gateway generations via getGenerationInfo.
 * Does not modify token fields. On failure: toast, leave cost null / pricingSource none.
 */
export default async (input: {
  projectSlug: string
  chatId: string
  recordId: string
  generationId: string
  gatewayClient: GatewayGenerationClient
}): Promise<EnrichGatewayCostResult> => {
  const records = await readUsageLedger(input.projectSlug, input.chatId)
  const index = records.findIndex((entry) => entry.id === input.recordId)
  if (index < 0) {
    return { record: null, records, usageTotals: null }
  }

  const current = records[index]
  if (!current) {
    return { record: null, records, usageTotals: null }
  }

  try {
    const info = await input.gatewayClient.getGenerationInfo({
      id: input.generationId,
    })

    // Non-BYOK: totalCost is the billed gateway amount (includes surcharges).
    // BYOK: totalCost excludes provider inference; upstreamInferenceCost is the
    // market inference price paid via the user key. Prefer upstream for BYOK.
    const costUSD = info.isByok ? info.upstreamInferenceCost : info.totalCost

    const patched: BillableUsageRecord = {
      ...current,
      costUSD,
      pricingSource: 'provider_reported',
    }
    // Drop user_configured rates once provider cost wins.
    delete patched.rates

    const next = [...records]
    next[index] = billableUsageRecordSchema.parse(patched)

    await writeJsonFile(
      await ledgerPath(input.projectSlug, input.chatId),
      next,
    )

    const usageTotals = computeChatUsageTotals(next)
    await updateChatMeta(input.projectSlug, input.chatId, { usageTotals })

    return { record: patched, records: next, usageTotals }
  } catch (error) {
    // Leave the row unchanged (cost may still be user_configured from rates).
    // Do not invent $0; UI shows the warning when pricing is incomplete.
    toast.error('Failed to load gateway cost', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })

    return {
      record: current,
      records,
      usageTotals: computeChatUsageTotals(records),
    }
  }
}

import buildTools from '@/services/harness/build-tools'
import type { HarnessToolContext } from '@/services/harness/build-tools'

const key = 'web_search' as keyof ReturnType<typeof buildTools>

export default (ctx: HarnessToolContext) => buildTools(ctx)[key]

type FlushBackgroundSubagentResumeArgs = {
  parentBusy: boolean
  hasPending: boolean
  hasRunning: boolean
  deliverableCount: number
}

export type FlushBackgroundSubagentResume = 'resume' | 'clear' | 'noop'

export default (
  args: FlushBackgroundSubagentResumeArgs,
): FlushBackgroundSubagentResume => {
  if (!args.hasPending) {
    return 'noop'
  }
  if (args.parentBusy || args.hasRunning) {
    return 'noop'
  }
  if (args.deliverableCount > 0) {
    return 'resume'
  }
  return 'clear'
}

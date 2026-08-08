type ResumeAfterSubagentArgs = {
  blocking: boolean
  outcome?: 'completed' | 'failed' | 'aborted'
}

export default (args: ResumeAfterSubagentArgs): boolean =>
  args.outcome !== 'aborted' && !args.blocking

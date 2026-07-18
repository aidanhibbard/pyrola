export type PendingQuestion = {
  toolCallId: string
  question: string
  options?: string[]
  resolve: (answer: string) => void
  reject: (error: Error) => void
}

const pending = new Map<string, PendingQuestion>()

export const requestQuestion = (
  toolCallId: string,
  question: string,
  options?: string[],
): Promise<string> =>
  new Promise((resolve, reject) => {
    pending.set(toolCallId, {
      toolCallId,
      question,
      options,
      resolve,
      reject,
    })
  })

export const resolveQuestion = (toolCallId: string, answer: string): void => {
  const entry = pending.get(toolCallId)
  if (!entry) {
    return
  }
  pending.delete(toolCallId)
  entry.resolve(answer)
}

export const rejectAllPendingQuestions = (): void => {
  for (const entry of pending.values()) {
    entry.reject(new Error('Question cancelled'))
  }
  pending.clear()
}

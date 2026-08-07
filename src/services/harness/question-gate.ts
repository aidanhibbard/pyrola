export type PendingQuestion = {
  chatId: string
  toolCallId: string
  question: string
  options?: string[]
  resolve: (answer: string) => void
  reject: (error: Error) => void
}

const pending = new Map<string, PendingQuestion>()

export const requestQuestion = (
  chatId: string,
  toolCallId: string,
  question: string,
  options?: string[],
): Promise<string> =>
  new Promise((resolve, reject) => {
    pending.set(toolCallId, {
      chatId,
      toolCallId,
      question,
      options,
      resolve,
      reject,
    })
  })

export const getPendingQuestion = (toolCallId: string): PendingQuestion | undefined =>
  pending.get(toolCallId)

export const listPendingQuestionsForChat = (chatId: string): PendingQuestion[] =>
  [...pending.values()].filter((entry) => entry.chatId === chatId)

export const resolveQuestion = (toolCallId: string, answer: string): void => {
  const entry = pending.get(toolCallId)
  if (!entry) {
    return
  }
  pending.delete(toolCallId)
  entry.resolve(answer)
}

export const rejectPendingQuestionsForChat = (chatId: string): void => {
  for (const [toolCallId, entry] of pending.entries()) {
    if (entry.chatId !== chatId) {
      continue
    }
    pending.delete(toolCallId)
    entry.reject(new Error('Question cancelled'))
  }
}

/** @deprecated Prefer rejectPendingQuestionsForChat. Kept for tests that clear everything. */
export const rejectAllPendingQuestions = (): void => {
  for (const entry of pending.values()) {
    entry.reject(new Error('Question cancelled'))
  }
  pending.clear()
}

export const resetQuestionGateForTests = (): void => {
  pending.clear()
}

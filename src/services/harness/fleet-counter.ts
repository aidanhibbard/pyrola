let activeRuns = 0

const fleetCounter = {
  increment: (): void => {
    activeRuns++
  },
  decrement: (): void => {
    activeRuns--
  },
  get: (): number => activeRuns,
}

export default fleetCounter

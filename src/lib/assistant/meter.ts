// Counts the model requests made while answering ONE chat turn, so the daily cap
// is respected even by work done inside a tool (drafting an article is two more
// requests on top of the chat step that asked for it). Pure: the guard supplies
// how much of the day was already used.
export class UsageMeter {
  /** Requests made by tools themselves (the chat steps are counted at the end of the turn). */
  toolRequests = 0
  /** The chat step(s) already in flight. Starts at 1: the request that is running now. */
  chatRequests = 1

  constructor(
    private readonly usedBefore: number,
    private readonly dailyCap: number,
  ) {}

  get total(): number {
    return this.toolRequests + this.chatRequests
  }

  /** True if `n` more requests still fit under today's cap. */
  canSpend(n = 1): boolean {
    return this.usedBefore + this.total + n <= this.dailyCap
  }

  spend(n = 1): void {
    this.toolRequests += n
  }

  remaining(): number {
    return Math.max(0, this.dailyCap - this.usedBefore - this.total)
  }
}

export class BudgetExceededError extends Error {
  constructor() {
    super("Le plafond quotidien de requêtes de l'assistant serait dépassé.")
    this.name = 'BudgetExceededError'
  }
}

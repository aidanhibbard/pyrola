type ChallengeInput = {
  html: string
  text: string
}

/**
 * Conservative Cloudflare / bot-challenge phrasing checks.
 * Prefer false negatives over flagging real documentation.
 */
const CHALLENGE_PATTERNS: RegExp[] = [
  /checking your browser before accessing/i,
  /just a moment(?:\.\.\.)?/i,
  /enable javascript and cookies to continue/i,
  /cf-browser-verification/i,
  /cdn-cgi\/challenge-platform/i,
  /attention required!\s*\|\s*cloudflare/i,
  /verify you are human/i,
]

const isChallengePage = ({ html, text }: ChallengeInput): boolean => {
  const haystack = `${html}\n${text}`
  for (const pattern of CHALLENGE_PATTERNS) {
    if (pattern.test(haystack)) {
      return true
    }
  }
  return false
}

export default isChallengePage

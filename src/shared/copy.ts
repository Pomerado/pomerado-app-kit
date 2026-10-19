/**
 * Every word the kit shows a person. Apps add their own in their own copy.ts. Nothing here ships
 * until it is approved word for word, so change wording here and nowhere else.
 *
 * Style: plain words, short sentences, no dashes, colons or semicolons inside sentences. Never
 * mention repairs or raw error codes.
 */
export const KIT_COPY = {
  connect: {
    heading: "Connect Pomerado",
    lede: (app: string) =>
      `${app} runs its searches on Pomerado with your own free account. Setup takes about two minutes.`,
    step1Title: "Create a free account",
    step1Body: "Sign up on Pomerado. The free plan includes 100 runs a day.",
    step1Button: "Create a free account",
    step1Skip: "Already have an account? Go to step 2.",
    step2Title: "Make a key",
    step2Body: "This opens Pomerado with the key filled in. Click Create, then copy the key.",
    step2Button: "Make a key",
    step3Title: "Paste it here",
    step3Label: "Your Pomerado key",
    step3Placeholder: "pom_",
    step3Button: "Connect",
    checking: "Checking your key",
    storedKeychain: "Your key stays on this computer, locked in your system keychain.",
    storedMemory: "Your key stays in memory until you close the app.",
    connectedTitle: "You're connected",
    connectedBody: (runsLeft: string) => `${runsLeft} Your searches use them as they go.`,
    connectedButton: "Start searching",
    errors: {
      empty: "Paste your key first.",
      format: "That doesn't look like a Pomerado key. Keys start with pom_.",
      bad_key: "Pomerado didn't accept that key. Make a new key and paste it again.",
      missing_permission: "That key can't check your runs. Make a new key with the button in step 2.",
      unreachable: "We couldn't reach Pomerado. Check your internet connection and try again.",
      unavailable: "Pomerado isn't answering right now. Try again in a minute.",
    },
  },
  runsLeft: {
    some: (remaining: string, limit: string) => `${remaining} of ${limit} runs left today.`,
    unlimited: "Unlimited runs.",
    none: "No runs left today.",
    unknown: "Connected.",
  },
  quota: {
    title: "You've used today's runs",
    body: (time: string) => `Your runs come back ${time}. Premium gives you 1,000 runs a day.`,
    bodyNoTime: "Your runs come back tomorrow. Premium gives you 1,000 runs a day.",
    button: "Upgrade to Premium",
    /** "at 5:00 PM" or "on Tue at 5:00 PM", filled into `body`. */
    at: (clock: string) => `at ${clock}`,
    on: (day: string, clock: string) => `on ${day} at ${clock}`,
  },
  status: {
    waiting: "Waiting to start",
    searching: (site: string) => `Searching ${site}`,
    reading: "Reading results",
    returning: "Returning results",
    needsInput: (site: string) => `${site} needs an answer from you`,
    done: "Done",
    stopped: "Stopped",
    skipped: "Not searched",
  },
  needsInput: {
    body: "Answer in your browser. We'll keep going here as soon as you do.",
    button: "Answer in browser",
  },
  search: {
    stop: "Stop",
    loadingMore: "Loading more",
  },
  authLost: {
    title: "Your key stopped working",
    body: "It may have expired or been revoked. Connect a new key to keep searching.",
    button: "Connect a new key",
  },
  settings: {
    open: "Settings",
    title: "Settings",
    apiBase: "API address",
    dashboardBase: "Dashboard address",
    addressHint: "Changing the API address disconnects your key.",
    invalidAddress: "Enter a full address that starts with https://.",
    save: "Save",
    saved: "Saved.",
    close: "Close",
    disconnect: "Disconnect",
    disconnectHint: "This removes your key from this computer.",
    reset: "Use the standard addresses",
  },
  footer: {
    powered: "Powered by Pomerado",
  },
  forms: {
    required: "Fill this in.",
    number: (min: number, max: number) => `Pick a number from ${min} to ${max}.`,
    date: "Pick a date.",
    tooLong: (max: number) => `Use ${max} characters or fewer.`,
    choice: "Pick one of the options.",
    format: "Check this value.",
    yes: "Yes",
    no: "No",
  },
  results: {
    bestPick: "Best pick",
    open: (site: string) => `View on ${site}`,
  },
  /**
   * What a failed site says, as a title and a next step. `errors.ts` picks the entry from the
   * API's error code. `site` is the site's name as the app labels it.
   */
  errors: {
    invalidInput: {
      title: (site: string) => `${site} couldn't use these details.`,
      next: "Check your search and try again.",
    },
    inputRejected: {
      title: (site: string) => `${site} didn't accept one of your details.`,
      next: "Change it and search again.",
      nextWithChoices: "Did you mean one of these?",
    },
    inputNotApplied: {
      title: (site: string) => `${site} didn't apply part of your search.`,
      next: "Try again, or change your search.",
    },
    keyPermission: {
      title: "Your key can't run searches.",
      next: "Make a new key and connect it.",
    },
    accountNotAllowed: {
      title: "Your Pomerado account can't run this search.",
      next: "Check your account on Pomerado, then try again.",
    },
    toolMissing: {
      title: (site: string) => `${site} isn't available right now.`,
      next: "The other sites still work.",
    },
    siteNotSupported: {
      title: (site: string) => `Pomerado can't search ${site}.`,
      next: "The other sites still work.",
    },
    serviceProblem: {
      title: "Pomerado had a problem with this search.",
      next: "Try again in a minute.",
    },
    humanCheck: {
      title: (site: string) => `${site} asked for a human check.`,
      next: "Searching again usually gets past it.",
    },
    couldNotFinish: {
      title: (site: string) => `${site} couldn't finish this search.`,
      next: "Try again in a few minutes.",
    },
    noAnswer: {
      title: (site: string) => `${site} needed an answer that didn't come in time.`,
      next: "Search again when you're ready to answer.",
    },
    loginRejected: {
      title: (site: string) => `${site} turned down your saved login.`,
      next: "Fix the login on Pomerado, then search again.",
    },
    loginChoice: {
      title: (site: string) => `Pomerado couldn't pick a login for ${site}.`,
      next: "Check your saved logins on Pomerado.",
    },
    loginsLocked: {
      title: "Your saved logins are locked.",
      next: "Unlock them with your Logins PIN on Pomerado.",
    },
    signInDown: {
      title: (site: string) => `Signing in to ${site} isn't working right now.`,
      next: "Try again in a few minutes.",
    },
    resultGone: {
      title: "These results are no longer available.",
      next: "Search again.",
    },
    outOfRuns: {
      title: "Out of runs for today.",
      next: "Upgrade to Premium or wait for your runs to come back.",
    },
    keyStopped: {
      title: "Your key stopped working.",
      next: "Connect a new key to keep searching.",
    },
    unreachable: {
      title: "We couldn't reach Pomerado.",
      next: "Check your internet connection and try again.",
    },
    timedOut: {
      title: (site: string) => `${site} took too long.`,
      next: "Try again in a few minutes.",
    },
  },
  actions: {
    retry: "Try again",
  },
} as const;

// The mock sessions this user runs (a licensed centre's, or their own as a Premium teacher), and where they can make one.
export default defineEventHandler(async event => listSessions(await requireUser(event)))

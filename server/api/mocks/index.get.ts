// The mock sessions this teacher runs, and whether they can make one (their mock credits).
export default defineEventHandler(async event => listSessions(await requireUser(event)))

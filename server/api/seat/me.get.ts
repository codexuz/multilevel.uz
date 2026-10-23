// The seated candidate's screen: the sections, which are open, which are done.
export default defineEventHandler(async event => mySeat((await requireUser(event)).id))

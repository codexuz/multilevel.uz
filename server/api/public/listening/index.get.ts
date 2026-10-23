// The Listening parts with public answers (?exam=, ?page=).
export default defineEventHandler(event => answersHub('LISTENING', getQuery(event)))

// The Reading parts with public answers (?exam=, ?page=).
export default defineEventHandler(event => answersHub('READING', getQuery(event)))

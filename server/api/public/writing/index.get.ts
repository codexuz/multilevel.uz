// The Writing tasks with public pages (?exam=, ?task=, ?page=).
export default defineEventHandler(event => writingHub(getQuery(event)))

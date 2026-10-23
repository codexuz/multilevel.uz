// One Writing task as set, with the samples its writers chose to show.
export default defineEventHandler(event => writingPage(String(getRouterParam(event, 'slug'))))

// One Reading part's public answers, explanations and the words they come from.
export default defineEventHandler(event => answersPage('READING', String(getRouterParam(event, 'slug'))))

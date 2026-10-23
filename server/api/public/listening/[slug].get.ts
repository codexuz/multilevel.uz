// One Listening part's public answers, explanations and the words they come from.
export default defineEventHandler(event => answersPage('LISTENING', String(getRouterParam(event, 'slug'))))

// One of my attempts (or, for an examiner, anyone's) with its marked review.
export default defineEventHandler(async event => attemptView(getRouterParam(event, 'id')!, await requireUser(event)))

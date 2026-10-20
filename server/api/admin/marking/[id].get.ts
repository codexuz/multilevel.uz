// A Writing or Speaking attempt as the examiner marks it: the tasks, the essays, the recordings.
export default defineEventHandler(async event => attemptView(getRouterParam(event, 'id')!, await requireStaff(event)))

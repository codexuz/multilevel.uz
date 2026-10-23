// An announced mock result, from its link or QR code, with no sign-in.
export default defineEventHandler(event => report(String(getRouterParam(event, 'token'))))

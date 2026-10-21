// Checks a promo code as it is typed: what it gives, and each plan's price with it.
export default defineEventHandler(async (event) => {
  const user = await optionalUser(event)
  const promo = await usablePromo(getQuery(event).code, user?.id ?? null)
  const prices = Object.fromEntries((await activePlans())
    .filter(p => promo.kind !== 'DAYS' && (!promo.planCodes.length || promo.planCodes.includes(p.code)))
    .map(p => [p.code, priceWithPromo(promo, p.priceUzs)]))
  return { ...promoView(promo), prices }
})

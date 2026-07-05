import { redeemPremium } from '../../utils/gamify'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return await redeemPremium(user.id)
})

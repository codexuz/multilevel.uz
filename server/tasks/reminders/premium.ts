// Every hour: tell users whose Premium is about to end, or has just ended.
export default defineTask({
  meta: { name: 'reminders:premium', description: 'Telegram reminders before and after Premium ends' },
  async run() {
    return { result: await sendPremiumReminders() }
  }
})

// Every five minutes: remind students of online classes starting within half an hour.
export default defineTask({
  meta: { name: 'lessons:remind', description: 'Telegram reminders before online classes (Google Meet)' },
  async run() {
    return { result: await sendLiveReminders() }
  }
})

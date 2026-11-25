// Every hour: remind students of class work due within a day that they have not handed in.
export default defineTask({
  meta: { name: 'reminders:work', description: 'Telegram reminders for class work due soon' },
  async run() {
    return { result: await sendWorkDueReminders() }
  }
})

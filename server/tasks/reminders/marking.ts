// Every hour: remind teachers of their students' scripts that have waited over two days.
export default defineTask({
  meta: { name: 'reminders:marking', description: 'Telegram and push reminders for scripts waiting for a teacher' },
  async run() {
    return { result: await sendMarkingReminders() }
  }
})

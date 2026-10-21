// Every hour: announce live mocks that have started, and send each participant their place when one ends.
export default defineTask({
  meta: { name: 'live:mocks', description: 'Live mock announcements and results on Telegram' },
  async run() {
    return { result: await runLiveMocks() }
  }
})

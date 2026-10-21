// Russian nouns take one of three forms after a number (1 тест, 2 теста, 5 тестов): messages for
// ru give "one | few | many". Uzbek keeps the singular after numbers, so it needs one form.
export default defineI18nConfig(() => ({
  fallbackLocale: 'en',
  pluralRules: {
    ru(choice: number, choicesLength: number) {
      if (choice === 0 && choicesLength === 4) return 0
      const n = Math.abs(choice) % 100
      const offset = choicesLength === 4 ? 1 : 0
      if (n >= 11 && n <= 14) return 2 + offset
      if (n % 10 === 1) return 0 + offset
      if (n % 10 >= 2 && n % 10 <= 4) return 1 + offset
      return 2 + offset
    }
  }
}))

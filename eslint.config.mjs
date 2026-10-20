// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // The exam, review and builder code is shared with the erp-lms IELTS app and keeps its
  // conventions: loosely typed API payloads, one-line guards, best-effort storage access
  // (empty catches), and HTML written by test authors rendered as HTML.
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@stylistic/max-statements-per-line': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'vue/no-v-html': 'off'
    }
  }
).prepend({
  // The sample test (data, not code).
  ignores: ['examples/**']
})

// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // The admin test builder edits a shared reactive tree (sections/parts) in place
  // via v-model and then persists with explicit Save buttons — mutating these
  // passed-in objects is intentional.
  {
    files: ['app/components/admin/**', 'app/pages/admin/tests/**'],
    rules: {
      'vue/no-mutating-props': 'off'
    }
  }
).prepend({
  // Legacy reference files (Vue 2 / axios) and SQL — not part of the app.
  ignores: ['examples/**', 'supabase/**']
})

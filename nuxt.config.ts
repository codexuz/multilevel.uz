// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/supabase'
  ],
  devtools: {
    enabled: true
  },
  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Server-only S3 credentials
    s3Endpoint: process.env.S3_ENDPOINT,
    s3Region: process.env.S3_REGION,
    s3Bucket: process.env.S3_BUCKET,
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    public: {
      // Public base URL objects are served from (CDN / bucket public URL)
      s3PublicUrl: process.env.S3_PUBLIC_URL
    }
  },

  routeRules: {
    '/': { prerender: false }
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  supabase: {
    // Google OAuth is the default sign-in; unauthenticated users are sent to /login
    redirect: true,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/', '/upgrade']
    }
  }
})

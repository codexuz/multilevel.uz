const siteName = 'Multilevel'
const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || 'https://multilevel.uz').replace(/\/$/, '')
const siteDescription = 'Free online Multilevel (CEFR) English mock tests: Listening, Reading, Writing and Speaking in the official format, checked instantly.'
const noIndex = { robots: false, sitemap: false }

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    'nuxt-auth-utils',
    '@nuxtjs/robots',
    '@nuxtjs/sitemap'
  ],
  devtools: {
    enabled: true
  },
  css: ['~/assets/css/main.css'],
  site: {
    url: siteUrl,
    name: siteName,
    description: siteDescription,
    defaultLocale: 'en',
    indexable: process.env.NUXT_SITE_INDEXABLE !== 'false'
  },

  runtimeConfig: {
    // Database
    databaseUrl: process.env.DATABASE_URL,
    // JWT secrets
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    // Server-only S3 credentials
    s3Endpoint: process.env.S3_ENDPOINT,
    s3Region: process.env.S3_REGION,
    s3Bucket: process.env.S3_BUCKET,
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    // Click.uz merchant (SHOP API). Without these, plans are sold privately on Telegram.
    clickServiceId: process.env.CLICK_SERVICE_ID,
    clickMerchantId: process.env.CLICK_MERCHANT_ID,
    clickSecretKey: process.env.CLICK_SECRET_KEY,
    clickMerchantUserId: process.env.CLICK_MERCHANT_USER_ID,
    // Firebase Admin (push send)
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
    // Telegram sign-in (Login Widget): the bot's token from @BotFather
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    // Google OAuth (consumed by nuxt-auth-utils' defineOAuthGoogleEventHandler)
    oauth: {
      google: {
        clientId: process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID,
        clientSecret: process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET
      }
    },
    public: {
      siteUrl,
      // Where plans are bought privately when Click is not set up (an admin's Telegram).
      salesTelegram: process.env.NUXT_PUBLIC_SALES_TELEGRAM || process.env.NUXT_PUBLIC_TELEGRAM_URL || 'https://t.me/sizlidersizadmin2',
      socialLinks: {
        telegramUrl: process.env.NUXT_PUBLIC_TELEGRAM_URL || 'https://t.me/sizlidersizadmin2',
        youtubeUrl: process.env.NUXT_PUBLIC_YOUTUBE_URL || 'https://www.youtube.com/@multileveluz'
      },
      // Public base URL objects are served from (CDN / bucket public URL)
      s3PublicUrl: process.env.S3_PUBLIC_URL,
      // Firebase web SDK config (client FCM)
      firebase: {
        apiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
        messagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID,
        vapidKey: process.env.NUXT_PUBLIC_FIREBASE_VAPID_KEY
      }
    }
  },

  // Open to search engines: the home page, the catalogue and each test's page (/tests/{slug}).
  // Everything behind a sign-in is not indexed; sitting a section, its result and its review
  // (/tests/{slug}/{skill}/…) say noindex on the page itself.
  routeRules: {
    '/': { prerender: false },
    '/dashboard': { redirect: '/results' },
    '/admin/**': noIndex,
    '/billing/**': noIndex,
    '/builder/**': noIndex,
    '/marking/**': noIndex,
    '/login': noIndex,
    '/onboarding': noIndex,
    '/profile': noIndex,
    '/results/**': noIndex,
    '/settings': noIndex
  },

  compatibilityDate: '2026-06-30',
  vite: {
    optimizeDeps: {
      include: [
        '@nuxt/ui > prosemirror-state',
        '@nuxt/ui > prosemirror-transform',
        '@nuxt/ui > prosemirror-model',
        '@nuxt/ui > prosemirror-view',
        '@nuxt/ui > prosemirror-gapcursor'
      ]
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  sitemap: {
    sources: ['/api/__sitemap__/urls'],
    exclude: ['/admin/**', '/builder/**', '/marking/**', '/results/**', '/login', '/onboarding', '/profile', '/settings']
  }
})

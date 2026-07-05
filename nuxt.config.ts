// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    'nuxt-auth-utils'
  ],
  devtools: {
    enabled: true
  },
  css: ['~/assets/css/main.css'],

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
    // Firebase Admin (push send)
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
    // Google OAuth (consumed by nuxt-auth-utils' defineOAuthGoogleEventHandler)
    oauth: {
      google: {
        clientId: process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID,
        clientSecret: process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET
      }
    },
    public: {
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

  routeRules: {
    '/': { prerender: false }
  },

  nitro: {
    experimental: {
      // Enables defineWebSocketHandler for the live speaking signaling server
      websocket: true
    }
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})

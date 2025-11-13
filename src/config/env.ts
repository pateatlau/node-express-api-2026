import { z } from 'zod';

/**
 * Environment Variable Schema
 *
 * Validates all required environment variables at startup.
 * Provides type-safe access to environment configuration.
 */

const envSchema = z
  .object({
    // Node environment
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // Server configuration
    PORT: z
      .string()
      .default('4000')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0 && val < 65536, {
        message: 'PORT must be between 1 and 65535',
      }),

    // Database configuration
    DB_TYPE: z.enum(['postgres', 'mongodb'], {
      message: 'DB_TYPE must be either "postgres" or "mongodb"',
    }),

    DATABASE_URL: z.string().url().optional(),
    MONGODB_URL: z.string().url().optional(),

    // API configuration
    API_TYPE: z.enum(['rest', 'graphql', 'both']).default('both'),

    // CORS configuration
    CORS_ORIGIN: z.string().url().default('http://localhost:5173'),

    // Logging configuration
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info').optional(),

    // Proxy configuration
    TRUSTED_PROXY: z.string().optional().default('caddy'),

    // Instance identification (for load balancing)
    INSTANCE_ID: z.string().optional().default('backend-1'),
  })
  .refine(
    (data) => {
      // If DB_TYPE is postgres, DATABASE_URL must be provided
      if (data.DB_TYPE === 'postgres' && !data.DATABASE_URL) {
        return false;
      }
      return true;
    },
    {
      message:
        'DATABASE_URL is required when DB_TYPE is "postgres". Please set it in your .env file.',
      path: ['DATABASE_URL'],
    }
  )
  .refine(
    (data) => {
      // If DB_TYPE is mongodb, MONGODB_URL must be provided
      if (data.DB_TYPE === 'mongodb' && !data.MONGODB_URL) {
        return false;
      }
      return true;
    },
    {
      message:
        'MONGODB_URL is required when DB_TYPE is "mongodb". Please set it in your .env file.',
      path: ['MONGODB_URL'],
    }
  );

/**
 * Parsed and validated environment variables
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 * Throws an error with detailed message if validation fails
 */
function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Environment variable validation failed:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  return result.data;
}

/**
 * Validated environment variables
 * Use this throughout the application instead of process.env
 */
export const env = parseEnv();

/**
 * Helper function to check if running in development
 */
export const isDevelopment = () => env.NODE_ENV === 'development';

/**
 * Helper function to check if running in production
 */
export const isProduction = () => env.NODE_ENV === 'production';

/**
 * Helper function to check if running in test
 */
export const isTest = () => env.NODE_ENV === 'test';

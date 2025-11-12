import mongoose from 'mongoose';
import { prisma } from '../lib/prisma';
import logger from './logger';

/**
 * Database type from environment variable
 */
export type DatabaseType = 'postgres' | 'mongodb';

/**
 * Get database type from environment
 */
export const getDatabaseType = (): DatabaseType => {
  const dbType = process.env.DB_TYPE?.toLowerCase();

  if (dbType === 'mongodb') {
    return 'mongodb';
  }

  // Default to postgres for backward compatibility
  return 'postgres';
};

/**
 * Database connection manager
 * Handles connection and disconnection for both PostgreSQL (via Prisma) and MongoDB (via Mongoose)
 */
export class DatabaseConnection {
  private static isConnected = false;
  private static dbType: DatabaseType;

  /**
   * Connect to the database based on DB_TYPE environment variable
   */
  static async connect(): Promise<void> {
    if (this.isConnected) {
      logger.debug('Database already connected');
      return;
    }

    this.dbType = getDatabaseType();

    if (this.dbType === 'mongodb') {
      await this.connectMongoDB();
    } else {
      await this.connectPostgreSQL();
    }

    this.isConnected = true;
  }

  /**
   * Connect to MongoDB using Mongoose
   */
  private static async connectMongoDB(): Promise<void> {
    const mongoUrl = process.env.MONGODB_URL;

    if (!mongoUrl) {
      throw new Error(
        'MONGODB_URL environment variable is not defined. Please set it in your .env file.'
      );
    }

    try {
      await mongoose.connect(mongoUrl);
      logger.info('Connected to MongoDB', {
        host: new URL(mongoUrl).host,
        database: 'tododb',
      });

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error', { error: error.message });
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });
    } catch (error) {
      logger.error('Failed to connect to MongoDB', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Connect to PostgreSQL using Prisma
   * Prisma connects lazily on first query, so we just test the connection
   */
  private static async connectPostgreSQL(): Promise<void> {
    try {
      await prisma.$connect();
      logger.info('Connected to PostgreSQL');
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Disconnect from the database
   */
  static async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    if (this.dbType === 'mongodb') {
      await mongoose.disconnect();
      logger.info('Disconnected from MongoDB');
    } else {
      await prisma.$disconnect();
      logger.info('Disconnected from PostgreSQL');
    }

    this.isConnected = false;
  }

  /**
   * Check if database is connected
   */
  static isReady(): boolean {
    if (this.dbType === 'mongodb') {
      return mongoose.connection.readyState === 1;
    } else {
      return this.isConnected;
    }
  }

  /**
   * Get the current database type
   */
  static getType(): DatabaseType {
    return this.dbType;
  }
}

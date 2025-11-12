import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import logger from './logger';

// Redis connection for BullMQ
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
});

/**
 * Job data types
 */
export interface EmailJobData {
  to: string;
  subject: string;
  body: string;
  template?: string;
}

export interface NotificationJobData {
  userId: string;
  message: string;
  type: 'email' | 'push' | 'sms';
}

export interface DataProcessingJobData {
  dataId: string;
  operation: string;
  params?: Record<string, unknown>;
}

/**
 * Email Queue - for sending emails asynchronously
 */
export const emailQueue = new Queue<EmailJobData>('email', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

/**
 * Notification Queue - for sending notifications
 */
export const notificationQueue = new Queue<NotificationJobData>('notification', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

/**
 * Data Processing Queue - for heavy computations
 */
export const dataProcessingQueue = new Queue<DataProcessingJobData>('data-processing', {
  connection,
  defaultJobOptions: {
    attempts: 2,
  },
});

/**
 * Email Worker - processes email jobs
 */
export const emailWorker = new Worker<EmailJobData>(
  'email',
  async (job: Job<EmailJobData>) => {
    logger.info('Processing email job', {
      jobId: job.id,
      to: job.data.to,
      subject: job.data.subject,
    });

    // TODO: Implement actual email sending logic
    // Example: await emailService.send(job.data);

    // Simulate email sending
    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.info('Email sent successfully', {
      jobId: job.id,
      to: job.data.to,
    });

    return { sent: true, timestamp: new Date().toISOString() };
  },
  {
    connection,
    concurrency: 5, // Process 5 emails concurrently
  }
);

/**
 * Notification Worker - processes notification jobs
 */
export const notificationWorker = new Worker<NotificationJobData>(
  'notification',
  async (job: Job<NotificationJobData>) => {
    logger.info('Processing notification job', {
      jobId: job.id,
      userId: job.data.userId,
      type: job.data.type,
    });

    // TODO: Implement notification sending logic based on type
    // Example:
    // if (job.data.type === 'email') await sendEmail(...)
    // if (job.data.type === 'push') await sendPushNotification(...)
    // if (job.data.type === 'sms') await sendSMS(...)

    await new Promise((resolve) => setTimeout(resolve, 500));

    logger.info('Notification sent successfully', {
      jobId: job.id,
      userId: job.data.userId,
    });

    return { sent: true, timestamp: new Date().toISOString() };
  },
  {
    connection,
    concurrency: 10,
  }
);

/**
 * Data Processing Worker - processes heavy computations
 */
export const dataProcessingWorker = new Worker<DataProcessingJobData>(
  'data-processing',
  async (job: Job<DataProcessingJobData>) => {
    logger.info('Processing data job', {
      jobId: job.id,
      dataId: job.data.dataId,
      operation: job.data.operation,
    });

    // TODO: Implement data processing logic
    // Example: await processData(job.data);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    logger.info('Data processed successfully', {
      jobId: job.id,
      dataId: job.data.dataId,
    });

    return { processed: true, timestamp: new Date().toISOString() };
  },
  {
    connection,
    concurrency: 2, // Limit heavy operations
  }
);

/**
 * Queue Events - Listen to queue events
 */
const emailQueueEvents = new QueueEvents('email', { connection });
const notificationQueueEvents = new QueueEvents('notification', { connection });
const dataProcessingQueueEvents = new QueueEvents('data-processing', { connection });

// Email queue event listeners
emailQueueEvents.on('completed', ({ jobId }) => {
  logger.info('Email job completed', { jobId });
});

emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error('Email job failed', { jobId, reason: failedReason });
});

// Notification queue event listeners
notificationQueueEvents.on('completed', ({ jobId }) => {
  logger.info('Notification job completed', { jobId });
});

notificationQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error('Notification job failed', { jobId, reason: failedReason });
});

// Data processing queue event listeners
dataProcessingQueueEvents.on('completed', ({ jobId }) => {
  logger.info('Data processing job completed', { jobId });
});

dataProcessingQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error('Data processing job failed', { jobId, reason: failedReason });
});

/**
 * Helper functions to add jobs to queues
 */
export const queueEmail = async (
  data: EmailJobData,
  options?: { delay?: number; priority?: number }
) => {
  const job = await emailQueue.add('send-email', data, options);
  logger.info('Email job queued', { jobId: job.id, to: data.to });
  return job;
};

export const queueNotification = async (
  data: NotificationJobData,
  options?: { delay?: number }
) => {
  const job = await notificationQueue.add('send-notification', data, options);
  logger.info('Notification job queued', { jobId: job.id, userId: data.userId });
  return job;
};

export const queueDataProcessing = async (data: DataProcessingJobData) => {
  const job = await dataProcessingQueue.add('processData', data);
  logger.info('Data processing job queued', { jobId: job.id, dataId: data.dataId });
  return job;
};

/**
 * Graceful shutdown
 */
export const closeQueues = async (): Promise<void> => {
  await Promise.all([
    emailQueue.close(),
    notificationQueue.close(),
    dataProcessingQueue.close(),
    emailWorker.close(),
    notificationWorker.close(),
    dataProcessingWorker.close(),
    emailQueueEvents.close(),
    notificationQueueEvents.close(),
    dataProcessingQueueEvents.close(),
    connection.quit(),
  ]);
  logger.info('All queues and workers closed');
};

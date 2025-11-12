import { PubSub } from 'graphql-subscriptions';
import type { TodoDTO } from '../repositories/TodoRepository.interface.js';

/**
 * PubSub instance for GraphQL subscriptions
 * In production, consider using Redis PubSub for multi-instance support
 */
export const pubsub = new PubSub();

/**
 * Subscription event names
 */
export const TODO_EVENTS = {
  TODO_CREATED: 'TODO_CREATED',
  TODO_UPDATED: 'TODO_UPDATED',
  TODO_DELETED: 'TODO_DELETED',
  TODO_CHANGED: 'TODO_CHANGED',
} as const;

/**
 * Type-safe publish helpers
 */
export const publishTodoCreated = (todo: TodoDTO) => {
  pubsub.publish(TODO_EVENTS.TODO_CREATED, { todoCreated: todo });
  pubsub.publish(TODO_EVENTS.TODO_CHANGED, {
    todoChanged: {
      operation: 'CREATED',
      todo,
      deletedId: null,
    },
  });
};

export const publishTodoUpdated = (todo: TodoDTO) => {
  pubsub.publish(TODO_EVENTS.TODO_UPDATED, { todoUpdated: todo });
  pubsub.publish(TODO_EVENTS.TODO_CHANGED, {
    todoChanged: {
      operation: 'UPDATED',
      todo,
      deletedId: null,
    },
  });
};

export const publishTodoDeleted = (id: string) => {
  pubsub.publish(TODO_EVENTS.TODO_DELETED, { todoDeleted: id });
  pubsub.publish(TODO_EVENTS.TODO_CHANGED, {
    todoChanged: {
      operation: 'DELETED',
      todo: null,
      deletedId: id,
    },
  });
};

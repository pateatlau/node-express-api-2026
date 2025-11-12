/**
 * GraphQL Schema Directives for Authorization
 * Custom directives for field-level and type-level access control
 */

import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { defaultFieldResolver, GraphQLSchema, GraphQLError } from 'graphql';
import type { GraphQLContext } from './context.js';
import { Role } from '@prisma/client';

/**
 * Directive to require authentication
 * Usage: @requireAuth
 */
export function requireAuthDirective(directiveName: string = 'requireAuth') {
  return (schema: GraphQLSchema) =>
    mapSchema(schema, {
      [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
        const directive = getDirective(schema, fieldConfig, directiveName)?.[0];
        if (directive) {
          const { resolve = defaultFieldResolver } = fieldConfig;

          fieldConfig.resolve = async function (source, args, context: GraphQLContext, info) {
            // Check if user is authenticated
            if (!context.user) {
              throw new GraphQLError('Authentication required', {
                extensions: { code: 'UNAUTHENTICATED' },
              });
            }

            return resolve(source, args, context, info);
          };
        }
        return fieldConfig;
      },
    });
}

/**
 * Directive to require specific role
 * Usage: @requireRole(role: PRO)
 */
export function requireRoleDirective(directiveName: string = 'requireRole') {
  return (schema: GraphQLSchema) =>
    mapSchema(schema, {
      [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
        const directive = getDirective(schema, fieldConfig, directiveName)?.[0];
        if (directive) {
          const { resolve = defaultFieldResolver } = fieldConfig;
          const requiredRole = directive.role as Role;

          fieldConfig.resolve = async function (source, args, context: GraphQLContext, info) {
            const user = context.user;

            // Check authentication
            if (!user) {
              throw new GraphQLError('Authentication required', {
                extensions: { code: 'UNAUTHENTICATED' },
              });
            }

            // Check role
            if (user.role !== requiredRole) {
              throw new GraphQLError(`Access denied. Required role: ${requiredRole}`, {
                extensions: {
                  code: 'FORBIDDEN',
                  requiredRole,
                  userRole: user.role,
                },
              });
            }

            return resolve(source, args, context, info);
          };
        }
        return fieldConfig;
      },
    });
}

/**
 * Apply all authorization directives to schema
 */
export function applyAuthDirectives(schema: GraphQLSchema): GraphQLSchema {
  let transformedSchema = schema;
  transformedSchema = requireAuthDirective()(transformedSchema);
  transformedSchema = requireRoleDirective()(transformedSchema);
  return transformedSchema;
}

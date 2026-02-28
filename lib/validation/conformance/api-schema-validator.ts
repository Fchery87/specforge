/**
 * API Schema Validator
 * 
 * Validates that API spec sections contain valid endpoint definitions.
 */

import type { ConformanceValidator, ConformanceResult } from './index';

export const apiSchemaValidator: ConformanceValidator = {
  id: 'api-schema-validator',
  name: 'API Schema Validator',
  description: 'Validates API spec sections contain valid endpoint definitions',
  appliesToPhases: ['specs', 'techSpec'],
  validate: (content: string): ConformanceResult => {
    const issues: string[] = [];
    
    // Check for HTTP method mentions
    const httpMethods = /\b(GET|POST|PUT|PATCH|DELETE)\b/g;
    const methodMatches = content.match(httpMethods);
    if (!methodMatches || methodMatches.length < 2) {
      issues.push('API specification should define at least 2 HTTP endpoints');
    }
    
    // Check for endpoint paths
    const pathPattern = /(\/\w+)+/g;
    const pathMatches = content.match(pathPattern);
    if (!pathMatches || pathMatches.length < 2) {
      issues.push('API specification should include endpoint paths (e.g., /api/users)');
    }
    
    // Check for request/response documentation
    const hasRequestDocs = /request|body|payload/i.test(content);
    const hasResponseDocs = /response|status|code/i.test(content);
    
    if (!hasRequestDocs) {
      issues.push('API specification should document request formats');
    }
    if (!hasResponseDocs) {
      issues.push('API specification should document response formats');
    }
    
    // Check for content type mentions
    const contentTypes = /application\/json|content-type/i;
    if (!contentTypes.test(content)) {
      issues.push('API specification should mention content types (e.g., application/json)');
    }
    
    const score = Math.max(0, 100 - issues.length * 15);
    
    return {
      validatorId: 'api-schema-validator',
      passed: issues.length <= 1, // Allow 1 minor issue
      score,
      issues,
    };
  },
};

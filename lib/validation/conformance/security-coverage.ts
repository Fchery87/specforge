/**
 * Security Coverage Validator
 * 
 * Validates OWASP Top 10 coverage in security sections.
 */

import type { ConformanceValidator, ConformanceResult } from './index';
import type { ProjectConstitution } from '../constitution-schema';

// OWASP Top 10 categories (2021)
const OWASP_CATEGORIES = [
  { id: 'A01', name: 'Broken Access Control', keywords: ['access control', 'authorization', 'permission'] },
  { id: 'A02', name: 'Cryptographic Failures', keywords: ['encryption', 'hash', 'crypto', 'tls', 'ssl'] },
  { id: 'A03', name: 'Injection', keywords: ['injection', 'sql injection', 'xss', 'sanitize'] },
  { id: 'A04', name: 'Insecure Design', keywords: ['secure design', 'threat model', 'security by design'] },
  { id: 'A05', name: 'Security Misconfiguration', keywords: ['configuration', 'default credentials', 'error handling'] },
  { id: 'A06', name: 'Vulnerable Components', keywords: ['dependencies', 'vulnerable', 'outdated', 'cve'] },
  { id: 'A07', name: 'Authentication Failures', keywords: ['authentication', 'session', 'password', 'mfa', '2fa'] },
  { id: 'A08', name: 'Software Integrity Failures', keywords: ['integrity', 'ci/cd', 'supply chain'] },
  { id: 'A09', name: 'Logging Failures', keywords: ['logging', 'monitoring', 'audit', 'detection'] },
  { id: 'A10', name: 'Server-Side Request Forgery', keywords: ['ssrf', 'request forgery', 'url validation'] },
];

export const securityCoverageValidator: ConformanceValidator = {
  id: 'security-coverage',
  name: 'Security Coverage Validator',
  description: 'Validates OWASP Top 10 coverage in security sections',
  appliesToPhases: ['specs', 'techSpec'],
  validate: (content: string, constitution?: ProjectConstitution): ConformanceResult => {
    const issues: string[] = [];
    const contentLower = content.toLowerCase();
    
    // Check which OWASP categories are covered
    const coveredCategories: string[] = [];
    const uncoveredCategories: string[] = [];
    
    for (const category of OWASP_CATEGORIES) {
      const isCovered = category.keywords.some(keyword => 
        contentLower.includes(keyword.toLowerCase())
      );
      
      if (isCovered) {
        coveredCategories.push(category.name);
      } else {
        uncoveredCategories.push(category.name);
      }
    }
    
    // Calculate coverage percentage
    const coveragePercent = (coveredCategories.length / OWASP_CATEGORIES.length) * 100;
    
    // Report uncovered critical categories
    const criticalCategories = ['Broken Access Control', 'Cryptographic Failures', 'Injection', 'Authentication Failures'];
    const uncoveredCritical = uncoveredCategories.filter(cat => 
      criticalCategories.includes(cat)
    );
    
    if (uncoveredCritical.length > 0) {
      issues.push(`Missing critical security categories: ${uncoveredCritical.join(', ')}`);
    }
    
    if (coveragePercent < 50) {
      issues.push(`Security coverage is only ${Math.round(coveragePercent)}%. Should cover at least 50% of OWASP Top 10.`);
    }
    
    // Check if constitution security requirements are addressed
    if (constitution?.qualityStandards.security.requirements) {
      const securityReqs = constitution.qualityStandards.security.requirements;
      const unaddressedReqs = securityReqs.filter(req => 
        !contentLower.includes(req.toLowerCase())
      );
      
      if (unaddressedReqs.length > 0) {
        issues.push(`Constitution security requirements not addressed: ${unaddressedReqs.length} items`);
      }
    }
    
    const score = Math.round(coveragePercent);
    
    return {
      validatorId: 'security-coverage',
      passed: coveragePercent >= 50 && uncoveredCritical.length === 0,
      score,
      issues,
    };
  },
};

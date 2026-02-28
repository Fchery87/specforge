/**
 * Completeness Checker
 * 
 * Validates that all required sections are present in the generated artifact.
 */

import type { ConformanceValidator, ConformanceResult } from './index';
import type { ProjectConstitution } from '../constitution-schema';

export const completenessChecker: ConformanceValidator = {
  id: 'completeness-checker',
  name: 'Completeness Checker',
  description: 'Validates that all required sections are present and non-empty',
  appliesToPhases: ['brief', 'prd', 'specs', 'techSpec', 'domainModel'],
  validate: (content: string, constitution?: ProjectConstitution): ConformanceResult => {
    const issues: string[] = [];
    
    // Check for empty or minimal content
    if (!content || content.length < 100) {
      issues.push('Content is too short or empty');
    }
    
    // Check for required markdown headers
    const headerMatches = content.match(/^#{1,3}\s+.+$/gm);
    if (!headerMatches || headerMatches.length < 2) {
      issues.push('Document should have at least 2 section headers');
    }
    
    // Check for code blocks in technical specs
    if (content.includes('```')) {
      // Good - has code examples
    } else if (constitution?.techStack.frontend.framework) {
      issues.push('Technical specifications should include code examples');
    }
    
    // Check for bullet points or numbered lists
    const listMatches = content.match(/^\s*[-*\d]\.\s+.+$/gm);
    if (!listMatches || listMatches.length < 3) {
      issues.push('Document should include structured lists for requirements');
    }
    
    const score = Math.max(0, 100 - issues.length * 20);
    
    return {
      validatorId: 'completeness-checker',
      passed: issues.length === 0,
      score,
      issues,
    };
  },
};

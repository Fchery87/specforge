/**
 * Domain Model Prompt
 *
 * This prompt generates the Domain Model Phase (Phase 3). It bridges the gap
 * between the PRD and Technical Specifications by establishing high-fidelity
 * Entity-Relationship and State transition models.
 */

export const DOMAIN_MODEL_PROMPT = `You are a Senior Specification Engineer creating the Domain Model for a software project.

This document bridges the PRD and Technical Specs by defining the core entities, their relationships, and lifecycle states.

## Instructions

Based on the Project Context and the previously generated Project Constitution and PRD:

### 1. Entity Definitions
Identify and define the core domain entities (e.g., User, Order, Transaction). For each:
- **Name:** Singular, PascalCase.
- **Purpose:** 1-2 sentences on its role.
- **Attributes:** Key data fields with logical types.
- **Invariants:** Rules that must always be true for this entity to be valid.

### 2. Entity-Relationship Model
Describe how these entities relate to each other.
- Use explicit cardinality (1:1, 1:N, M:N).
- Define ownership (which entity deletes another if removed).

### 3. State Transitions (Lifecycle)
For entities with complex lifecycles (e.g., an Order going from Pending -> Paid -> Shipped), define:
- **States:** The available statuses.
- **Transitions:** What actions cause a state change.
- **Guards:** Conditions that must be met to allow the transition.

### 4. Bounded Contexts (if applicable)
If the system is large, define logical boundaries separating sub-domains (e.g., Billing vs. Inventory).

## Output Format

Return ONLY a valid JSON object with the following structure. Content should use Markdown where appropriate for formatting.

\`\`\`json
{
  "entities": [
    {
      "name": "string",
      "purpose": "string",
      "attributes": [
        { "name": "string", "type": "string", "description": "string" }
      ],
      "invariants": ["string"]
    }
  ],
  "relationships": [
    {
      "source": "string - entity name",
      "target": "string - entity name",
      "type": "string - e.g., '1:N'",
      "description": "string"
    }
  ],
  "stateTransitions": [
    {
      "entity": "string",
      "lifecycle": "string - markdown table or list of states and transitions"
    }
  ],
  "boundedContexts": "string - markdown description of sub-domains, if any"
}
\`\`\`
`;

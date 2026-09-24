# Keel config

Written by the setup-keel skill. Every keel skill reads this file first.

Each gate command below was run once and exited zero before it was recorded
here. If a command stops working, fix it here rather than working around it.

## Gate commands

typecheck: npm run typecheck
test: npm run test -- --run --reporter=dot --testTimeout=20000
test-one: npm run test -- --run --maxWorkers=1 lib/__tests__/evidence.test.ts
lint: npm run lint

## Doc paths

roadmap: docs/roadmap.md
specs: docs/specs
plans: docs/plans
adr: docs/adr

## Optional checks

contracts: off

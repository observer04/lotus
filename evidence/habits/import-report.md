# Lovable Import Report

Lockfile reconciliation: source 4 pass(es), normalized 2 pass(es).

## Float currency math
Status: clear
Count: 0
Evidence:
- none

## data-testid coverage
Status: review
Count: 7
Evidence:
- src/lib/error-page.ts:24
- src/lib/error-page.ts:25
- src/routes/__root.tsx:57
- src/routes/__root.tsx:66
- src/routes/index.tsx:154
- src/routes/index.tsx:162
- src/routes/index.tsx:230

## Typecheck baseline
Status: clear
Count: 0
Evidence:
- command exit: 0

## Lint baseline
Status: debt
Count: 1
Evidence:
- command exit: 1

## Banned patterns
Status: blocked
Count: 1
Evidence:
- AS_ANY src/routeTree.gen.ts:18

## Dependencies outside platform list
Status: review
Count: 64
Evidence:
- @eslint/js@^9.32.0 — development — review
- @hookform/resolvers@^5.2.2 — production — review
- @lovable.dev/vite-tanstack-config@^2.15.0 — development — review
- @radix-ui/react-accordion@^1.2.12 — production — review
- @radix-ui/react-alert-dialog@^1.1.15 — production — review
- @radix-ui/react-aspect-ratio@^1.1.8 — production — review
- @radix-ui/react-avatar@^1.1.11 — production — review
- @radix-ui/react-checkbox@^1.3.3 — production — review
- @radix-ui/react-collapsible@^1.1.12 — production — review
- @radix-ui/react-context-menu@^2.2.16 — production — review
- @radix-ui/react-dialog@^1.1.15 — production — review
- @radix-ui/react-dropdown-menu@^2.1.16 — production — review
- @radix-ui/react-hover-card@^1.1.15 — production — review
- @radix-ui/react-label@^2.1.8 — production — review
- @radix-ui/react-menubar@^1.1.16 — production — review
- @radix-ui/react-navigation-menu@^1.2.14 — production — review
- @radix-ui/react-popover@^1.1.15 — production — review
- @radix-ui/react-progress@^1.1.8 — production — review
- @radix-ui/react-radio-group@^1.3.8 — production — review
- @radix-ui/react-scroll-area@^1.2.10 — production — review
- @radix-ui/react-select@^2.2.6 — production — review
- @radix-ui/react-separator@^1.1.8 — production — review
- @radix-ui/react-slider@^1.3.6 — production — review
- @radix-ui/react-slot@^1.2.4 — production — review
- @radix-ui/react-switch@^1.2.6 — production — review
- @radix-ui/react-tabs@^1.1.13 — production — review
- @radix-ui/react-toggle@^1.1.10 — production — review
- @radix-ui/react-toggle-group@^1.1.11 — production — review
- @radix-ui/react-tooltip@^1.2.8 — production — review
- @tailwindcss/vite@^4.2.1 — production — review
- @tanstack/react-query@^5.101.1 — production — review
- @tanstack/react-router@1.170.18 — production — review
- @tanstack/react-start@1.168.32 — production — review
- @tanstack/router-plugin@1.168.23 — production — review
- @types/node@^22.16.5 — development — review
- @types/react@^19.2.0 — development — review
- @types/react-dom@^19.2.0 — development — review
- class-variance-authority@^0.7.1 — production — review
- clsx@^2.1.1 — production — review
- cmdk@^1.1.1 — production — review
- date-fns@^4.1.0 — production — review
- embla-carousel-react@^8.6.0 — production — review
- eslint@^9.32.0 — development — review
- eslint-config-prettier@^10.1.1 — development — review
- eslint-plugin-prettier@^5.2.6 — development — review
- eslint-plugin-react-hooks@^5.2.0 — development — review
- eslint-plugin-react-refresh@^0.4.20 — development — review
- globals@^15.15.0 — development — review
- input-otp@^1.4.2 — production — review
- lucide-react@^0.575.0 — production — review
- nitro@3.0.260603-beta — development — review
- prettier@^3.7.3 — development — review
- react-day-picker@^9.14.0 — production — review
- react-hook-form@^7.71.2 — production — review
- react-resizable-panels@^4.6.5 — production — review
- recharts@^2.15.4 — production — review
- sonner@^2.0.7 — production — review
- tailwind-merge@^3.5.0 — production — review
- tailwindcss@^4.2.1 — production — review
- tw-animate-css@^1.3.4 — production — review
- typescript-eslint@^8.56.1 — development — review
- vaul@^1.1.2 — production — review
- vite-tsconfig-paths@^6.0.2 — production — review
- zod@^3.24.2 — production — review

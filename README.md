# DismissalApp-PI2-2025-2
```
DismissalApp-PI2-2025-2
├─ .prettierrc
├─ app
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ [locale]
│     ├─ layout.tsx
│     └─ sign-in
│        └─ [[...sign-in]]
│           └─ page.tsx
├─ components
│  └─ dismissal
│     └─ dismissal-view.tsx (Incomplete)
├─ components.json
├─ convex
│  ├─ auth.config.ts
│  ├─ auth.ts
│  ├─ campus.ts
│  ├─ helpers.ts
│  ├─ queue.ts
│  ├─ schema.ts
│  ├─ students.ts
│  ├─ tsconfig.json
│  ├─ types.ts
│  └─ users.ts
├─ eslint.config.mjs
├─ i18n
│  ├─ request.ts
│  └─ routing.ts
├─ lib
│  ├─ locale-setup.ts
│  ├─ rbac.ts
│  ├─ role-utils.ts
│  └─ utils.ts
├─ LICENSE
├─ messages
│  ├─ en.json (Empty)
│  └─ es.json (Empty)
├─ middleware.ts
├─ next.config.ts
├─ package.json
├─ pnpm-lock.yaml
├─ postcss.config.mjs
├─ public
│  ├─ arrows.png
│  ├─ convex.svg
│  ├─ favicon.ico
│  ├─ oficial-logo-alt.png
│  └─ oficial-logo.png
├─ README.md
└─ tsconfig.json

```

## Convex Backend Tests

This project includes a suite of unit tests for the Convex backend functions, ensuring their correctness and adherence to business logic and authentication rules.

### How to Execute Tests

To run all Convex backend tests, navigate to the project root directory and execute the following command using `pnpm`:

```bash
pnpm test
```

This command will run all `.test.ts` files located within the `convex/` directory.

### Test File Descriptions

*   **`convex/campus.test.ts`**:
    *   **Purpose**: Contains tests for the Convex functions related to campus management.
    *   **Key functionalities tested**: Creating, retrieving, updating campuses, listing active campuses, retrieving campus statistics, and verifying role-based access control for campus creation (e.g., only superadmins can create campuses).

*   **`convex/users.test.ts`**:
    *   **Purpose**: Focuses on testing user-related Convex functions, particularly profile retrieval and authentication checks.
    *   **Key functionalities tested**: Retrieving the current user's profile when authenticated and ensuring a null profile is returned for unauthenticated users.

*   **`convex/students.test.ts`**:
    *   **Purpose**: Provides test coverage for Convex functions that manage student data.
    *   **Key functionalities tested**: Creating, retrieving, updating, and deleting student records, assigning and removing car numbers for students, and verifying authentication requirements for student creation.

*   **`convex/queue.test.ts`**:
    *   **Purpose**: Tests the Convex functions responsible for managing the dismissal queue.
    *   **Key functionalities tested**: Adding cars to the queue, removing cars from the queue, moving cars between different lanes in the queue, and retrieving the current state of the dismissal queue.

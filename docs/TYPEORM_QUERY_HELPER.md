# TypeORM Query Helper Documentation

The `TypeOrmQueryHelper` is an advanced, backend-driven abstraction engine designed to dramatically simplify frontend data querying. It handles secure data exposure, smart relational joining, automated JSONB (`->>`) localization, and dynamic PostgreSQL operations without cluttering your NestJS Service layers.

---

## 1. The Request Flow (Lifecycle)

When a Frontend/Client request hits the endpoint (e.g., `GET /users?email_like=admin&lang=ps&sort=createdAt:DESC`), it travels through a strict lifecycle:

1. **Network Layer**: The request reaches the NestJS Express/Fastify adapter.
2. **Global Middlewares & Guards**: NestJS verifies JWT authenticity and CORS.
3. **Global ValidationPipe (`main.ts`)**: 
   - Normally, NestJS strictly strips parameters evaluating against a DTO class.
   - *Bypass Concept*: We type controller endpoints loosely (`@Query() options: Record<string, any>`) so the global validation pipe intentionally bypasses enforcing a schema on the raw HTTP queries, allowing nested custom parameters (e.g. `hasSocket=true`) to flow through freely.
4. **Controller (`users.controller.ts`)**: Receives the raw query dictionary and casts it as `QueryOptionsDto`, forwarding it strictly to the Service.
5. **Service (`users.service.ts`)**: Initializes the `TypeOrmQueryHelper`, injecting the **whitelisted configuration** `QueryConfig` defining exactly what the frontend is allowed to poke at, overriding malicious attempts.
6. **Query Helper Extractor (`typeorm-query.helper.ts`)**: Recursively transpiles frontend logic into raw TypeORM `SelectQueryBuilder` objects.
7. **PostgreSQL**: The heavily optimized, dynamically joined SQL query is executed accurately.

---

## 2. Dynamic Configurations & Architectures

The Helper relies exclusively on the `QueryConfig` definition injected at the `Service` level.

### Configuration Template
```typescript
{
  selectFields: ['id', 'email', 'profileImage.path'], // Limits data
  searchableFields: ['firstName', 'lastName'],        // Global Search Keys
  filterableFields: { 
    isActive: 'isActive',                             // Standard Native Map
    hasInApp: 'notificationOptions.inapp'             // Deep Relation Alias
  },
  defaultSort: 'isActive:DESC,createdAt:DESC',        // Native Fallback
  translatedFields: ['name', 'description']           // Multi-lang Support
}
```

---

## 3. Practical Usage & Features (User Entity Example)

Below are the robust engines inside the Helper accompanied by exact, highly practical URL query definitions based on the `User` Entity.

### A. Flat Relational Filtering & Operators
Because frontend syntax has been completely flattened, complex bracket queries `filters[email]=ahmad` are eliminated. The system uses **Suffix Operators** mapped directly against `filterableFields`.

Supported Operators: 
- `_eq` (default), `_ne` (Not Equal), `_gt` (Greater Than), `_gte`, `_lt`, `_lte`, `_in`, `_ilike`, `_like`, `_null`.

**Examples:**
* Fetch users created physically bigger than 1MB profile images:
  * `GET /users?imageSize_gt=1000` *(Translates to `"profileImage"."size" > 1000`)*
* Fetch users that DO NOT use whatsapp:
  * `GET /users?whatsapp_null=true` *(Translates to `"u"."whatsappNumber" IS NULL`)*
* Get user statuses with an arbitrary ID:
  * `GET /users?id_in=2,5,7`

### B. Global Relational Searching
Instead of the frontend passing an array of fields, you pass a single query key: `?search=term`.
The `searchableFields` array safely brackets `Brackets((qb) => ...)` an `ILIKE` statement across all registered paths gracefully.

**Example:**
* Discover any user associated with Google:
  * `GET /users?search=google` 
  * *(Evaluates SQL: `u.email ILIKE '%google%' OR u.lastName ILIKE '%google%' OR "notificationOptions"."email" ILIKE '%google%'`)*

> [!TIP]
> The engine automatically generates explicit `LEFT JOIN` commands under the hood when parsing a dot-notation mapping. It NEVER joins tables manually unless explicitly requested by the frontend parameter or specific configurations!

### C. Automated Sorting & Pagination
The engine converts flat String parameters into DB parameters. If a parameter isn't provided, it cleanly falls back to the `defaultSort` defined. Wait! Both explicit strings and aliased definitions dictate exactly what is possible.

**Examples:**
* Native default fetch:
  * `GET /users?page=2&limit=5` *(Defaults sorting descending based on newest users)*
* Explicit mapped sorting:
  * `GET /users?sort=fileName:DESC` *(Seamlessly orders alphabetically against the nested relation alias mapped in configure (`profileImage.originalName`))*

### D. Multi-Language Queries (JSONB Transpilation)
The most sophisticated part of the query helper involves extracting localized objects `{ "en": "John", "ps": "جان" }` directly inside PostgreSQL utilizing `jsonb` array definitions without sacrificing Node.js RAM. 

If any dictionary element is injected into `translatedFields`, the database rewires all components specifically substituting `"u"."name"` with `"u"."name" ->> :lang`.

**Examples:**
* Suppose `description` is a configured JSON variable. Pashto execution:
  * `GET /users?lang=ps&search=جان`
  * *(Evaluates Search: `"u"."description" ->> 'ps' ILIKE '%جان%'`)*
  * *(Evaluates Result payload mapping: `{ "description": "جان" }` ensuring frontend only sees the flat localized string)*

---

## 4. Stability Guarantees

- **Ambiguity Protections**: Overlapping IDs across `users` and linked relationships (like `files`) have been strictly aliased away using variable-isolated pathings (i.e. `u_id`, `notificationOptions_id`) to avoid `column reference is ambiguous` TypeORM exceptions.
- **Pagination Distinct Exceptions**: TypeORM normally struggles managing limit/skip counting while manually mapping selects dynamically. This codebase protects `getManyAndCount` operations automatically by forcibly evaluating `.expressionMap` structures mapping raw IDs required for recursive pagination counts.

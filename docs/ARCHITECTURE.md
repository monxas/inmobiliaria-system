# Architecture Documentation

## System Overview

The Inmobiliaria System follows a **Clean Architecture** / **Hexagonal Architecture** pattern with clear separation of concerns.

## Layer Diagram

```mermaid
graph TB
    subgraph "Presentation Layer"
        R[Routes]
        C[Controllers]
        M[Middleware]
    end
    
    subgraph "Application Layer"
        S[Services]
        V[Validation Schemas]
    end
    
    subgraph "Domain Layer"
        T[Types & Entities]
        E[Errors]
        G[Guards]
    end
    
    subgraph "Infrastructure Layer"
        Rep[Repositories]
        DB[(PostgreSQL)]
        FS[File Storage]
    end
    
    R --> M --> C
    C --> V --> S
    S --> T
    S --> Rep
    Rep --> DB
    S --> FS
    E -.-> C
    E -.-> S
    G -.-> M
```

## CRUD Flow Diagram

```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant Validation
    participant Service
    participant Repository
    participant Database
    
    Client->>Controller: HTTP Request
    Controller->>Validation: Parse & Validate Input
    alt Validation Failed
        Validation-->>Controller: ValidationError
        Controller-->>Client: 400 Bad Request
    else Validation Success
        Validation-->>Controller: Validated Data
        Controller->>Service: Business Logic
        Service->>Repository: Data Operation
        Repository->>Database: SQL Query
        Database-->>Repository: Result
        Repository-->>Service: Entity/Entities
        Service-->>Controller: Processed Result
        Controller-->>Client: JSON Response
    end
```

## Component Architecture

```mermaid
graph LR
    subgraph "API Layer"
        Routes[Hono Routes]
        Auth[Auth Middleware]
        RateLimit[Rate Limiter]
        Validation[Zod Validation]
    end
    
    subgraph "Business Layer"
        UsersSvc[Users Service]
        PropSvc[Properties Service]
        ClientsSvc[Clients Service]
        DocsSvc[Documents Service]
        AuthSvc[Auth Service]
    end
    
    subgraph "Data Layer"
        UsersRepo[Users Repository]
        PropRepo[Properties Repository]
        ClientsRepo[Clients Repository]
        DocsRepo[Documents Repository]
        TokensRepo[Tokens Repository]
    end
    
    subgraph "Storage"
        PG[(PostgreSQL)]
        FileSystem[(File System)]
    end
    
    Routes --> Auth --> RateLimit --> Validation
    Validation --> UsersSvc & PropSvc & ClientsSvc & DocsSvc & AuthSvc
    UsersSvc --> UsersRepo
    PropSvc --> PropRepo
    ClientsSvc --> ClientsRepo
    DocsSvc --> DocsRepo
    AuthSvc --> TokensRepo
    UsersRepo & PropRepo & ClientsRepo & DocsRepo & TokensRepo --> PG
    DocsSvc --> FileSystem
```

## Type System Hierarchy

```mermaid
classDiagram
    class StandardEntity {
        +id: number
        +createdAt: Date
        +updatedAt: Date?
        +deletedAt: Date?
    }
    
    class User {
        +email: Email
        +passwordHash: string
        +role: UserRole
        +fullName: string
    }
    
    class Property {
        +title: string
        +address: string
        +price: Price
        +propertyType: PropertyType
        +status: PropertyStatus
    }
    
    class Client {
        +fullName: string
        +email: Email?
        +phone: Phone?
    }
    
    class Document {
        +filename: string
        +filePath: FilePath
        +category: FileCategory
    }
    
    StandardEntity <|-- User
    StandardEntity <|-- Property
    StandardEntity <|-- Client
    StandardEntity <|-- Document
```

## Error Handling Flow

```mermaid
flowchart TD
    E[Exception Thrown] --> Check{Is AppError?}
    Check -->|Yes| Operational{Is Operational?}
    Check -->|No| Wrap[Wrap in AppError]
    Wrap --> Log500[Log & 500 Response]
    
    Operational -->|Yes| Status{Check Status Code}
    Operational -->|No| Log500
    
    Status -->|4xx| Client[Client Error Response]
    Status -->|5xx| Server[Log & Server Error Response]
    
    Client --> Response[JSON Error Response]
    Server --> Response
    Log500 --> Response
```

## Design Patterns Used

### 1. Repository Pattern
- Abstracts data access layer
- Enables swapping data sources
- Provides type-safe queries

### 2. Service Pattern
- Contains business logic
- Orchestrates repositories
- Validates business rules

### 3. Controller Pattern
- Handles HTTP concerns
- Delegates to services
- Formats responses

### 4. Factory Pattern (Implicit)
- Schema validation creates validated objects
- Type-safe object construction

### 5. Strategy Pattern
- Filter builders in repositories
- Different validation strategies per route

### 6. Observer Pattern (Logging)
- Centralized logging
- Decoupled from business logic

## SOLID Principles Enforcement

### Single Responsibility (S)
- Each class has one reason to change
- Controllers handle HTTP only
- Services handle business logic only
- Repositories handle data only

### Open/Closed (O)
- Base classes extendable without modification
- New entities via extension, not modification

### Liskov Substitution (L)
- Subclasses work wherever base class expected
- CRUDService subclasses maintain contract

### Interface Segregation (I)
- Small, focused interfaces
- Type-specific filters per entity

### Dependency Inversion (D)
- High-level modules independent of low-level
- Dependencies flow inward to domain

## Security Layers

```mermaid
graph TB
    subgraph "Request Pipeline"
        Req[Incoming Request]
        Cors[CORS Check]
        Headers[Security Headers]
        Rate[Rate Limiting]
        Auth[JWT Verification]
        Role[Role Check]
        Input[Input Validation]
        Handler[Route Handler]
    end
    
    Req --> Cors --> Headers --> Rate --> Auth --> Role --> Input --> Handler
    
    Cors -->|Fail| Reject1[403 Forbidden]
    Rate -->|Fail| Reject2[429 Too Many]
    Auth -->|Fail| Reject3[401 Unauthorized]
    Role -->|Fail| Reject4[403 Forbidden]
    Input -->|Fail| Reject5[400 Bad Request]
```

## File Structure

```
backend/
├── src/
│   ├── controllers/     # HTTP handlers
│   │   ├── base/        # Abstract base controller
│   │   └── *.controller.ts
│   ├── services/        # Business logic
│   │   ├── base/        # Abstract base service
│   │   └── *.service.ts
│   ├── repositories/    # Data access
│   │   ├── base/        # Abstract base repository
│   │   └── *.repository.ts
│   ├── middleware/      # Request pipeline
│   ├── routes/          # Route definitions
│   ├── validation/      # Zod schemas
│   ├── types/           # TypeScript types
│   │   ├── branded.ts   # Branded types
│   │   ├── result.ts    # Result pattern
│   │   ├── utility.ts   # Utility types
│   │   ├── guards.ts    # Type guards
│   │   └── errors.ts    # Error classes
│   ├── utils/           # Helpers
│   ├── lib/             # Core utilities
│   │   ├── constants.ts # Magic numbers eliminated
│   │   └── logger.ts    # Structured logging
│   └── database/        # DB connection & schema
├── tests/               # Test suites
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── security/
│   └── performance/
└── drizzle.config.ts
```

## Performance Considerations

1. **Database**
   - Connection pooling (2-10 connections)
   - Indexed queries on common filters
   - Soft deletes for audit trail

2. **API**
   - Pagination on all list endpoints
   - Rate limiting per endpoint type
   - Gzip compression

3. **Memory**
   - Streaming for file uploads
   - Lazy loading where applicable
   - No memory caching (stateless)

## Scalability Path

```mermaid
graph LR
    subgraph "Current: Single Instance"
        App1[Hono App]
        PG1[(PostgreSQL)]
    end
    
    subgraph "Scale Out: Multiple Instances"
        LB[Load Balancer]
        App2[Instance 1]
        App3[Instance 2]
        App4[Instance N]
        PG2[(PostgreSQL Primary)]
        PG3[(Read Replica)]
        Redis[(Redis Cache)]
    end
    
    App1 --> PG1
    LB --> App2 & App3 & App4
    App2 & App3 & App4 --> Redis
    Redis --> PG2
    PG2 --> PG3
```

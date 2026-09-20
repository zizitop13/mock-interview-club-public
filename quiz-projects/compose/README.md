# Shared infrastructure

Reusable external dependencies belong here when an embedded implementation would hide the behavior being tested:

```text
compose/
├── postgresql/
│   ├── compose.yml
│   ├── .env.example
│   └── init/
├── kafka/
│   ├── compose.yml
│   └── .env.example
└── redis/
    ├── compose.yml
    └── .env.example
```

Keep generic stacks shared. Add a `compose.yml` inside a quiz module only when that quiz requires a unique topology or configuration.

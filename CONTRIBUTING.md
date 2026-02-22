# Contributing to Wolaro

First off, thank you for considering contributing to Wolaro! ❤️

It's people like you that make Wolaro such a great tool for the Discord community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Commit Guidelines](#commit-guidelines)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. We do not tolerate harassment or discrimination.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community

**Unacceptable behavior includes:**
- Trolling, insulting/derogatory comments
- Public or private harassment
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When you create a bug report, include:

- **Clear title and description**
- **Steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **Environment** (OS, Node version, etc.)
- **Logs/Screenshots** if applicable

### Suggesting Features

Feature suggestions are tracked as GitHub issues. When suggesting:

- **Use a clear title**
- **Provide detailed description**
- **Explain use cases**
- **Consider implementation complexity**

### Code Contributions

We actively welcome your pull requests!

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Write/update tests
5. Update documentation
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Git

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Wolaro2.git
cd Wolaro2

# Add upstream remote
git remote add upstream https://github.com/theo7791l/Wolaro2.git

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure .env with your credentials
nano .env

# Run migrations
npm run migrate

# Start development server
npm run dev
```

### Project Structure

```
src/
├── api/              # REST API routes and middlewares
├── cache/            # Redis cache manager
├── commands/         # Command handler
├── database/         # PostgreSQL manager
├── events/           # Event handler
├── modules/          # Bot modules
│   ├── moderation/
│   ├── economy/
│   ├── leveling/
│   ├── music/
│   └── admin/
├── utils/            # Utilities (logger, security)
├── websocket/        # WebSocket server
├── cluster.ts        # Cluster manager
├── config.ts         # Configuration
├── index.ts          # Entry point
└── types.ts          # TypeScript types
```

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] No merge conflicts

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How has this been tested?

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

## Style Guidelines

### TypeScript

```typescript
// Good
const getUserBalance = async (userId: string): Promise<number> => {
  const result = await database.query(
    'SELECT balance FROM users WHERE id = $1',
    [userId]
  );
  return result[0]?.balance || 0;
};

// Bad
const getUserBalance = async (userId) => {
  let result = await database.query('SELECT balance FROM users WHERE id = ' + userId);
  return result[0].balance;
};
```

### Key Principles

1. **Use TypeScript strictly** - No `any` types
2. **Async/await over promises** - More readable
3. **Destructure when possible** - Cleaner code
4. **Use arrow functions** - Consistent style
5. **Single responsibility** - One function, one purpose

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Interfaces**: `IPascalCase`

### Code Organization

```typescript
// 1. Imports
import { Client } from 'discord.js';
import { DatabaseManager } from '../database/manager';

// 2. Interfaces/Types
interface UserData {
  id: string;
  balance: number;
}

// 3. Constants
const MAX_BALANCE = 1000000;

// 4. Main code
export class EconomyService {
  // Implementation
}
```

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only
- **style**: Code style (formatting, semicolons, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvement
- **test**: Adding/updating tests
- **chore**: Maintenance tasks

### Examples

```bash
# Good commits
feat(economy): add daily streak bonus system
fix(moderation): resolve ban permission check
docs(api): update WebSocket event documentation
refactor(database): optimize guild config query

# Bad commits
Update stuff
Fixed bug
WIP
```

### Scope Examples

- `economy`, `moderation`, `leveling`, `music`, `admin`
- `api`, `database`, `cache`, `websocket`
- `docker`, `tests`, `docs`

## Testing

### Writing Tests

```typescript
import { SecurityManager } from '../src/utils/security';

describe('SecurityManager', () => {
  describe('sanitizeInput', () => {
    it('should remove script tags', () => {
      const input = '<script>alert("XSS")</script>';
      const result = SecurityManager.sanitizeInput(input);
      expect(result).not.toContain('<script>');
    });
  });
});
```

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm test -- --coverage # With coverage
```

## Module Development

See [docs/MODULES.md](docs/MODULES.md) for detailed guide on creating modules.

### Quick Template

```typescript
// src/modules/my-module/index.ts
import { IModule } from '../../types';
import { z } from 'zod';

export const MyModuleConfigSchema = z.object({
  enabled: z.boolean().default(true),
  // Add your config options
});

export default class MyModule implements IModule {
  name = 'my-module';
  description = 'Module description';
  version = '1.0.0';
  author = 'Your Name';
  configSchema = MyModuleConfigSchema;
  defaultConfig = { enabled: true };
  
  commands = [];
  events = [];

  constructor(private client, private database, private redis) {}
}
```

## Documentation

When adding features, update:

- `README.md` - If adding major features
- `CHANGELOG.md` - All changes
- `docs/*.md` - Relevant documentation
- Code comments - Complex logic

## Questions?

- **Discord**: [Join our server](https://discord.gg/wolaro)
- **Issues**: [GitHub Issues](https://github.com/theo7791l/Wolaro2/issues)
- **Email**: theo7791l@example.com

---

Thank you for contributing to Wolaro! 🚀

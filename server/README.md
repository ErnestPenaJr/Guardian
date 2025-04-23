# Guardian MVP Backend

This is the Express backend for Guardian MVP.

## Features
- `/api/register` endpoint for user registration
- Input validation with Zod
- SQL Server database via Prisma
- Email verification token generation

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npx ts-node server/index.ts
   ```

## Environment Variables
- `PORT`: (optional) Port to run server (default: 4001)
- Database connection: Managed by Prisma

## Next Steps
- Implement email sending logic in `/api/register`
- Add endpoints for email verification
- Add password support if needed

# CuratorWatch

Track DeFi vault curators. Real-time intelligence on vault curators across Morpho and beyond.

## Features

- Monitor 33+ curators managing $721M+ in Morpho V2 vaults
- Track vault parameter changes in real-time
- Risk intelligence and curator analytics
- Historical performance data

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env
```

3. Start database services:

```bash
docker compose up -d
```

4. Run database migrations:

```bash
npm run db:push
```

5. Collect initial data:

```bash
npm run collect
```

6. Start development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run collect` - Fetch vault data from Morpho API
- `npm run scheduler` - Run data collection scheduler
- `npm run db:studio` - Open Prisma Studio

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- PostgreSQL + Prisma
- Morpho GraphQL API

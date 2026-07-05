# Kilo Code Backend

Next.js-based API server for the Kilo Code AI engineering platform.

## Overview

The Kilo Code Backend provides the server-side API that powers the mobile and web interfaces. It implements planning, authentication, and repository management endpoints for the Kilo Code ecosystem.

## Architecture

The backend is built with Next.js and includes the following API routes:

- `/api/auth` - Authentication and provider management
- `/api/planning` - Planning and issue management (GitHub integration)
- `/api/repo` - Repository management operations

## API Endpoints

### Planning API

#### GET `/api/planning`
List all milestones:

```bash
gh api "repos/{owner}/{repo}/milestones?state=all&per_page=100" --jq '.[] | {number, title, description, state, open_issues, closed_issues, html_url, created_at, updated_at, due_on}'
```

Get issues for a specific milestone:
```bash
gh issue list --milestone "{milestoneNumber}" --state "{state}" --json number,title,body,state,labels,milestone,htmlUrl,assignee,comments,createdAt,updatedAt
```

#### POST `/api/planning`
Create a milestone:
```json
{
  "type": "milestone",
  "title": "string",
  "description": "string",
  "dueOn": "YYYY-MM-DD"
}
```

Create an issue:
```json
{
  "type": "issue",
  "title": "string",
  "body": "string",
  "milestone": "number",
  "labels": ["string"]
}
```

#### PATCH `/api/planning`
Update an issue state:
```json
{
  "issueNumber": "number",
  "state": "open|closed"
}
```

## Dependencies

- Node.js
- bun (package manager)
- GitHub CLI (gh)
- Next.js (framework)

## Configuration

The backend uses GitHub environment variables:

- `GITHUB_REPO_OWNER` - GitHub repository owner
- `GITHUB_REPO_NAME` - GitHub repository name

## Running

```bash
# Install dependencies
bun install

# Start development server
bun dev

# Build for production
bun build

# Start production server
bun start

# Type checking
bun typecheck

# Linting
bun lint
```

## Project Structure

```
.
├── app/
│   ├── api/
│   │   ├── auth/
│   │   ├── planning/
│   │   └── repo/
│   ├── components/ (if any)
│   ├── layout.tsx
│   └── page.tsx
├── config/
├── lib/
├── public/
├── types/
└── README.md (this file)
```

## Authentication

The backend requires GitHub authentication via the GitHub CLI (`gh`). The server will return a 401 error if not authenticated.

## Error Handling

The backend provides standardized error responses:

- **401** - GitHub not authenticated
- **400** - Invalid request payload
- **500** - Internal server error

## Local Development

### Setup Environment

```bash
# Set GitHub repository (optional for planning features)
export GITHUB_REPO_OWNER="your-org"
export GITHUB_REPO_NAME="your-repo"
```

### Available Scripts

- `dev` - Start Next.js development server
- `build` - Build for production
- `start` - Start production server
- `lint` - Run ESLint
- `typecheck` - Run TypeScript type checking

## Production

For production deployment, use the `start` script after building with `build`. The server can be deployed to Vercel, AWS, or any other platform that supports Next.js.

## Testing

Currently, the backend doesn't have automated tests defined. Test planning is handled by the parent project.

## License

MIT License

Copyright (c) 2026 Kilo Code

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

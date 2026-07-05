import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

const REPOS_DIR = '/tmp/kilo-repos';

function ensureReposDir() {
  const { mkdirSync } = require('fs');
  if (!existsSync(REPOS_DIR)) {
    mkdirSync(REPOS_DIR, { recursive: true });
  }
}

function sanitizeRepoName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function toDisplayName(name: string): string {
  // Convert filesystem-safe name back to "owner/repo" format
  return name.replace(/^([^_]+)_(.+)$/, '$1/$2');
}

export async function POST(request: Request) {
  try {
    const { action, repo } = await request.json();

    if (!action || !repo) {
      return NextResponse.json(
        { error: 'action and repo are required' },
        { status: 400 }
      );
    }

    if (action !== 'clone' && action !== 'reopen' && action !== 'create') {
      return NextResponse.json(
        { error: 'action must be "clone", "reopen", or "create"' },
        { status: 400 }
      );
    }

    if (action === 'create') {
      // Create accepts a simple name (not owner/repo format)
      if (!/^[a-zA-Z0-9._-]+$/.test(repo)) {
        return NextResponse.json(
          { error: 'Repository name must contain only letters, numbers, dots, hyphens, and underscores' },
          { status: 400 }
        );
      }

      ensureReposDir();
      const repoDir = join(REPOS_DIR, sanitizeRepoName(repo));

      if (existsSync(repoDir)) {
        return NextResponse.json({
          success: true,
          path: repoDir,
          message: 'Repository directory already exists',
          alreadyCloned: true,
        });
      }

      // Create the directory
      const { mkdirSync } = require('fs');
      mkdirSync(repoDir, { recursive: true });

      return NextResponse.json({
        success: true,
        path: repoDir,
        message: 'Repository created successfully',
        alreadyCloned: false,
      });
    }

    // clone and reopen require owner/repo format
    if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo)) {
      return NextResponse.json(
        { error: 'repo must be in "owner/repo" format' },
        { status: 400 }
      );
    }

    ensureReposDir();
    const repoDir = join(REPOS_DIR, sanitizeRepoName(repo));

    if (action === 'reopen') {
      if (existsSync(repoDir)) {
        return NextResponse.json({
          success: true,
          path: repoDir,
          message: 'Repository already cloned',
          alreadyCloned: true,
        });
      }

      return NextResponse.json(
        { error: 'Repository not found. Clone it first.' },
        { status: 404 }
      );
    }

    // action === 'clone'
    if (existsSync(repoDir)) {
      return NextResponse.json({
        success: true,
        path: repoDir,
        message: 'Repository already cloned',
        alreadyCloned: true,
      });
    }

    // Clone using gh CLI (authenticated via /api/auth/github)
    const { stdout, stderr } = await execAsync(
      `gh repo clone "${repo}" "${repoDir}" -- --depth 1`,
      { timeout: 120000 }
    );

    if (!existsSync(join(repoDir, '.git'))) {
      return NextResponse.json(
        { error: 'Clone failed', details: stderr || stdout },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      path: repoDir,
      message: 'Repository cloned successfully',
      alreadyCloned: false,
    });
  } catch (error: any) {
    console.error('Repo operation error:', error);

    const errMsg = error.message || '';
    if (errMsg.includes('not authenticated') || errMsg.includes('gh auth')) {
      return NextResponse.json(
        { error: 'GitHub not authenticated. Please authenticate first via /api/auth/github' },
        { status: 401 }
      );
    }
    if (errMsg.includes('Could not resolve') || errMsg.includes('404')) {
      return NextResponse.json(
        { error: 'Repository not found or not accessible' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process repository', details: errMsg },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    ensureReposDir();
    const { readdirSync, statSync } = require('fs');

    // List local clones
    const localRepos = readdirSync(REPOS_DIR)
      .filter((name: string) => !name.startsWith('.'))
      .map((name: string) => {
        const fullPath = join(REPOS_DIR, name);
        try {
          const stat = statSync(fullPath);
          return {
            name: toDisplayName(name),
            path: fullPath,
            modified: stat.mtime.toISOString(),
            source: 'local',
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // List GitHub account repos via gh api
    let githubRepos: any[] = [];
    try {
      const { stdout } = await execAsync(
        `gh api user/repos --paginate -q '.[] | {name, full_name, description, stargazers_count, updated_at, html_url}'`,
        { timeout: 60000, env: { ...process.env, HOME: '/home/ubuntu' } }
      );
      // gh api with -q outputs one JSON object per line
      const lines = stdout.trim().split('\n').filter(Boolean);
      githubRepos = lines.map((line: string) => {
        try {
          const repo = JSON.parse(line);
          return {
            name: repo.full_name,
            description: repo.description,
            stars: repo.stargazers_count,
            updated: repo.updated_at,
            url: repo.html_url,
            source: 'github',
          };
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch (ghError: any) {
      console.error('GitHub repos fetch error:', ghError.message);
    }

    return NextResponse.json({
      repos: [...localRepos, ...githubRepos],
      source: 'combined',
      localCount: localRepos.length,
      githubCount: githubRepos.length,
    });
  } catch (error: any) {
    console.error('List repos error:', error);
    return NextResponse.json(
      { error: 'Failed to list repositories', details: error.message },
      { status: 500 }
    );
  }
}

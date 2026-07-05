import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const searchQuery = url.searchParams.get('q')?.trim();

    if (searchQuery) {
      const { stdout } = await execAsync(
        `gh search repos "${searchQuery}" --limit 30 --json name,owner,description,stargazersCount,updatedAt`,
        { timeout: 30000 }
      );

      const results = JSON.parse(stdout);
      const repos = results.map((item: any) => ({
        name: item.owner?.login ? `${item.owner.login}/${item.name}` : item.name,
        description: item.description || '',
        stars: item.stargazersCount || 0,
        updated: item.updatedAt || '',
        source: 'github',
      }));

      return NextResponse.json({ repos, source: 'github' });
    }

    // No query — return locally cloned repos from /tmp/kilo-repos
    const { existsSync, mkdirSync, readdirSync, statSync } = require('fs');
    const { join } = require('path');
    const REPOS_DIR = '/tmp/kilo-repos';

    if (!existsSync(REPOS_DIR)) {
      mkdirSync(REPOS_DIR, { recursive: true });
    }

    const entries = readdirSync(REPOS_DIR)
      .filter((name: string) => !name.startsWith('.'))
      .map((name: string) => {
        const fullPath = join(REPOS_DIR, name);
        try {
          const stat = statSync(fullPath);
          return {
            name: name.replace(/^([^_]+)_(.+)$/, '$1/$2'),
            path: fullPath,
            modified: stat.mtime.toISOString(),
            source: 'local',
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return NextResponse.json({ repos: entries, source: 'local' });
  } catch (error: any) {
    console.error('Repo search error:', error);
    return NextResponse.json(
      { error: 'Failed to search repositories', details: error.message },
      { status: 500 }
    );
  }
}

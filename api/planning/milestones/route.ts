import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'kilocode';
const REPO_NAME = process.env.GITHUB_REPO_NAME || 'kilocode-android';

function getRepoFlag(): string {
  if (REPO_OWNER && REPO_NAME) {
    return `--repo ${REPO_OWNER}/${REPO_NAME}`;
  }
  return '';
}

function getEnv(): NodeJS.ProcessEnv {
  return { ...process.env, HOME: process.env.HOME || '/home/ubuntu' };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get('state') || 'all';
    const repoFlag = getRepoFlag();
    const { stdout } = await execAsync(
      `gh api "repos/${REPO_OWNER}/${REPO_NAME}/milestones?state=${state}&per_page=100" --jq '.[] | {number, title, description, state, open_issues, closed_issues, url, created_at, updated_at, due_on}'`,
      { timeout: 30000, env: getEnv() }
    );
    const lines = stdout.trim().split('\n').filter(Boolean);
    const milestones = lines.map((line: string) => JSON.parse(line));
    return NextResponse.json({
      milestones,
      totalCount: milestones.length,
    });
  } catch (error: any) {
    console.error('Planning GET error:', error);
    const errMsg = error.message || '';
    if (errMsg.includes('not authenticated') || errMsg.includes('gh auth')) {
      return NextResponse.json(
        { error: 'GitHub not authenticated' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch planning data', details: errMsg },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, ...data } = body;

    if (type === 'milestone') {
      const { title, description, dueOn } = data;
      if (!title) {
        return NextResponse.json(
          { error: 'title is required for milestone creation' },
          { status: 400 }
        );
      }
      const repoFlag = getRepoFlag();
      let cmd = `gh api "repos/${REPO_OWNER}/${REPO_NAME}/milestones" --method POST -f title="${escapeShell(title)}"`;
      if (description) cmd += ` -f description="${escapeShell(description)}"`;
      if (dueOn) cmd += ` -f due_on="${escapeShell(dueOn)}"`;
      const { stdout } = await execAsync(cmd, { timeout: 30000, env: getEnv() });
      const milestone = JSON.parse(stdout);
      return NextResponse.json(milestone);
    }

    return NextResponse.json(
      { error: 'type must be "milestone"' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Planning POST error:', error);
    const errMsg = error.message || '';
    if (errMsg.includes('not authenticated') || errMsg.includes('gh auth')) {
      return NextResponse.json(
        { error: 'GitHub not authenticated' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create planning item', details: errMsg },
      { status: 500 }
    );
  }
}

function escapeShell(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
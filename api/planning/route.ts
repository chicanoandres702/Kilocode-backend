import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const REPO_OWNER = process.env.GITHUB_REPO_OWNER || '';
const REPO_NAME = process.env.GITHUB_REPO_NAME || '';

function getRepoFlag(): string {
  if (REPO_OWNER && REPO_NAME) {
    return `--repo ${REPO_OWNER}/${REPO_NAME}`;
  }
  return '';
}

function getEnv(): NodeJS.ProcessEnv {
  return { ...process.env, HOME: process.env.HOME || '/home/ubuntu' };
}

// ── GET: List milestones or issues for a milestone ───────────────────────────

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const milestoneNumber = url.searchParams.get('milestone');
    const state = url.searchParams.get('state') || 'all';

    if (milestoneNumber) {
      // List issues for a specific milestone
      const repoFlag = getRepoFlag();
      const { stdout } = await execAsync(
        `gh issue list --milestone "${milestoneNumber}" --state "${state}" --json number,title,body,state,labels,milestone,htmlUrl,assignee,comments,createdAt,updatedAt ${repoFlag}`,
        { timeout: 30000, env: getEnv() }
      );
      const issues = JSON.parse(stdout || '[]');
      return NextResponse.json({
        issues,
        totalCount: issues.length,
      });
    } else {
      // List all milestones
      const repoFlag = getRepoFlag();
      const { stdout } = await execAsync(
        `gh api "repos/{owner}/{repo}/milestones?state=${state}&per_page=100" --jq '.[] | {number, title, description, state, open_issues, closed_issues, html_url, created_at, updated_at, due_on}'`,
        { timeout: 30000, env: getEnv() }
      );
      const lines = stdout.trim().split('\n').filter(Boolean);
      const milestones = lines.map((line: string) => JSON.parse(line));
      return NextResponse.json({
        milestones,
        totalCount: milestones.length,
      });
    }
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

// ── POST: Create milestone or issue ─────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, ...data } = body;

    if (type === 'milestone') {
      // Create a milestone
      const { title, description, dueOn } = data;
      if (!title) {
        return NextResponse.json(
          { error: 'title is required for milestone creation' },
          { status: 400 }
        );
      }
      const repoFlag = getRepoFlag();
      let cmd = `gh api "repos/{owner}/{repo}/milestones" --method POST -f title="${escapeShell(title)}"`;
      if (description) cmd += ` -f description="${escapeShell(description)}"`;
      if (dueOn) cmd += ` -f due_on="${escapeShell(dueOn)}"`;
      const { stdout } = await execAsync(cmd, { timeout: 30000, env: getEnv() });
      const milestone = JSON.parse(stdout);
      return NextResponse.json(milestone);
    } else if (type === 'issue') {
      // Create an issue
      const { title, body: issueBody, milestone: milestoneNum, labels: issueLabels } = data;
      if (!title) {
        return NextResponse.json(
          { error: 'title is required for issue creation' },
          { status: 400 }
        );
      }
      const repoFlag = getRepoFlag();
      let cmd = `gh issue create --title "${escapeShell(title)}" ${repoFlag}`;
      if (issueBody) cmd += ` --body "${escapeShell(issueBody)}"`;
      if (milestoneNum) cmd += ` --milestone "${milestoneNum}"`;
      if (issueLabels && issueLabels.length > 0) {
        for (const label of issueLabels) {
          cmd += ` --label "${escapeShell(label)}"`;
        }
      }
      const { stdout } = await execAsync(cmd, { timeout: 30000, env: getEnv() });
      // gh issue create returns the URL of the created issue
      const issueUrl = stdout.trim();
      // Fetch the created issue details
      const issueNumber = issueUrl.split('/').pop();
      const { stdout: issueJson } = await execAsync(
        `gh issue view ${issueNumber} --json number,title,body,state,labels,milestone,htmlUrl,assignee,comments,createdAt,updatedAt ${repoFlag}`,
        { timeout: 30000, env: getEnv() }
      );
      const issue = JSON.parse(issueJson);
      return NextResponse.json(issue);
    }

    return NextResponse.json(
      { error: 'type must be "milestone" or "issue"' },
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

// ── PATCH: Update issue state ────────────────────────────────────────────────

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { issueNumber, state } = body;

    if (!issueNumber || !state) {
      return NextResponse.json(
        { error: 'issueNumber and state are required' },
        { status: 400 }
      );
    }

    if (state !== 'open' && state !== 'closed') {
      return NextResponse.json(
        { error: 'state must be "open" or "closed"' },
        { status: 400 }
      );
    }

    const repoFlag = getRepoFlag();
    if (state === 'closed') {
      await execAsync(
        `gh issue close ${issueNumber} ${repoFlag}`,
        { timeout: 30000, env: getEnv() }
      );
    } else {
      await execAsync(
        `gh issue reopen ${issueNumber} ${repoFlag}`,
        { timeout: 30000, env: getEnv() }
      );
    }

    // Fetch updated issue
    const { stdout: issueJson } = await execAsync(
      `gh issue view ${issueNumber} --json number,title,body,state,labels,milestone,htmlUrl,assignee,comments,createdAt,updatedAt ${repoFlag}`,
      { timeout: 30000, env: getEnv() }
    );
    const issue = JSON.parse(issueJson);
    return NextResponse.json(issue);
  } catch (error: any) {
    console.error('Planning PATCH error:', error);
    const errMsg = error.message || '';
    if (errMsg.includes('not authenticated') || errMsg.includes('gh auth')) {
      return NextResponse.json(
        { error: 'GitHub not authenticated' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update issue', details: errMsg },
      { status: 500 }
    );
  }
}

function escapeShell(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

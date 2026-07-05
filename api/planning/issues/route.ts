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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const milestoneNumber = url.searchParams.get('milestone');
    const state = url.searchParams.get('state') || 'all';

    if (!milestoneNumber) {
      return NextResponse.json(
        { error: 'milestone query parameter is required' },
        { status: 400 }
      );
    }

    const repoFlag = getRepoFlag();
    const { stdout } = await execAsync(
      `gh issue list --milestone "${milestoneNumber}" --state "${state}" --json number,title,body,state,labels,milestone,url,assignees,comments,createdAt,updatedAt ${repoFlag}`,
      { timeout: 30000, env: getEnv() }
    );
    const issues = JSON.parse(stdout || '[]');
    // Transform issues to match expected format (assignees -> assignee as string)
    const transformedIssues = issues.map((issue: any) => ({
      ...issue,
      assignee: issue.assignees?.[0]?.login || null,
      assignees: undefined
    }));
    return NextResponse.json({
      issues: transformedIssues,
      totalCount: transformedIssues.length,
    });
  } catch (error: any) {
    console.error('Planning issues GET error:', error);
    const errMsg = error.message || '';
    if (errMsg.includes('not authenticated') || errMsg.includes('gh auth')) {
      return NextResponse.json(
        { error: 'GitHub not authenticated' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch issues', details: errMsg },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, ...data } = body;

    if (type === 'issue') {
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
      const issueUrl = stdout.trim();
      const issueNumber = issueUrl.split('/').pop();
      const { stdout: issueJson } = await execAsync(
        `gh issue view ${issueNumber} --json number,title,body,state,labels,milestone,url,assignees,comments,createdAt,updatedAt ${repoFlag}`,
        { timeout: 30000, env: getEnv() }
      );
      const issue = JSON.parse(issueJson);
      return NextResponse.json(issue);
    }

    return NextResponse.json(
      { error: 'type must be "issue"' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Planning issues POST error:', error);
    const errMsg = error.message || '';
    if (errMsg.includes('not authenticated') || errMsg.includes('gh auth')) {
      return NextResponse.json(
        { error: 'GitHub not authenticated' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create issue', details: errMsg },
      { status: 500 }
    );
  }
}

function escapeShell(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

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

    const { stdout: issueJson } = await execAsync(
      `gh issue view ${issueNumber} --json number,title,body,state,labels,milestone,url,assignees,comments,createdAt,updatedAt ${repoFlag}`,
      { timeout: 30000, env: getEnv() }
    );
    const issue = JSON.parse(issueJson);
    return NextResponse.json(issue);
  } catch (error: any) {
    console.error('Planning issues PATCH error:', error);
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
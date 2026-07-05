import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Authenticate GitHub CLI
    await execAsync(`echo "${token}" | gh auth login --with-token`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('GitHub Auth Error:', error);
    return NextResponse.json({ error: 'Failed to authenticate with GitHub' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

export async function GET() {
  const agents = [
    { id: 'kilo-auto', name: 'Kilo Auto Agent', description: 'Autonomous agent for task automation', builtIn: true, mode: 'autonomous' },
    { id: 'kilo-dev', name: 'Kilo Dev Agent', description: 'Development assistant', builtIn: true, mode: 'interactive' }
  ];
  return NextResponse.json(agents);
}

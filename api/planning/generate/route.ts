import { NextResponse } from 'next/server';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
}

interface Feature {
  title: string;
  description: string;
  tasks: Task[];
}

interface GenerateRequest {
  description: string;
}

interface GenerateResponse {
  features: Feature[];
}

function createTask(title: string): Task {
  return {
    id: Math.random().toString(36).substr(2, 9),
    title,
    description: '',
    status: 'pending'
  };
}

// Simple AI-powered feature generation based on project description
function generateFeaturesFromDescription(description: string): Feature[] {
  console.log('Description:', description);
  const keywords = description.toLowerCase();
  console.log('Keywords:', keywords);
  const features: Feature[] = [];

  // Common feature patterns
  if (keywords.includes('task') || keywords.includes('todo') || keywords.includes('manage')) {
    features.push({
      title: 'Task Management System',
      description: 'Core task creation, editing, and organization functionality',
      tasks: [
        createTask('Design task data model'),
        createTask('Implement CRUD operations for tasks'),
        createTask('Add task categorization and filtering'),
        createTask('Create task status tracking')
      ]
    });
  }

  if (keywords.includes('auth') || keywords.includes('login') || keywords.includes('user')) {
    features.push({
      title: 'Authentication & User Management',
      description: 'User authentication, profile management, and security features',
      tasks: [
        createTask('Implement user registration flow'),
        createTask('Add login/logout functionality'),
        createTask('Create password reset mechanism'),
        createTask('Add session management')
      ]
    });
  }

  if (keywords.includes('chat') || keywords.includes('message') || keywords.includes('conversation')) {
    features.push({
      title: 'Messaging System',
      description: 'Real-time messaging and conversation handling',
      tasks: [
        createTask('Design message data model'),
        createTask('Implement real-time message delivery'),
        createTask('Add message history persistence'),
        createTask('Create typing indicators')
      ]
    });
  }

  if (keywords.includes('ai') || keywords.includes('intelligent') || keywords.includes('smart')) {
    features.push({
      title: 'AI-Powered Features',
      description: 'Artificial intelligence integration for enhanced functionality',
      tasks: [
        createTask('Integrate AI model API'),
        createTask('Implement prompt engineering'),
        createTask('Add response streaming'),
        createTask('Create AI configuration options')
      ]
    });
  }

  // Default features if none matched
  if (features.length === 0) {
    features.push(
      {
        title: 'Core Application Setup',
        description: 'Foundation structure and configuration',
        tasks: [
          createTask('Set up project structure'),
          createTask('Configure build system'),
          createTask('Add basic navigation'),
          createTask('Implement error handling')
        ]
      },
      {
        title: 'User Interface',
        description: 'Main user interface components and screens',
        tasks: [
          createTask('Design main layout'),
          createTask('Create navigation flow'),
          createTask('Implement responsive design'),
          createTask('Add loading states')
        ]
      },
      {
        title: 'Data Management',
        description: 'Data persistence and state management',
        tasks: [
          createTask('Design data models'),
          createTask('Implement local storage'),
          createTask('Add data synchronization'),
          createTask('Create backup strategy')
        ]
      }
    );
  }

  return features;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received generate request body:', body);
    const { description } = body as GenerateRequest;

    if (!description) {
      return NextResponse.json(
        { error: 'description is required' },
        { status: 400 }
      );
    }

    const features = generateFeaturesFromDescription(description);
    console.log('Features JSON:', JSON.stringify(features));
    
    return NextResponse.json({ features });
  } catch (error: any) {
    console.error('Generate features error:', error);
    return NextResponse.json(
      { error: 'Failed to generate features', details: error.message },
      { status: 500 }
    );
  }
}
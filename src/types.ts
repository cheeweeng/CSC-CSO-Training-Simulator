export type Role = 'cso' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  role: Role;
  displayName: string;
  createdAt: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  category: string;
  content: string;
  policyContext: string;
}

export interface Scores {
  policyTranslation: number;
  empathy: number;
  wogPerspective: number;
  integrity: number;
  problemOwnership: number;
  overall: number;
}

export interface Evaluation {
  feedback: string;
  strengths: string[];
  improvements: string[];
  competencyAnalysis: {
    [key: string]: {
      score: number;
      comment: string;
    };
  };
}

export interface Session {
  id: string;
  userId: string;
  scenarioId: string;
  response: string;
  evaluation?: Evaluation;
  scores?: Scores;
  status: 'pending' | 'completed';
  createdAt: string;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiContract {
  method: HttpMethod;
  path: string;
}

export interface AuthenticatedUserSummary {
  _id: string;
  name: string;
  email: string;
  provider: string;
  plan?: string;
}

export interface ChatRequestContract {
  message: string;
  language?: string;
  knowledgeSource?: string;
}

export interface ChatResponseContract {
  success: boolean;
  reply: string;
  cached?: boolean;
}

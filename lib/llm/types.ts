export interface LlmProvider {
  complete(prompt: string, options: {
    model: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<LlmResponse>;
  
  generateSection(request: LlmSectionRequest): Promise<{ content: string; tokens: number }>;
  isAvailable(): boolean;
}

export interface LlmResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LlmSectionRequest {
  projectContext: {
    title: string;
    description: string;
    [key: string]: string;
  };
  sectionName: string;
  sectionInstructions?: string;
  sectionQuestions: string[];
  previousSections: Array<{
    name: string;
    content: string;
  }>;
  artifactType: string;
  modelId: string;
  maxTokens?: number;
}

export interface LlmModel {
  id: string;
  provider:
    | "openai"
    | "openrouter"
    | "deepseek"
    | "anthropic"
    | "mistral"
    | "zai"
    | "minimax"
    | "other";
  contextTokens: number;
  maxOutputTokens: number;
  defaultMax: number;
  enabled?: boolean;
}

export interface SectionPlan {
  name: string;
  maxTokens: number;
  tokensUsed?: number;
  model?: string;
}

export interface UserConfig {
  userId: string;
  provider: string;
  apiKey?: string;
  defaultModel: string;
  useSystem: boolean;
  systemKeyId?: string;
  zaiEndpointType?: "paid" | "coding";
  zaiIsChina?: boolean;
}

export interface ProviderCredentials {
  provider: string;
  apiKey: string;
  modelId: string;
  zaiEndpointType?: "paid" | "coding";
  zaiIsChina?: boolean;
}

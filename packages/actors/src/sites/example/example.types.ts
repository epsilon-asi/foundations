export interface ScrapeDashboardInput {
  limit?: number;
}

export interface DashboardRow {
  text: string;
}

export interface SubmitContactFormInput extends Record<string, string| undefined> {
  name: string;
  email: string;
  company?: string;
  message: string;
}

export interface SubmitContactFormOutput {
  submittedEmail: string;
}

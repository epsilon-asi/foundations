export interface PingInput {
  message?: string;
}

export interface PingOutput {
  ok: true;
  echo: string | null;
}

export interface PostCommentInput extends Record<string, string | undefined> {
  comment: string;
  subject?: string;
}

export interface PostCommentOutput {
  submittedComment: string;
  submittedSubject: string | null;
}

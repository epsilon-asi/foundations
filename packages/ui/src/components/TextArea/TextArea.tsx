import { FieldControl, type TextFieldProps } from '../TextField/TextField';
export interface TextAreaProps extends Omit<TextFieldProps, 'type'> {
  minRows?: number;
  maxRows?: number;
  resize?: 'none' | 'vertical';
}
export function TextArea({ minRows = 2, maxRows = 8, ...props }: TextAreaProps) {
  return <FieldControl {...props} multiline minRows={minRows} maxRows={Math.max(minRows, maxRows)} />;
}

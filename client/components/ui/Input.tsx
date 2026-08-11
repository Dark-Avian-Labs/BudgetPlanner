import type { InputHTMLAttributes } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  readOnlyStyle?: boolean;
  className?: string;
}

export function Input({ readOnlyStyle, className, ...props }: InputProps) {
  const classes = ['form-input'];
  if (readOnlyStyle) {
    classes.push('form-input-readonly');
  }
  if (className) {
    classes.push(className);
  }
  return <input {...props} className={classes.join(' ')} />;
}

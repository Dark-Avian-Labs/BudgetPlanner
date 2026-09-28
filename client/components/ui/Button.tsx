import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'accent' | 'secondary' | 'danger' | 'cancel';

function variantClass(variant: ButtonVariant): string {
  switch (variant) {
    case 'accent':
      return 'btn-accent';
    case 'danger':
      return 'btn-danger';
    case 'cancel':
      return 'btn-cancel';
    default:
      return 'btn-secondary';
  }
}

interface BaseProps {
  variant?: ButtonVariant;
  className?: string;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, BaseProps {
  href?: never;
}

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement>, BaseProps {
  href: string;
}

function composeClassName(variant: ButtonVariant, className?: string): string {
  const classes = ['btn', variantClass(variant)];
  if (className) {
    classes.push(className);
  }
  return classes.join(' ');
}

export function Button(props: ButtonProps | LinkButtonProps) {
  if ('href' in props && props.href) {
    const { href, variant = 'secondary', className, children, ...anchorProps } = props;
    return (
      <a href={href} {...anchorProps} className={composeClassName(variant, className)}>
        {children}
      </a>
    );
  }

  const { variant = 'secondary', className, children, type, ...buttonProps } = props as ButtonProps;
  return (
    <button
      type={type ?? 'button'}
      {...buttonProps}
      className={composeClassName(variant, className)}
    >
      {children}
    </button>
  );
}

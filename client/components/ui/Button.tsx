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
  const { children, variant = 'secondary', className } = props;
  const classes = composeClassName(variant, className);

  if ('href' in props && props.href) {
    const { href, ...anchorProps } = props;
    return (
      <a href={href} className={classes} {...anchorProps}>
        {children}
      </a>
    );
  }

  const buttonProps = props as ButtonProps;
  return (
    <button type="button" {...buttonProps} className={classes}>
      {children}
    </button>
  );
}

import type { HTMLAttributes } from 'react';

export function MaterialSymbol({
  name,
  className,
  filled = false,
  style,
  ...rest
}: {
  name: string;
  filled?: boolean;
} & Omit<HTMLAttributes<HTMLSpanElement>, 'children'>) {
  const classes = ['material-symbol-rounded', className].filter(Boolean).join(' ');

  return (
    <span
      className={classes}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
        ...style,
      }}
      aria-hidden
      {...rest}
    >
      {name}
    </span>
  );
}

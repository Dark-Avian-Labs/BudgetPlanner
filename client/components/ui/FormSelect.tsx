import { useId, useState } from 'react';

import { SelectDropdown, type SelectDropdownOption } from './SelectDropdown';

const FORM_TRIGGER_CLASS =
  'user-menu-select-trigger flex w-full cursor-pointer items-center justify-between gap-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50';

interface FormSelectProps {
  label: string;
  value: string;
  options: SelectDropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Prefer floating inside modals so the menu isn’t clipped. */
  placement?: 'attached' | 'floating';
}

/** Label + SelectDropdown using the same trigger chrome as the theme picker. */
export function FormSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled,
  className,
  placement = 'floating',
}: FormSelectProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className={`form-group ${className ?? ''}`}>
      <span id={`${id}-label`}>{label}</span>
      <SelectDropdown
        id={id}
        value={value}
        options={options}
        onChange={onChange}
        open={open}
        onOpenChange={setOpen}
        placeholder={placeholder}
        buttonAriaLabel={label}
        disabled={disabled}
        triggerClassName={FORM_TRIGGER_CLASS}
        placement={placement}
      />
    </div>
  );
}

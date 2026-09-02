import { useId } from 'react';

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
  placement?: 'attached' | 'floating';
}

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

  return (
    <div className={`form-group ${className ?? ''}`}>
      <span id={`${id}-label`}>{label}</span>
      <SelectDropdown
        id={id}
        value={value}
        options={options}
        onChange={onChange}
        placeholder={placeholder}
        buttonAriaLabel={label}
        disabled={disabled}
        triggerClassName={FORM_TRIGGER_CLASS}
        placement={placement}
      />
    </div>
  );
}

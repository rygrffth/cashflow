'use client';

import React from 'react';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string | number;
  onChangeValue: (rawValue: string) => void;
  prefix?: string;
}

export default function CurrencyInput({
  value,
  onChangeValue,
  prefix = 'Rp',
  className = '',
  placeholder = '0',
  ...rest
}: CurrencyInputProps) {
  // Convert raw value to formatted display string with thousand dots
  const formatDisplay = (val: string | number): string => {
    if (val === '' || val === null || val === undefined) return '';
    const cleanNum = String(val).replace(/\D/g, '');
    if (!cleanNum) return '';
    return Number(cleanNum).toLocaleString('id-ID');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    // Extract only digits
    const rawDigits = inputVal.replace(/\D/g, '');
    onChangeValue(rawDigits);
  };

  return (
    <div className="relative flex items-center w-full">
      {prefix && (
        <span className="absolute left-3 text-xs font-semibold text-slate-400 pointer-events-none select-none">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="numeric"
        value={formatDisplay(value)}
        onChange={handleChange}
        placeholder={placeholder}
        className={`${prefix ? 'pl-9' : 'pl-3'} ${className}`}
        {...rest}
      />
    </div>
  );
}

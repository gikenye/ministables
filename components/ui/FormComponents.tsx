import React from "react";

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  description?: string;
  error?: string;
  required?: boolean;
}

export const FormField = ({
  label,
  children,
  description,
  error,
  required = false,
}: FormFieldProps) => {
  return (
    <div className="space-y-2">
      <label className="text-white font-medium text-sm">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {description && (
        <div className="text-xs text-gray-500">{description}</div>
      )}
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  );
};

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: "text" | "number" | "email";
  className?: string;
}

export const TextInput = ({
  value,
  onChange,
  placeholder,
  maxLength,
  type = "text",
  className = "",
}: TextInputProps) => {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={`w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 ${className}`}
    />
  );
};

interface SelectInputProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}

export const SelectInput = ({
  value,
  onChange,
  options,
  className = "",
}: SelectInputProps) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-400 ${className}`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  currency?: string;
  className?: string;
}

export const AmountInput = ({
  value,
  onChange,
  placeholder = "0",
  currency = "KES",
  className = "",
}: AmountInputProps) => {
  const formatAmount = (inputValue: string) => {
    // Remove non-numeric characters except decimal point
    const numericValue = inputValue.replace(/[^0-9.]/g, "");
    // Format with commas
    const parts = numericValue.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  const handleChange = (inputValue: string) => {
    const formatted = formatAmount(inputValue);
    onChange(formatted);
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
        {currency}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full p-3 pl-12 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-right text-lg font-semibold ${className}`}
      />
    </div>
  );
};

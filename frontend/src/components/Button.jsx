import React from 'react';

export default function Button({ children, onClick, variant = 'primary', disabled }) {
  const base = 'px-3 py-1 rounded transition-colors';
  const styles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    gray: 'bg-gray-200 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    warn: 'bg-amber-500 text-white hover:bg-amber-600',
  };
  return (
    <button className={`${base} ${styles[variant]}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}



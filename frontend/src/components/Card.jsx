import React from 'react';

export default function Card({ title, children, footer }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-100">
      {title && <div className="text-lg font-medium mb-2">{title}</div>}
      <div>{children}</div>
      {footer && <div className="mt-3 pt-3 border-t border-gray-100">{footer}</div>}
    </div>
  );
}



import React from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  actions?: React.ReactNode;
}

export default function Modal({ isOpen, title, children, onClose, actions }: ModalProps) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        </div>
        <div className="px-6 py-4">{children}</div>
        {actions && (
          <div className="border-t border-slate-200 px-6 py-4 flex gap-3 justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

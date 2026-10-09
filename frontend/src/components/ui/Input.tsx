import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label className="jb-label" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p className="mt-1 text-xs text-danger" role="alert">
      {messages.join(" ")}
    </p>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, leftIcon, rightIcon, ...props }, ref) {
    if (leftIcon || rightIcon) {
      return (
        <div className="relative flex items-center w-full">
          {leftIcon ? (
            <div className="pointer-events-none absolute left-3.5 flex items-center text-slate-400">
              {leftIcon}
            </div>
          ) : null}
          <input
            ref={ref}
            className={cn(
              "jb-input",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              className,
            )}
            {...props}
          />
          {rightIcon ? (
            <div className="absolute right-3.5 flex items-center">
              {rightIcon}
            </div>
          ) : null}
        </div>
      );
    }
    return <input ref={ref} className={cn("jb-input", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn("jb-input", className)} {...props}>
        {children}
      </select>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn("jb-input", className)} rows={4} {...props} />;
  },
);

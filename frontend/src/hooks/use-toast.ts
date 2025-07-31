
import { toast as sonnerToast } from "sonner";

type ToastProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
};

export const toast = ({ title, description, action, variant = "default", duration = 5000 }: ToastProps) => {
  sonnerToast(title, {
    description,
    action,
    duration,
  });
};

type Toast = {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
};

export const useToast = () => {
  const toasts: Toast[] = [];

  return {
    toasts,
    toast,
    dismiss: (toastId?: string) => {},
  };
};

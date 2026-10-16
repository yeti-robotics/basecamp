'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

export function ErrorToast({
  id,
  message,
  description,
}: {
  id: string;
  message: string;
  description?: string;
}) {
  useEffect(() => {
    toast.error(message, { id, description });
    return () => {
      toast.dismiss(id);
    };
  }, [id, message, description]);
  return null;
}

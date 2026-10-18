import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AccountForm,
  AccountType,
  CreateAccountFields,
  emptyAccountForm,
} from "./CreateAccountFields";

const typeLabels: Record<AccountType, string> = {
  agent: "Agent",
  driver: "Driver",
  admin: "Admin",
};

interface CreateAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAccountDialog({ open, onOpenChange }: CreateAccountDialogProps) {
  const token = useAuth((state) => state.token);
  const [accountType, setAccountType] = useState<AccountType>("agent");
  const [form, setForm] = useState<AccountForm>(emptyAccountForm);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setForm(emptyAccountForm());
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const submitAccount = (): Promise<Response> => {
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    if (accountType === "driver") {
      return fetch("/api/drivers", {
        method: "POST",
        headers,
        body: JSON.stringify({
          full_name: form.full_name,
          contact_info: form.contact_info,
          license: form.license,
          hire_date: form.hire_date,
          employment_type: form.employment_type || undefined,
          is_active: form.is_active,
          username: form.username || undefined,
          password: form.password || undefined,
        }),
      });
    }

    if (accountType === "agent") {
      return fetch("/api/agents", {
        method: "POST",
        headers,
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          full_name: form.full_name,
          email: form.email,
          contact_info: form.contact_info,
          emergency_contact: form.emergency_contact,
          hire_date: form.hire_date,
          is_active: form.is_active,
        }),
      });
    }

    return fetch("/api/users", {
      method: "POST",
      headers,
      body: JSON.stringify({ username: form.username, password: form.password, role: "admin" }),
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await submitAccount();
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Could not create account");
        return;
      }
      handleOpenChange(false);
    } catch {
      setError("Could not reach the server");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Account</DialogTitle>
          <DialogDescription>Only admins can create accounts.</DialogDescription>
        </DialogHeader>

        <Tabs
          value={accountType}
          onValueChange={(value) => {
            setAccountType(value as AccountType);
            setError(null);
          }}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="agent">Agent</TabsTrigger>
            <TabsTrigger value="driver">Driver</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
          </TabsList>
        </Tabs>

        <form onSubmit={handleSubmit} className="space-y-4">
          <CreateAccountFields accountType={accountType} form={form} onChange={setForm} />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : `Create ${typeLabels[accountType]}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

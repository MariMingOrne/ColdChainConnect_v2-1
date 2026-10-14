import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { CreateAccountRequest, CreateAccountResponse } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AccountCreation() {
  const token = useAuth((state) => state.token);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CreateAccountRequest["role"]>("agent");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateAccountResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setCreated(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username, password, role } satisfies CreateAccountRequest),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Could not create account");
        return;
      }

      setCreated(body as CreateAccountResponse);
      setUsername("");
      setPassword("");
      setRole("agent");
    } catch {
      setError("Could not reach the server");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="mb-1 text-xl font-semibold">Create Account</h1>
      <p className="mb-6 text-sm text-gray-500">
        Only admins can create accounts and assign roles.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-6">
        <div className="space-y-2">
          <Label htmlFor="account-username">Username</Label>
          <Input
            id="account-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-password">Password</Label>
          <Input
            id="account-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={4}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-role">Role</Label>
          <Select value={role} onValueChange={(value) => setRole(value as CreateAccountRequest["role"])}>
            <SelectTrigger id="account-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {created && (
          <p className="text-sm text-green-700">
            Created {created.username} as {created.role}.
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Account"}
        </Button>
      </form>
    </main>
  );
}

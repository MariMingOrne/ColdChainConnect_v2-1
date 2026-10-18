import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AccountType = "agent" | "driver" | "admin";

export interface AccountForm {
  username: string;
  password: string;
  full_name: string;
  email: string;
  contact_info: string;
  emergency_contact: string;
  license: string;
  hire_date: string;
  employment_type: "full_time" | "part_time" | "";
  is_active: boolean;
}

export const emptyAccountForm = (): AccountForm => ({
  username: "",
  password: "",
  full_name: "",
  email: "",
  contact_info: "",
  emergency_contact: "",
  license: "",
  hire_date: "",
  employment_type: "",
  is_active: true,
});

interface CreateAccountFieldsProps {
  accountType: AccountType;
  form: AccountForm;
  onChange: (form: AccountForm) => void;
}

export function CreateAccountFields({ accountType, form, onChange }: CreateAccountFieldsProps) {
  const update = (patch: Partial<AccountForm>) => onChange({ ...form, ...patch });

  const credentials = (
    <>
      <TextField
        id="account-username"
        label="Username"
        value={form.username}
        onChange={(value) => update({ username: value })}
        placeholder="e.g., maria.santos"
        required
      />
      <TextField
        id="account-password"
        label="Password"
        type="password"
        value={form.password}
        onChange={(value) => update({ password: value })}
        minLength={4}
        required
      />
    </>
  );

  if (accountType === "admin") {
    return <div className="space-y-4">{credentials}</div>;
  }

  if (accountType === "agent") {
    return (
      <div className="space-y-4">
        {credentials}
        <TextField id="agent-full-name" label="Full Name" value={form.full_name} onChange={(value) => update({ full_name: value })} placeholder="e.g., Maria Santos" required />
        <TextField id="agent-email" label="Email" type="email" value={form.email} onChange={(value) => update({ email: value })} placeholder="e.g., maria.santos@coldchain.com" />
        <TextField id="agent-contact" label="Contact" value={form.contact_info} onChange={(value) => update({ contact_info: value })} placeholder="e.g., 09171234567" />
        <TextField id="agent-emergency-contact" label="Emergency Contact" value={form.emergency_contact} onChange={(value) => update({ emergency_contact: value })} />
        <TextField id="agent-hire-date" label="Hire Date" type="date" value={form.hire_date} onChange={(value) => update({ hire_date: value })} />
        <ActiveToggle id="agent-is-active" checked={form.is_active} onChange={(checked) => update({ is_active: checked })} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TextField id="driver-full-name" label="Full Name" value={form.full_name} onChange={(value) => update({ full_name: value })} placeholder="e.g., Pedro Reyes" required />
      <TextField id="driver-username" label="Login Username (optional)" value={form.username} onChange={(value) => update({ username: value })} placeholder="e.g., pedro.reyes" />
      <TextField id="driver-password" label="Login Password (optional)" type="password" value={form.password} onChange={(value) => update({ password: value })} minLength={4} />
      <TextField id="driver-contact" label="Contact" value={form.contact_info} onChange={(value) => update({ contact_info: value })} placeholder="e.g., 09181234567" />
      <TextField id="driver-license" label="License Number" value={form.license} onChange={(value) => update({ license: value })} placeholder="e.g., N01-23-111111" />
      <TextField id="driver-hire-date" label="Hire Date" type="date" value={form.hire_date} onChange={(value) => update({ hire_date: value })} />
      <div className="space-y-2">
        <Label htmlFor="driver-employment-type">Employment Type</Label>
        <Select
          value={form.employment_type}
          onValueChange={(value) => update({ employment_type: value as AccountForm["employment_type"] })}
        >
          <SelectTrigger id="driver-employment-type">
            <SelectValue placeholder="Select employment type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full_time">Full Time</SelectItem>
            <SelectItem value="part_time">Part Time</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ActiveToggle id="driver-is-active" checked={form.is_active} onChange={(checked) => update({ is_active: checked })} />
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  minLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
      />
    </div>
  );
}

function ActiveToggle({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
      <Label htmlFor={id}>Active</Label>
    </div>
  );
}

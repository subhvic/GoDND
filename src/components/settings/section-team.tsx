"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { MoreHorizontal, RotateCw, UserMinus, UserPlus, Users, XCircle } from "lucide-react";

import { FooterNav, SectionFrame } from "@/components/settings/section-frame";
import { useSettings } from "@/components/settings/settings-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldError, TextInput } from "@/components/ui/field";
import { Badge } from "@/components/ui/status";
import type { TeamMemberRecord } from "@/lib/settings/model";
import { ASSIGNABLE_ROLES, INVITE_VALID_DAYS, ROLES, roleLabel, type Role } from "@/lib/settings/options";
import { can, teamActionBlock } from "@/lib/settings/rules";
import { inviteSchema } from "@/lib/settings/schema";
import { formatDate } from "@/lib/utils";

const ROLE_ORDER: Role[] = ["owner", "admin", "finance", "sales", "ops"];

/** Settings › My Team (step 7 of 7, "add member" in the handoff file). */
export function SectionTeam() {
  const { state, run, busy, now } = useSettings();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<TeamMemberRecord | null>(null);
  const manage = can(state.viewer.role, "manage_team");

  const members = [...state.team].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
  });
  const active = members.filter((member) => member.status === "active").length;
  const pending = members.length - active;
  const onlyYou = members.length === 1;

  return (
    <SectionFrame
      slug="team"
      action={
        manage && !onlyYou ? (
          <Button variant="primary" onClick={() => setInviting(true)}>
            <UserPlus aria-hidden />
            Invite member
          </Button>
        ) : !manage ? (
          <span className="badge neutral">View only</span>
        ) : null
      }
      footer={<FooterNav slug="team" />}
    >
      {onlyYou ? (
        <div className="panel">
          <EmptyState
            icon={Users}
            title="It’s just you so far"
            description="Invite the people who answer enquiries, run trips or handle payouts. Each gets their own sign-in, so nobody shares a password."
            action={
              manage ? (
                <Button variant="primary" onClick={() => setInviting(true)}>
                  <UserPlus aria-hidden />
                  Invite member
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <section className="panel" aria-labelledby="team-list-title">
          <div className="panel-head">
            <div className="panel-head-left">
              <h3 id="team-list-title" className="m-0 text-[13px] font-semibold">
                {active} {active === 1 ? "member" : "members"}
              </h3>
              {pending > 0 ? <span className="hint">{pending} invite{pending === 1 ? "" : "s"} pending</span> : null}
            </div>
          </div>
          <ul className="team-list">
            {members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                now={now}
                isYou={member.id === state.viewer.memberId}
                busy={busy}
                onRemove={() => setRemoving(member)}
              />
            ))}
          </ul>
        </section>
      )}

      {!manage ? (
        <p className="settings-note mt-[12px]">Only owners and admins can invite people or change roles.</p>
      ) : null}

      <details className="role-guide">
        <summary>What each role can do</summary>
        <dl>
          {ROLES.map((role) => (
            <div key={role.value}>
              <dt>{role.label}</dt>
              <dd>{role.description}</dd>
            </div>
          ))}
        </dl>
      </details>

      {inviting ? <InviteDialog onClose={() => setInviting(false)} /> : null}

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        size="sm"
        title={`Remove ${removing?.name ?? removing?.email ?? ""}?`}
        description="They lose access to this workspace straight away."
        footer={
          <>
            <Button onClick={() => setRemoving(null)}>Cancel</Button>
            <Button
              variant="primary"
              className="danger-fill"
              disabled={busy}
              onClick={async () => {
                if (!removing) return;
                const result = await run({ type: "remove_member", memberId: removing.id });
                if (result.ok) setRemoving(null);
              }}
            >
              Remove from workspace
            </Button>
          </>
        }
      >
        <ul className="m-0 flex flex-col gap-[6px] pl-[18px] text-[12.5px] leading-[1.5] text-text-secondary">
          <li>Enquiries assigned to them become unassigned, so nothing waits on someone who can’t reply.</li>
          <li>Bookings, experiences and messages they worked on stay as they are.</li>
          <li>You can invite them again at any time.</li>
        </ul>
      </Dialog>
    </SectionFrame>
  );
}

function MemberRow({
  member,
  now,
  isYou,
  busy,
  onRemove,
}: {
  member: TeamMemberRecord;
  now: number;
  isYou: boolean;
  busy: boolean;
  onRemove: () => void;
}) {
  const { state, run } = useSettings();
  const roleBlocked = teamActionBlock(state, member, "change_role");
  const removeBlocked = teamActionBlock(state, member, "remove");
  const manage = can(state.viewer.role, "manage_team");
  const invited = member.status === "invited";
  const expiresIn = member.inviteExpiresAt
    ? Math.ceil((Date.parse(member.inviteExpiresAt) - now) / 86_400_000)
    : null;
  const expired = invited && expiresIn !== null && expiresIn <= 0;
  const display = member.name ?? member.email;

  return (
    <li className="team-row">
      <span className="team-avatar" aria-hidden data-invited={invited || undefined}>
        {display.charAt(0).toUpperCase()}
      </span>
      <div className="team-who">
        <p className="team-name">
          {member.name ?? <span className="text-text-secondary">{member.email}</span>}
          {isYou ? <Badge status="info">You</Badge> : null}
        </p>
        {member.name ? <p className="team-email">{member.email}</p> : null}
      </div>

      <div className="team-status">
        {invited ? (
          expired ? (
            <Badge status="critical">Invite expired</Badge>
          ) : (
            <span className="text-[11.5px] text-text-muted">
              <Badge status="warning">Invited</Badge>{" "}
              {expiresIn === 1 ? "expires tomorrow" : `expires in ${expiresIn} days`}
            </span>
          )
        ) : (
          <span className="text-[11.5px] text-text-muted">
            {member.joinedAt ? `Joined ${formatDate(member.joinedAt)}` : "Active"}
          </span>
        )}
      </div>

      <div className="team-role">
        {manage && !roleBlocked ? (
          <>
            <label htmlFor={`role-${member.id}`} className="sr-only">
              Role for {display}
            </label>
            <select
              id={`role-${member.id}`}
              className="inline-select"
              value={member.role}
              disabled={busy}
              onChange={(event) => void run({ type: "change_role", memberId: member.id, role: event.target.value as Role })}
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </>
        ) : (
          <span className="text-[12px] font-medium text-text-primary" title={manage ? roleBlocked ?? undefined : undefined}>
            {roleLabel(member.role)}
          </span>
        )}
      </div>

      <div className="team-actions">
        {manage && (invited || !removeBlocked) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="hbtn icon small" aria-label={`Actions for ${display}`}>
                <MoreHorizontal aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[210px]">
              {invited ? (
                <>
                  <DropdownMenuItem onSelect={() => void run({ type: "resend_invite", memberId: member.id })}>
                    {expired ? "Send a new invite" : "Resend invite"}
                    <RotateCw aria-hidden className="size-[14px] text-text-muted" />
                  </DropdownMenuItem>
                  <DropdownMenuItem danger onSelect={() => void run({ type: "revoke_invite", memberId: member.id })}>
                    Withdraw invite
                    <XCircle aria-hidden className="size-[14px]" />
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem danger onSelect={onRemove}>
                  Remove from workspace
                  <UserMinus aria-hidden className="size-[14px]" />
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </li>
  );
}

type InviteForm = { email: string; name: string; role: Role };

function InviteDialog({ onClose }: { onClose: () => void }) {
  const { run, busy } = useSettings();
  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema) as unknown as Resolver<InviteForm>,
    defaultValues: { email: "", name: "", role: "sales" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { register, control } = form;
  const errors = form.formState.errors;
  const role = useWatch({ control, name: "role" });

  const submit = form.handleSubmit(async (values) => {
    const result = await run({ type: "invite_member", ...values });
    if (!result.ok) {
      for (const [path, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(path as keyof InviteForm, { type: "server", message });
      }
      if (!result.fieldErrors) form.setError("email", { type: "server", message: result.error });
      return;
    }
    onClose();
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Invite a team member"
      description={`They get an email to sign in. The invite is valid for ${INVITE_VALID_DAYS} days.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            <UserPlus aria-hidden />
            Send invite
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
        className="flex flex-col gap-[16px]"
      >
        <div className="settings-grid">
          <Field label="Email address" required error={errors.email?.message}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                type="email"
                autoComplete="off"
                placeholder="name@yourcompany.in"
                autoFocus
                {...register("email")}
              />
            )}
          </Field>
          <Field label="Name" error={errors.name?.message}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                autoComplete="off"
                placeholder="Optional"
                {...register("name")}
              />
            )}
          </Field>
        </div>

        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="field-label mb-[8px] p-0">
            Role<span aria-hidden className="req">*</span>
          </legend>
          <div className="role-options">
            {ASSIGNABLE_ROLES.map((option) => (
              <label key={option.value} className="role-option" data-checked={role === option.value || undefined}>
                <input type="radio" value={option.value} {...register("role")} />
                <span>
                  <span className="role-option-name">{option.label}</span>
                  <span className="role-option-desc">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
          <FieldError id="invite-role-error" message={errors.role?.message} />
        </fieldset>
      </form>
    </Dialog>
  );
}

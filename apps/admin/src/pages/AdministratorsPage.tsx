import { useEffect, useState } from 'react';
import {
  Ban,
  Edit3,
  KeyRound,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react';
import type { AdminUserDTO, RoleDTO, RoleSlug } from '@mobileum/shared';
import { adminApi } from '@/api/adminApi';
import { ApiStatusBanner, type StatusFeedback } from '@/components/ApiStatusBanner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/context/AuthContext';
import { PREVIEW_ROLES, PREVIEW_USERS } from '@/data/adminPreviewData';

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdministratorsPage() {
  const { mode, user: currentUser, hasPermission } = useAuth();
  const canReadUsers = hasPermission('users:read');
  const canManageUsers = hasPermission('users:manage');

  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [roles, setRoles] = useState<RoleDTO[]>([]);
  const [feedback, setFeedback] = useState<StatusFeedback | null>(null);

  // Add user modal
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newRoleSlug, setNewRoleSlug] = useState<RoleSlug>('content_manager');
  const [newCanPublish, setNewCanPublish] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Edit role modal
  const [editTarget, setEditTarget] = useState<AdminUserDTO | null>(null);
  const [editRoleSlug, setEditRoleSlug] = useState<RoleSlug>('admin');
  const [editCanPublish, setEditCanPublish] = useState(false);

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<AdminUserDTO | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  // Confirm status / revoke
  const [statusTarget, setStatusTarget] = useState<AdminUserDTO | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AdminUserDTO | null>(null);

  useEffect(() => {
    if (!canReadUsers) return;
    let active = true;
    const load = async () => {
      const res = await adminApi.getUsers();
      if (!active) return;
      if (res.ok && res.data) {
        setUsers(res.data.items);
        setRoles(res.data.roles);
      } else if (mode === 'ui_preview') {
        setUsers(PREVIEW_USERS);
        setRoles(PREVIEW_ROLES);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [canReadUsers, mode]);

  if (!canReadUsers) {
    return (
      <AdminLayout
        title="Administrators"
        subtitle="Role-based administrator management"
      >
        <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            Super Admin Access Required
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Only Super Administrators are permitted to view, create, or manage
            administrator accounts and security roles.
          </p>
        </div>
      </AdminLayout>
    );
  }

  const activeSuperAdminCount = users.filter(
    (u) => u.roleSlug === 'super_admin' && u.status === 'active',
  ).length;

  const handleCreateUser = async () => {
    if (!newName.trim() || !newEmail.trim() || !newUsername.trim()) {
      setFormError('Name, email, and username are required.');
      return;
    }
    if (newPassword.length < 12) {
      setFormError('Initial password must be at least 12 characters.');
      return;
    }

    const res = await adminApi.createUser({
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      username: newUsername.trim().toLowerCase(),
      roleSlug: newRoleSlug,
      status: 'active',
      canPublishOverride: newRoleSlug === 'content_manager' ? newCanPublish : null,
      initialPassword: newPassword,
    });

    setAddOpen(false);
    setNewPassword('');
    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Unable to create administrator.',
      });
      return;
    }
    if (res.data?.user) {
      setUsers((prev) => [...prev, res.data!.user]);
    }
  };

  const handleSaveRole = async () => {
    if (!editTarget) return;
    if (
      editTarget.roleSlug === 'super_admin' &&
      editRoleSlug !== 'super_admin' &&
      activeSuperAdminCount <= 1
    ) {
      setFeedback({
        type: 'error',
        message: 'Cannot demote the last active Super Administrator.',
      });
      setEditTarget(null);
      return;
    }

    const res = await adminApi.updateUserRole(editTarget.id, {
      roleSlug: editRoleSlug,
      canPublishOverride: editRoleSlug === 'content_manager' ? editCanPublish : null,
    });
    setEditTarget(null);
    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Unable to update administrator role.',
      });
      return;
    }
    if (res.data?.user) {
      setUsers((prev) => prev.map((u) => (u.id === editTarget.id ? res.data!.user : u)));
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!statusTarget) return;
    const nextStatus = statusTarget.status === 'active' ? 'inactive' : 'active';

    if (
      statusTarget.roleSlug === 'super_admin' &&
      nextStatus === 'inactive' &&
      activeSuperAdminCount <= 1
    ) {
      setStatusTarget(null);
      setFeedback({
        type: 'error',
        message: 'Cannot deactivate the last active Super Administrator.',
      });
      return;
    }

    const res = await adminApi.updateUserStatus(statusTarget.id, nextStatus);
    setStatusTarget(null);
    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Unable to update account status.',
      });
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === statusTarget.id ? { ...u, status: nextStatus } : u)),
    );
  };

  const handleRevokeSessions = async () => {
    if (!revokeTarget) return;
    const res = await adminApi.revokeUserSessions(revokeTarget.id);
    setRevokeTarget(null);
    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Unable to revoke active sessions.',
      });
      return;
    }
    setFeedback({
      type: 'info',
      message: `Revoked active sessions for ${revokeTarget.name}.`,
    });
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (resetPasswordVal.length < 12) {
      setResetError('New password must be at least 12 characters.');
      return;
    }
    const res = await adminApi.resetUserPassword(resetTarget.id, resetPasswordVal);
    setResetTarget(null);
    setResetPasswordVal('');
    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Unable to reset administrator password.',
      });
      return;
    }
    setFeedback({
      type: 'info',
      message: `Password reset initiated for ${resetTarget.name} and active sessions invalidated.`,
    });
  };

  return (
    <AdminLayout
      title="Administrators"
      subtitle="Manage administrator accounts, roles, permissions, and session access"
      actions={
        canManageUsers ? (
          <Button
            size="sm"
            onClick={() => {
              setNewName('');
              setNewEmail('');
              setNewUsername('');
              setNewRoleSlug('content_manager');
              setNewCanPublish(false);
              setNewPassword('');
              setFormError(null);
              setAddOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Administrator
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <ApiStatusBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

        {/* Role Definitions */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {roles.map((role) => (
            <div
              key={role.id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#1D4ED8]" />
                <h3 className="text-sm font-semibold text-slate-900">{role.name}</h3>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                {role.description}
              </p>
            </div>
          ))}
        </div>

        {/* Administrators Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Administrator</th>
                  <th className="px-4 py-3.5">Username</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Last Login</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((adm) => {
                  const isSelf = adm.id === currentUser?.id;
                  return (
                    <tr key={adm.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">{adm.name}</p>
                        <p className="text-xs text-slate-500">{adm.email}</p>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-700">
                        @{adm.username}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="default">{adm.roleName}</Badge>
                          {adm.roleSlug === 'content_manager' && adm.canPublishOverride && (
                            <Badge variant="neutral">Can Publish</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={adm.status === 'active' ? 'success' : 'danger'}>
                          {adm.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        {formatDateTime(adm.lastLoginAt)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {canManageUsers && (
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit role & permissions"
                              disabled={isSelf}
                              onClick={() => {
                                setEditTarget(adm);
                                setEditRoleSlug(adm.roleSlug);
                                setEditCanPublish(Boolean(adm.canPublishOverride));
                              }}
                            >
                              <Edit3 className="h-4 w-4 text-[#1D4ED8]" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Reset password"
                              onClick={() => {
                                setResetTarget(adm);
                                setResetPasswordVal('');
                                setResetError(null);
                              }}
                            >
                              <KeyRound className="h-4 w-4 text-slate-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Revoke active sessions"
                              onClick={() => setRevokeTarget(adm)}
                            >
                              <Ban className="h-4 w-4 text-amber-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isSelf}
                              title={
                                adm.status === 'active'
                                  ? 'Deactivate account'
                                  : 'Activate account'
                              }
                              onClick={() => setStatusTarget(adm)}
                            >
                              {adm.status === 'active' ? (
                                <UserX className="h-4 w-4 text-rose-600" />
                              ) : (
                                <UserCheck className="h-4 w-4 text-emerald-600" />
                              )}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Administrator Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogTitle>Add Administrator</DialogTitle>
          <DialogDescription>
            Create a new administrator account with role-based permissions.
          </DialogDescription>
          <div className="mt-4 space-y-4">
            {formError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {formError}
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Full Name *</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Email *</label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@mobileum.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Username *</label>
                <Input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="jdoe"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Role *</label>
              <select
                value={newRoleSlug}
                onChange={(e) => setNewRoleSlug(e.target.value as RoleSlug)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
              >
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="content_manager">Editor (Content Manager)</option>
                <option value="viewer">Viewer (Read-Only)</option>
              </select>
            </div>
            {newRoleSlug === 'content_manager' && (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                <span className="text-xs font-medium text-slate-700">
                  Allow Editor to Publish Products
                </span>
                <Switch checked={newCanPublish} onCheckedChange={setNewCanPublish} />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Initial Password (min 12 chars) *
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter a strong initial password"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateUser()}>Create Account</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog open={Boolean(editTarget)} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogTitle>Assign Role — {editTarget?.name}</DialogTitle>
          <DialogDescription>
            Role permissions are enforced on the backend for every API request.
          </DialogDescription>
          <div className="mt-4 space-y-4">
            <select
              value={editRoleSlug}
              onChange={(e) => setEditRoleSlug(e.target.value as RoleSlug)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
            >
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="content_manager">Editor (Content Manager)</option>
              <option value="viewer">Viewer (Read-Only)</option>
            </select>
            {editRoleSlug === 'content_manager' && (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                <span className="text-xs font-medium text-slate-700">
                  Allow Editor to Publish Products
                </span>
                <Switch checked={editCanPublish} onCheckedChange={setEditCanPublish} />
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveRole()}>Save Role</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={Boolean(resetTarget)} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent>
          <DialogTitle>Reset Password — {resetTarget?.name}</DialogTitle>
          <DialogDescription>
            Sets a new Argon2id password hash on the backend and revokes existing
            sessions for this administrator.
          </DialogDescription>
          <div className="mt-4 space-y-3">
            {resetError && (
              <p className="text-xs text-rose-600">{resetError}</p>
            )}
            <Input
              type="password"
              autoComplete="new-password"
              value={resetPasswordVal}
              onChange={(e) => setResetPasswordVal(e.target.value)}
              placeholder="New password (minimum 12 characters)"
            />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleResetPassword()}>
              Reset Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onOpenChange={(o) => !o && setStatusTarget(null)}
        title={
          statusTarget?.status === 'active'
            ? 'Deactivate Administrator?'
            : 'Activate Administrator?'
        }
        description={
          statusTarget?.status === 'active'
            ? `Deactivating "${statusTarget?.name}" immediately blocks login and invalidates active sessions.`
            : `Restore administrative access for "${statusTarget?.name}".`
        }
        confirmLabel={statusTarget?.status === 'active' ? 'Deactivate' : 'Activate'}
        destructive={statusTarget?.status === 'active'}
        onConfirm={() => void handleConfirmStatusChange()}
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title="Revoke All Active Sessions?"
        description={`Immediately sign out "${revokeTarget?.name}" from all browsers and devices.`}
        confirmLabel="Revoke Access"
        destructive
        onConfirm={() => void handleRevokeSessions()}
      />
    </AdminLayout>
  );
}

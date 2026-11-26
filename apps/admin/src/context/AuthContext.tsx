import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AdminUserDTO, PermissionKey, RoleSlug } from '@mobileum/shared';
import { adminApi } from '@/api/adminApi';
import { buildPreviewActor } from '@/data/adminPreviewData';

export type SessionMode = 'loading' | 'authenticated' | 'ui_preview' | 'unauthenticated';

interface AuthContextValue {
  mode: SessionMode;
  user: AdminUserDTO | null;
  previewRole: RoleSlug;
  editorCanPublish: boolean;
  hasPermission: (permission: PermissionKey) => boolean;
  refreshSession: () => Promise<void>;
  enterUiPreview: (role?: RoleSlug) => void;
  setPreviewRole: (role: RoleSlug) => void;
  setEditorCanPublish: (enabled: boolean) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SessionMode>('loading');
  const [user, setUser] = useState<AdminUserDTO | null>(null);
  const [previewRole, setPreviewRoleState] = useState<RoleSlug>('super_admin');
  const [editorCanPublish, setEditorCanPublishState] = useState(false);

  const refreshSession = useCallback(async () => {
    const res = await adminApi.getMe();
    if (res.ok && res.data?.user) {
      setUser(res.data.user);
      setMode('authenticated');
    } else {
      setUser(null);
      setMode((prev) => (prev === 'ui_preview' ? 'ui_preview' : 'unauthenticated'));
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const enterUiPreview = useCallback(
    (role: RoleSlug = 'super_admin') => {
      setPreviewRoleState(role);
      setUser(buildPreviewActor(role, editorCanPublish));
      setMode('ui_preview');
    },
    [editorCanPublish],
  );

  const setPreviewRole = useCallback(
    (role: RoleSlug) => {
      setPreviewRoleState(role);
      if (mode === 'ui_preview') {
        setUser(buildPreviewActor(role, editorCanPublish));
      }
    },
    [mode, editorCanPublish],
  );

  const setEditorCanPublish = useCallback(
    (enabled: boolean) => {
      setEditorCanPublishState(enabled);
      if (mode === 'ui_preview') {
        setUser(buildPreviewActor(previewRole, enabled));
      }
    },
    [mode, previewRole],
  );

  const logout = useCallback(async () => {
    if (mode === 'authenticated') {
      await adminApi.logout();
    }
    setUser(null);
    setMode('unauthenticated');
  }, [mode]);

  const hasPermission = useCallback(
    (permission: PermissionKey) => {
      if (!user) return false;
      return user.permissions.includes(permission);
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        mode,
        user,
        previewRole,
        editorCanPublish,
        hasPermission,
        refreshSession,
        enterUiPreview,
        setPreviewRole,
        setEditorCanPublish,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

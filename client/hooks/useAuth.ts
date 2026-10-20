import { create } from "zustand";
import {
  LoginRequest,
  LoginResponse,
  MfaChallengeResponse,
  MfaSetupResponse,
  MfaVerifyRequest,
} from "@shared/api";

export interface AuthUser {
  id: string;
  username: string;
  role: "admin" | "agent" | "driver";
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isPostLoginLoading: boolean;
  postLoginStartedAt: number | null;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<MfaChallengeResponse | null>;
  setupMfa: (challengeToken: string) => Promise<MfaSetupResponse>;
  verifyMfa: (request: MfaVerifyRequest) => Promise<void>;
  logout: () => Promise<void>;
  setToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  finishPostLoginLoading: () => void;
}

const AUTH_TOKEN_KEY = "auth_token";
const AUTH_USER_KEY = "auth_user";

const getStoredAuth = () => {
  if (typeof window === "undefined") {
    return { user: null, token: null };
  }

  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const user = localStorage.getItem(AUTH_USER_KEY);

  return {
    token,
    user: user ? (JSON.parse(user) as AuthUser) : null,
  };
};

const persistAuth = (token: string | null, user: AuthUser | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }

  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_USER_KEY);
  }
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const errorBody = (await response.json()) as { error?: string };
    return errorBody.error || fallback;
  } catch {
    return response.status === 401 ? "Invalid username or password" : fallback;
  }
}

function completeSignIn(
  set: (partial: Partial<AuthStore>) => void,
  get: () => AuthStore,
  data: LoginResponse
) {
  const normalizedUser: AuthUser = {
    id: data.user.id,
    username: data.user.username,
    role: data.user.role,
  };

  persistAuth(data.token, normalizedUser);
  const startedAt = Date.now();
  set({
    token: data.token,
    user: normalizedUser,
    isAuthenticated: true,
    isLoading: false,
    isPostLoginLoading: true,
    postLoginStartedAt: startedAt,
  });

  window.setTimeout(() => {
    if (get().postLoginStartedAt === startedAt) {
      set({ isPostLoginLoading: false, postLoginStartedAt: null });
    }
  }, 5000);
}

export const useAuth = create<AuthStore>((set, get) => {
  const { user: storedUser, token: storedToken } = getStoredAuth();

  return {
    user: storedUser,
    token: storedToken,
    isAuthenticated: Boolean(storedToken),
    isLoading: false,
    isPostLoginLoading: false,
    postLoginStartedAt: null,
    error: null,

    login: async (credentials) => {
      set({ isLoading: true, error: null });

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });

        if (!response.ok) {
          throw new Error(await readErrorMessage(response, "Login failed"));
        }

        const data = (await response.json()) as LoginResponse | MfaChallengeResponse;
        set({ isLoading: false });

        if ("challenge_token" in data) {
          return data;
        }

        completeSignIn(set, get, data);
        return null;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Login failed";
        set({ error: message, isLoading: false });
        throw error;
      }
    },

    setupMfa: async (challengeToken) => {
      const response = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_token: challengeToken }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Could not start MFA setup"));
      }
      return (await response.json()) as MfaSetupResponse;
    },

    verifyMfa: async (request) => {
      set({ isLoading: true, error: null });

      try {
        const response = await fetch("/api/auth/mfa/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, "Verification failed"));
        }

        completeSignIn(set, get, (await response.json()) as LoginResponse);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Verification failed";
        set({ error: message, isLoading: false });
        throw error;
      }
    },

    logout: async () => {
      const token = get().token;

      try {
        if (token) {
          await fetch("/api/auth/logout", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        }
      } catch {
        // Clear local state even if the server logout request fails.
      } finally {
        persistAuth(null, null);
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          isPostLoginLoading: false,
          postLoginStartedAt: null,
          error: null,
        });
      }
    },

    setToken: (token) => {
      const user = get().user;
      persistAuth(token, user);
      set({
        token,
        isAuthenticated: Boolean(token),
      });
    },

    setUser: (user) => {
      const token = get().token;
      persistAuth(token, user);
      set({ user });
    },

    finishPostLoginLoading: () => {
      const startedAt = get().postLoginStartedAt;
      if (!get().isPostLoginLoading || startedAt === null) return;

      const delay = Math.max(0, 600 - (Date.now() - startedAt));
      window.setTimeout(() => {
        if (get().postLoginStartedAt === startedAt) {
          set({ isPostLoginLoading: false, postLoginStartedAt: null });
        }
      }, delay);
    },

  };
});

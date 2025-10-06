import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, LoginRequest, User, AuthTokens } from '@/types/auth';
import { authService } from '@/services/auth.service';

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      const data = await authService.login(credentials);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const loadStoredAuth = createAsyncThunk('auth/loadStored', async () => {
  const user = authService.getStoredUser();
  const tokens = authService.getStoredTokens();

  if (user && tokens) {
    return { user, tokens };
  }
  throw new Error('No stored auth data');
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  await authService.logout();
});

export const refreshUserData = createAsyncThunk('auth/refresh', async () => {
  const user = await authService.getCurrentUser();
  return user;
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    setTokens: (state, action: PayloadAction<AuthTokens>) => {
      state.tokens = action.payload;
    },
    clearAuth: state => {
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    // Login
    builder.addCase(loginUser.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(loginUser.fulfilled, (state, action) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.tokens = action.payload.tokens;
      state.isAuthenticated = true;
      state.error = null;
    });
    builder.addCase(loginUser.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
      state.isAuthenticated = false;
    });

    // Load stored auth
    builder.addCase(loadStoredAuth.fulfilled, (state, action) => {
      state.user = action.payload.user;
      state.tokens = action.payload.tokens;
      state.isAuthenticated = true;
    });
    builder.addCase(loadStoredAuth.rejected, state => {
      state.isAuthenticated = false;
    });

    // Logout
    builder.addCase(logoutUser.fulfilled, state => {
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.error = null;
    });

    // Refresh user data
    builder.addCase(refreshUserData.fulfilled, (state, action) => {
      state.user = action.payload;
    });
  },
});

export const { setUser, setTokens, clearAuth, clearError } = authSlice.actions;
export default authSlice.reducer;

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { LoginUserInfo } from '@/services/api/auth-service';

interface AuthState {
  user: LoginUserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: LoginUserInfo }>) => {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearError: state => {
      state.error = null;
    },
    logout: state => {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
    },
    authChecked: state => {
      state.isLoading = false;
    },
  },
});

export const { setCredentials, setLoading, setError, clearError, logout, authChecked } =
  authSlice.actions;
export default authSlice.reducer;

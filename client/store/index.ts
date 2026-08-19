import { configureStore, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { Role } from "@/hooks/useRBAC";

interface SessionState {
  role: Role;
  userName: string;
}
const initialSession: SessionState = { role: "admin", userName: "" };

const sessionSlice = createSlice({
  name: "session",
  initialState: initialSession,
  reducers: {
    setRole(state, action: PayloadAction<Role>) {
      state.role = action.payload;
    },
  },
});

export const { setRole } = sessionSlice.actions;

export const store = configureStore({
  reducer: {
    session: sessionSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

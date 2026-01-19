import { api } from "../lib/api";

export const registerUser = async (data: {
  name: string;
  email: string;
  password: string;
}) => {
     // 🔍 LOG 1: env variable check
  console.log(
    "API BASE URL:",
    process.env.NEXT_PUBLIC_API_BASE_URL
  );

  // 🔍 LOG 2: full request intent
  console.log("Calling POST /auth/register with data:", data);
  const res = await api.post("/auth/register", data);
  return res.data;
};

export const loginUser = async (data: {
  email: string;
  password: string;
}) => {
  const res = await api.post("/auth/login", data);
  return res.data;
};

export const logoutUser = async () => {
  const res = await api.post("/auth/logout");
  return res.data;
};

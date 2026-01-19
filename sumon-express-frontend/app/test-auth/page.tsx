"use client";

import { useAuth } from "@/context/AuthContext";

export default function TestAuthPage() {
  const { user, loading, logout, checkAuth } = useAuth();

  if (loading) return <p style={{ padding: 20 }}>Checking auth...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Auth Test Page</h2>
      <pre>{JSON.stringify(user, null, 2)}</pre>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={checkAuth}>Re-check Auth</button>
        <button onClick={logout}>Logout</button>
      </div>
    </div>
  );
}

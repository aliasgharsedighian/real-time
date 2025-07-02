// src/LoginPage.jsx
import { useState } from "react";
import { useLogin } from "../../hooks/useAuth";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore.getState();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { mutateAsync: login, isPending, error } = useLogin();

  const handleLogin = async (e: any) => {
    e.preventDefault();
    try {
      await login(
        { email, password },
        {
          onSuccess: (response) => {
            const res = response.data;
            setToken(res.data.accessToken);
            getUserInfo(res.data.accessToken);
          },
        }
      );
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const getUserInfo = async (token: string) => {
    try {
      const response = await api.get("auth/user-info", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const user = response.data.data;
      // Save user in Zustand
      setUser(user);
      navigate("/polling");
    } catch (error) {
      console.error("Failed to fetch user info:", error);
      throw error;
    }
  };

  return (
    <div className="flex items-center justify-center">
      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded w-full max-w-sm"
      >
        <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
        <div className="mb-4">
          <label className="block text-gray-700">Email</label>
          <Input
            type="email"
            className="w-full p-2 border border-gray-300 rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700">Password</label>
          <Input
            type="password"
            className="w-full p-2 border border-gray-300 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div>Error occured when trying to connect!</div>}
        <Button
          disabled={isPending}
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          Login
        </Button>
      </form>
    </div>
  );
}

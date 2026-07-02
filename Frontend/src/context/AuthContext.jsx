import { createContext, useContext, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext();

function storedUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(storedUser);

  // Admin / Teacher login
  const login = async (email, password) => {
    const data = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  // Student login
  const studentLogin = async (admissionNumber, firstName, passcode) => {
    const data = await api("/auth/login", {
      method: "POST",
      body: { admissionNumber, firstName, passcode },
    });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const isAdmin = user?.role === "ADMIN";
  const isTeacher = user?.role === "TEACHER";
  const isStudent = user?.role === "STUDENT";
  const isStaff = isAdmin || isTeacher;

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        studentLogin,
        logout,
        isAdmin,
        isTeacher,
        isStudent,
        isStaff,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

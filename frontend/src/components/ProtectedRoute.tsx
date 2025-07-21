import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import Header from "./Header";

const ProtectedLayout = () => {
  const { isLoggedIn } = useAuthStore();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="w-full">
      {/* Optional: Navbar or layout here */}
      <Header />
      <Outlet />
    </div>
  );
};

export default ProtectedLayout;

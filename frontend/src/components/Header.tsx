import { useLocation } from "react-router-dom";
import BarDrawerHeader from "./BarDrawerHeader";

function Header() {
  const location = useLocation();
  const path = location.pathname;

  const hiddenNav = path.startsWith("/polling");

  return (
    <div
      className={`w-full h-[66px] items-center px-3 py-3 bg-[#2b7fff] [&>a]:hover:text-blue-600 [&>a]:hover:font-bold ${
        hiddenNav ? "hidden" : "flex"
      }`}
    >
      <BarDrawerHeader />
    </div>
  );
}

export default Header;

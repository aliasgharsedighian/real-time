import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/home/Home";
import LoginPage from "./pages/login";
import PollingChatId from "./pages/polling/chatId";
import { Polling } from "./pages/polling";

function App() {
  return (
    <div className="w-full m-auto flex flex-col gap-6 items-center justify-center">
      <nav className="[&>a]:hover:text-blue-600 [&>a]:hover:font-bold">
        <Link to="/">Home</Link> | <Link to="/polling">Polling</Link> |
        <Link to="/login">Login</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/polling" element={<Polling />} />
        <Route path="/polling/:chatId" element={<PollingChatId />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </div>
  );
}

export default App;

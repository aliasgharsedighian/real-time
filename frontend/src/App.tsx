import { Routes, Route } from "react-router-dom";
import LoginPage from "./pages/login";
import { PollingChatId } from "./pages/polling/chatId";
import { Polling } from "./pages/polling";
import ProfilePage from "./pages/profile";
import ProtectedLayout from "./components/ProtectedRoute";

function App() {
  return (
    <div className="w-full m-auto flex flex-col gap-6 items-center justify-center">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* All protected routes go here */}
        <Route
          path="/"
          element={
            <ProtectedLayout /> // ProtectedRoute logic is here
          }
        >
          <Route path="/polling" element={<Polling />} />
          <Route path="/polling/:chatId" element={<PollingChatId />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        {/* Fallback */}
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </div>
  );
}

export default App;

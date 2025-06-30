import { Routes, Route, Link } from "react-router-dom";
import Polling from "./pages/polling";
import Home from "./pages/home/Home";

function App() {
  return (
    <div className="w-full m-auto flex flex-col gap-6 items-center justify-center">
      <nav className="[&>a]:hover:text-blue-600 [&>a]:hover:font-bold">
        <Link to="/">Home</Link> | <Link to="/polling">Polling</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/polling" element={<Polling />} />
      </Routes>
    </div>
  );
}

export default App;

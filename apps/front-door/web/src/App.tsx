import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Chat } from "./pages/Chat";
import { Me } from "./pages/Me";
import { Projects } from "./pages/Projects";
import { Welcome } from "./pages/Welcome";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Shell>
              <Welcome />
            </Shell>
          }
        />
        <Route
          path="/chat/:sessionId"
          element={
            <Shell>
              <Chat />
            </Shell>
          }
        />
        <Route
          path="/projects"
          element={
            <Shell wide>
              <Projects />
            </Shell>
          }
        />
        <Route
          path="/me"
          element={
            <Shell wide>
              <Me />
            </Shell>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

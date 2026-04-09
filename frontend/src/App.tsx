import { Routes, Route } from "react-router";
import { RootLayout } from "@/components/layout/root-layout";
import HomePage from "@/pages/home";
import NotFoundPage from "@/pages/not-found";

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<HomePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

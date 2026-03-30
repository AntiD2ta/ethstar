import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <TooltipProvider>
          <div className="bg-diamond-tile" aria-hidden="true" />
          <App />
        </TooltipProvider>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);

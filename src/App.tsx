import { Navigate, Route, Routes } from "react-router-dom";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { GridOverlay } from "@/components/layout/grid-overlay";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import ContractsPage from "@/routes/contracts";
import DocumentsPage from "@/routes/documents";
import TicketDetailPage from "@/routes/ticket-detail";
import TicketsPage from "@/routes/tickets";
import TermsPage from "@/routes/terms";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col font-mono bg-background">
      <ThemeProvider>
        <TooltipProvider>
          <GridOverlay />
          <Header />
          <div className="flex flex-1 overflow-hidden relative z-10">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-6">
              <Routes>
                <Route path="/" element={<Navigate to="/tickets" replace />} />
                <Route path="/tickets" element={<TicketsPage />} />
                <Route path="/tickets/:id" element={<TicketDetailPage />} />
                <Route path="/contracts" element={<ContractsPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/terms/*" element={<TermsPage />} />
              </Routes>
            </main>
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
}

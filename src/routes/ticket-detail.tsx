import { Navigate, useParams } from "react-router-dom";
import LegacyTicketDetailPage from "@/app/tickets/[id]/page";

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <Navigate to="/" replace />;
  }

  return <LegacyTicketDetailPage params={{ id }} />;
}

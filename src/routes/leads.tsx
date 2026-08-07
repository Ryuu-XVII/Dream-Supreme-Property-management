import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/leads")({
  component: () => <Navigate to="/pipeline" search={{ tab: "leads" }} replace />,
});

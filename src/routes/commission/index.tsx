import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/commission/")({
  beforeLoad: () => {
    throw redirect({
      to: "/commission/earnings",
    });
  },
});

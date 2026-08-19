import { createFileRoute } from "@tanstack/react-router";
import { WorldApp } from "@/world/WorldApp";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <WorldApp />;
}

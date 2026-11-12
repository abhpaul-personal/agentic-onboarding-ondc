import { DemoClient } from "./demo-client";
import { LiveModeProvider } from "./live-mode-context";

export const metadata = {
  title: "Run the demo",
};

export default function DemoPage() {
  return (
    <LiveModeProvider>
      <DemoClient />
    </LiveModeProvider>
  );
}

import { PlayerRoot } from "@/components/player/PlayerRoot";

/**
 * Reso — single-pane offline music player.
 * The page is a server component shell that hands off to a single client root.
 */
export default function Home() {
  return <PlayerRoot />;
}

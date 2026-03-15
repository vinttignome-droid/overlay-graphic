"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { relaySubscribe } from "@/lib/realtimeRelay";

const ENGINE_RELAY_KEY = "ligr:engine-relay";
const DEFAULT_PLAYER_SILHOUETTE = `data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><rect width='128' height='128' fill='transparent'/><circle cx='64' cy='44' r='22' fill='#9ca3af'/><path d='M22 118c2-24 18-38 42-38s40 14 42 38' fill='#9ca3af'/></svg>"
)}`;

/* ─────────────────────────────────────────────
   Overlay style packages
───────────────────────────────────────────── */
type OverlayStyleKey = "classic-dark" | "modern-blue" | "neon-sport" | "ligr-pro";

interface StyleCfg {
  scorebugBg: string;
  scorebugBorder: string;
  scorebugRadius: string;
  accentColor: string;
  textColor: string;
  dimTextColor: string;
  dividerColor: string;
  goalBg: string;
  goalTextColor: string;
  goalAccentColor: string;
  lowerBg: string;
  lowerLeftBorder: string;
  lowerTextColor: string;
  lowerAccentColor: string;
  penaltyBg: string;
  penaltyTextColor: string;
  lineupBg: string;
  lineupTextColor: string;
  lineupAccentColor: string;
  fullscreenBg: string;
  fullscreenTextColor: string;
  fullscreenAccentColor: string;
}

type OverlayRosterPanel = {
  visible: boolean;
  teamName: string;
  mode: "lineup" | "rotation";
  lineupOnly?: boolean;
  formation: string;
  rows: Array<{ role: string; player: string }>;
  starting: string[];
  bench: string[];
};

type OverlayHalftimeStatRow = {
  key: string;
  label: string;
  home: string;
  away: string;
};

type PenaltyShootoutResult = "scored" | "missed";

type PenaltyShootoutAttempt = {
  player: string;
  result: PenaltyShootoutResult;
};

const FOOTBALL_FORMATIONS: Record<string, string[]> = {
  "4-3-3": ["MV", "OP", "KP", "KP", "VP", "KK", "KK", "KK", "OLH", "KH", "ORH"],
  "4-4-2": ["MV", "OP", "KP", "KP", "VP", "OLK", "KK", "KK", "ORK", "KH", "KH"],
  "4-2-3-1": ["MV", "OP", "KP", "KP", "VP", "PKK", "PKK", "OHK", "HK", "OHK", "KH"],
  "3-5-2": ["MV", "KP", "KP", "KP", "OLW", "KK", "KK", "KK", "ORW", "KH", "KH"],
  "5-3-2": ["MV", "VWB", "KP", "KP", "KP", "OWB", "KK", "KK", "KK", "KH", "KH"],
  "5-4-1": ["MV", "VWB", "KP", "KP", "KP", "OWB", "OLK", "KK", "KK", "ORK", "KH"],
};

const FOOTBALL_FORMATION_COORDS: Record<string, Array<{ top: number; left: number }>> = {
  "4-3-3": [
    { top: 90, left: 50 },
    { top: 74, left: 16 },
    { top: 74, left: 38 },
    { top: 74, left: 62 },
    { top: 74, left: 84 },
    { top: 54, left: 28 },
    { top: 52, left: 50 },
    { top: 54, left: 72 },
    { top: 32, left: 20 },
    { top: 24, left: 50 },
    { top: 32, left: 80 },
  ],
  "4-4-2": [
    { top: 90, left: 50 },
    { top: 74, left: 16 },
    { top: 74, left: 38 },
    { top: 74, left: 62 },
    { top: 74, left: 84 },
    { top: 54, left: 18 },
    { top: 54, left: 40 },
    { top: 54, left: 60 },
    { top: 54, left: 82 },
    { top: 28, left: 40 },
    { top: 28, left: 60 },
  ],
  "3-5-2": [
    { top: 90, left: 50 },
    { top: 74, left: 32 },
    { top: 74, left: 50 },
    { top: 74, left: 68 },
    { top: 52, left: 16 },
    { top: 52, left: 34 },
    { top: 50, left: 50 },
    { top: 52, left: 66 },
    { top: 52, left: 84 },
    { top: 28, left: 40 },
    { top: 28, left: 60 },
  ],
  "4-2-3-1": [
    { top: 90, left: 50 },
    { top: 74, left: 16 },
    { top: 74, left: 38 },
    { top: 74, left: 62 },
    { top: 74, left: 84 },
    { top: 60, left: 40 },
    { top: 60, left: 60 },
    { top: 44, left: 20 },
    { top: 40, left: 50 },
    { top: 44, left: 80 },
    { top: 24, left: 50 },
  ],
  "5-3-2": [
    { top: 90, left: 50 },
    { top: 76, left: 10 },
    { top: 78, left: 30 },
    { top: 78, left: 50 },
    { top: 78, left: 70 },
    { top: 76, left: 90 },
    { top: 54, left: 30 },
    { top: 52, left: 50 },
    { top: 54, left: 70 },
    { top: 28, left: 40 },
    { top: 28, left: 60 },
  ],
  "5-4-1": [
    { top: 90, left: 50 },
    { top: 76, left: 10 },
    { top: 78, left: 30 },
    { top: 78, left: 50 },
    { top: 78, left: 70 },
    { top: 76, left: 90 },
    { top: 54, left: 18 },
    { top: 54, left: 40 },
    { top: 54, left: 60 },
    { top: 54, left: 82 },
    { top: 28, left: 50 },
  ],
};

const getPlayerInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "--";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

const normalizePlayerName = (name: string) => name.replace(/\s+#\d+\s*$/i, "").trim().toLowerCase();

const getPlayerNumber = (name: string) => {
  const m = name.match(/#(\d+)\s*$/);
  return m ? m[1] : "";
};

const getPlayerLastName = (name: string) => {
  const withoutNumber = name.replace(/\s*#\d+\s*$/, "").trim();
  const parts = withoutNumber.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || withoutNumber;
};

const getRotationVisualRows = (panel: OverlayRosterPanel) => {
  const formation = panel.formation || "4-3-3";
  const formationRoles = FOOTBALL_FORMATIONS[formation] || FOOTBALL_FORMATIONS["4-3-3"];
  const coords = FOOTBALL_FORMATION_COORDS[formation] || FOOTBALL_FORMATION_COORDS["4-3-3"];

  return panel.rows
    .map((row, idx) => {
      const prefix = `${formation}-`;
      const parsedIndex = row.role.startsWith(prefix)
        ? Number.parseInt(row.role.slice(prefix.length), 10)
        : Number.NaN;
      const positionIndex = Number.isInteger(parsedIndex) ? parsedIndex : idx;
      const coord = coords[positionIndex];

      if (!coord) return null;

      return {
        key: `${formation}-${positionIndex}-${idx}`,
        role: formationRoles[positionIndex] || row.role,
        player: row.player || "Ei valittu",
        left: coord.left,
        top: coord.top,
      };
    })
    .filter((item): item is { key: string; role: string; player: string; left: number; top: number } => Boolean(item));
};

const STYLE_CFGS: Record<OverlayStyleKey, StyleCfg> = {
  "classic-dark": {
    scorebugBg: "#0d0d1a",
    scorebugBorder: "1px solid #c0a060",
    scorebugRadius: "4px",
    accentColor: "#c0a060",
    textColor: "#ffffff",
    dimTextColor: "rgba(192,160,96,0.75)",
    dividerColor: "rgba(192,160,96,0.35)",
    goalBg: "linear-gradient(135deg,#c0a060 0%,#7a5c1e 100%)",
    goalTextColor: "#0d0d1a",
    goalAccentColor: "#0d0d1a",
    lowerBg: "rgba(13,13,26,0.97)",
    lowerLeftBorder: "5px solid #c0a060",
    lowerTextColor: "#ffffff",
    lowerAccentColor: "#c0a060",
    penaltyBg: "#c0a060",
    penaltyTextColor: "#0d0d1a",
    lineupBg: "rgba(13,13,26,0.97)",
    lineupTextColor: "#ffffff",
    lineupAccentColor: "#c0a060",
    fullscreenBg: "rgba(13,13,26,0.94)",
    fullscreenTextColor: "#c0a060",
    fullscreenAccentColor: "#ffffff",
  },
  "modern-blue": {
    scorebugBg: "#003087",
    scorebugBorder: "none",
    scorebugRadius: "6px",
    accentColor: "#7ab4ff",
    textColor: "#ffffff",
    dimTextColor: "rgba(122,180,255,0.8)",
    dividerColor: "rgba(122,180,255,0.35)",
    goalBg: "linear-gradient(135deg,#003087 0%,#0052cc 100%)",
    goalTextColor: "#ffffff",
    goalAccentColor: "#7ab4ff",
    lowerBg: "rgba(0,48,135,0.97)",
    lowerLeftBorder: "5px solid #7ab4ff",
    lowerTextColor: "#ffffff",
    lowerAccentColor: "#7ab4ff",
    penaltyBg: "#ffd700",
    penaltyTextColor: "#003087",
    lineupBg: "rgba(0,48,135,0.97)",
    lineupTextColor: "#ffffff",
    lineupAccentColor: "#7ab4ff",
    fullscreenBg: "rgba(0,48,135,0.94)",
    fullscreenTextColor: "#ffffff",
    fullscreenAccentColor: "#7ab4ff",
  },
  "neon-sport": {
    scorebugBg: "#060606",
    scorebugBorder: "1px solid #00ff88",
    scorebugRadius: "2px",
    accentColor: "#00ff88",
    textColor: "#ffffff",
    dimTextColor: "rgba(0,255,136,0.65)",
    dividerColor: "rgba(0,255,136,0.25)",
    goalBg: "linear-gradient(135deg,#001a0d 0%,#003319 100%)",
    goalTextColor: "#00ff88",
    goalAccentColor: "#ffffff",
    lowerBg: "rgba(6,6,6,0.98)",
    lowerLeftBorder: "5px solid #00ff88",
    lowerTextColor: "#00ff88",
    lowerAccentColor: "#ffffff",
    penaltyBg: "#00ff88",
    penaltyTextColor: "#060606",
    lineupBg: "rgba(6,6,6,0.98)",
    lineupTextColor: "#ffffff",
    lineupAccentColor: "#00ff88",
    fullscreenBg: "rgba(6,6,6,0.96)",
    fullscreenTextColor: "#00ff88",
    fullscreenAccentColor: "#ffffff",
  },
  "ligr-pro": {
    scorebugBg: "#074c52",
    scorebugBorder: "2px solid #24d0bb",
    scorebugRadius: "3px",
    accentColor: "#24d0bb",
    textColor: "#ecfffd",
    dimTextColor: "rgba(236,255,253,0.72)",
    dividerColor: "rgba(36,208,187,0.4)",
    goalBg: "linear-gradient(135deg,#0a747c 0%,#06484d 100%)",
    goalTextColor: "#ecfffd",
    goalAccentColor: "#78f4e0",
    lowerBg: "rgba(5,54,59,0.97)",
    lowerLeftBorder: "5px solid #24d0bb",
    lowerTextColor: "#ecfffd",
    lowerAccentColor: "#78f4e0",
    penaltyBg: "#0c7f88",
    penaltyTextColor: "#ecfffd",
    lineupBg: "rgba(5,54,59,0.97)",
    lineupTextColor: "#ecfffd",
    lineupAccentColor: "#24d0bb",
    fullscreenBg: "rgba(3,40,44,0.94)",
    fullscreenTextColor: "#ecfffd",
    fullscreenAccentColor: "#78f4e0",
  },
};

export default function Overlay() {
  const searchParams = useSearchParams();
  const rawMatchId = (searchParams.get("match") || "").trim();
  const matchId = rawMatchId && rawMatchId !== "undefined" && rawMatchId !== "null" ? rawMatchId : "";
  const normalizedMatchId = matchId.toLowerCase().trim();
  const homeTeamFromQuery = (searchParams.get("homeTeam") || "").trim();
  const awayTeamFromQuery = (searchParams.get("awayTeam") || "").trim();
  const homeLogoFromQuery = (searchParams.get("homeLogo") || "").trim();
  const awayLogoFromQuery = (searchParams.get("awayLogo") || "").trim();
  const leagueLogoFromQuery = (searchParams.get("leagueLogo") || "").trim();
  const startAtFromQuery = (searchParams.get("startAt") || "").trim();

  const [homeTeam, setHomeTeam] = useState(homeTeamFromQuery || "KOTI");
  const [awayTeam, setAwayTeam] = useState(awayTeamFromQuery || "VIERAS");
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [period, setPeriod] = useState("1");
  const [clock, setClock] = useState("00:00");

  const [scene, setScene] = useState("scorebug");
  const [goalText, setGoalText] = useState("");
  const [showGoal, setShowGoal] = useState(false);
  const [showGoalScorer, setShowGoalScorer] = useState(false);
  const [goalScorerInfo, setGoalScorerInfo] = useState<{ scorer: string; minute: string; teamName: string; teamLogo: string; side: string } | null>(null);
  const goalScorerTimeoutRef = useRef<number | null>(null);
  const [showGoalRecap, setShowGoalRecap] = useState(false);
  const [goalRecapInfo, setGoalRecapInfo] = useState<{ scorer: string; minute: string; side: "home" | "away" } | null>(null);
  const goalRecapTimeoutRef = useRef<number | null>(null);
  const [goalScorerHistory, setGoalScorerHistory] = useState<Array<{ scorer: string; minute: string; side: "home" | "away" }>>([]);
  const [redCardCounts, setRedCardCounts] = useState<{ home: number; away: number }>({ home: 0, away: 0 });
  const [showCardScorer, setShowCardScorer] = useState(false);
  const [cardScorerInfo, setCardScorerInfo] = useState<{ player: string; minute: string; teamName: string; teamLogo: string; side: string; cardType: "yellow" | "red" } | null>(null);
  const cardScorerTimeoutRef = useRef<number | null>(null);
  const processedCardEventsRef = useRef<Record<string, number>>({});
  const [showSubstitutionCard, setShowSubstitutionCard] = useState(false);
  const [substitutionCardInfo, setSubstitutionCardInfo] = useState<{
    minute: string;
    teamName: string;
    teamLogo: string;
    pairs: Array<{ outPlayer: string; inPlayer: string }>;
  } | null>(null);
  const substitutionCardTimeoutRef = useRef<number | null>(null);
  const [lowerThird, setLowerThird] = useState("");
  const [showLowerThird, setShowLowerThird] = useState(false);
  const [penaltyText, setPenaltyText] = useState("");
  const [showPenalty, setShowPenalty] = useState(false);
  const [lineup, setLineup] = useState("");
  const [showLineup, setShowLineup] = useState(false);
  const [fullscreenText, setFullscreenText] = useState("");
  const [showFullscreen, setShowFullscreen] = useState(false);

  const [homeLogo, setHomeLogo] = useState(homeLogoFromQuery);
  const [awayLogo, setAwayLogo] = useState(awayLogoFromQuery);
  const [leagueLogo, setLeagueLogo] = useState(leagueLogoFromQuery);
  const [homeKitColor, setHomeKitColor] = useState("#1a56db");
  const [awayKitColor, setAwayKitColor] = useState("#e53935");
  const [startAt, setStartAt] = useState(startAtFromQuery);
  const [refereeName, setRefereeName] = useState("");
  const [aet1Name, setAet1Name] = useState("");
  const [aet2Name, setAet2Name] = useState("");
  const [venue, setVenue] = useState("");
  const [sponsorLogo, setSponsorLogo] = useState("");

  const [overlayStyle, setOverlayStyle] = useState<OverlayStyleKey>("ligr-pro");
  const [showPreMatchPreview, setShowPreMatchPreview] = useState(true);
  const [showGameClock, setShowGameClock] = useState(false);
  const [showAboutToStart, setShowAboutToStart] = useState(false);
  const [aboutToStartText, setAboutToStartText] = useState("Ottelu alkaa pian");
  const [homePenaltyShootout, setHomePenaltyShootout] = useState<PenaltyShootoutAttempt[]>([]);
  const [awayPenaltyShootout, setAwayPenaltyShootout] = useState<PenaltyShootoutAttempt[]>([]);
  const [showHalftimeStats, setShowHalftimeStats] = useState(false);
  const [halftimeStatsTitle, setHalftimeStatsTitle] = useState("1. jakso paattynyt");
  const [halftimeStatRows, setHalftimeStatRows] = useState<OverlayHalftimeStatRow[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [homeRosterOverlay, setHomeRosterOverlay] = useState<OverlayRosterPanel>({
    visible: false,
    teamName: "",
    mode: "lineup",
    formation: "",
    rows: [],
    starting: [],
    bench: [],
  });
  const [awayRosterOverlay, setAwayRosterOverlay] = useState<OverlayRosterPanel>({
    visible: false,
    teamName: "",
    mode: "lineup",
    formation: "",
    rows: [],
    starting: [],
    bench: [],
  });
  const [playerPhotoByTeamAndName, setPlayerPhotoByTeamAndName] = useState<Record<string, string>>({});
  const lastRelayTsRef = useRef(0);
  const aboutToStartTimeoutRef = useRef<number | null>(null);
  const halftimeStatsTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (homeTeamFromQuery) setHomeTeam(homeTeamFromQuery);
    if (awayTeamFromQuery) setAwayTeam(awayTeamFromQuery);
    if (homeLogoFromQuery) setHomeLogo(homeLogoFromQuery);
    if (awayLogoFromQuery) setAwayLogo(awayLogoFromQuery);
    if (leagueLogoFromQuery) setLeagueLogo(leagueLogoFromQuery);
    if (startAtFromQuery) setStartAt(startAtFromQuery);
  }, [awayLogoFromQuery, awayTeamFromQuery, homeLogoFromQuery, homeTeamFromQuery, leagueLogoFromQuery, startAtFromQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBackground = html.style.background;
    const prevBodyBackground = body.style.background;
    const prevBodyMargin = body.style.margin;

    html.style.background = "transparent";
    body.style.background = "transparent";
    body.style.margin = "0";

    return () => {
      html.style.background = prevHtmlBackground;
      body.style.background = prevBodyBackground;
      body.style.margin = prevBodyMargin;
    };
  }, []);

  useEffect(() => {
    if (!matchId || typeof window === "undefined") return;

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (!key.endsWith(":match-link-data")) continue;

      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as Record<string, { homeTeam: string; awayTeam: string; homeLogo: string; awayLogo: string; leagueLogo: string; startAt: string; refereeName?: string; aet1Name?: string; aet2Name?: string; venue?: string }>;
        const data = parsed?.[matchId];
        if (!data) continue;

        if (data.homeTeam) setHomeTeam(data.homeTeam);
        if (data.awayTeam) setAwayTeam(data.awayTeam);
        if (data.homeLogo) setHomeLogo(data.homeLogo);
        if (data.awayLogo) setAwayLogo(data.awayLogo);
        if (data.leagueLogo) setLeagueLogo(data.leagueLogo);
        if (data.startAt) setStartAt(data.startAt);
        setRefereeName(data.refereeName || "");
        setAet1Name(data.aet1Name || "");
        setAet2Name(data.aet2Name || "");
        setVenue(data.venue || "");
        break;
      } catch {
        // Ignore malformed localStorage payloads.
      }
    }
  }, [matchId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (startAt) return;

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (!key.endsWith(":matches")) continue;

      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as Array<{ matchId?: string; homeTeam?: string; awayTeam?: string; scheduledAt?: string }>;
        if (!Array.isArray(parsed)) continue;

        const normalizedHome = (homeTeam || "").trim().toLowerCase();
        const normalizedAway = (awayTeam || "").trim().toLowerCase();
        const normalizedCurrentMatchId = (matchId || "").trim().toLowerCase();

        const found = parsed.find((item) => {
          const byMatchId = typeof item.matchId === "string" && item.matchId.trim().toLowerCase() === normalizedCurrentMatchId;
          const byTeams =
            typeof item.homeTeam === "string" &&
            typeof item.awayTeam === "string" &&
            item.homeTeam.trim().toLowerCase() === normalizedHome &&
            item.awayTeam.trim().toLowerCase() === normalizedAway;
          return byMatchId || byTeams;
        });

        if (found?.scheduledAt) {
          setStartAt(found.scheduledAt);
          break;
        }
      } catch {
        // Ignore malformed matches payloads.
      }
    }
  }, [awayTeam, homeTeam, matchId, startAt]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rebuildPlayerPhotoLookup = () => {
      const nextMap: Record<string, string> = {};

      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) || "";
        if (!key.endsWith(":players")) continue;

        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw) as Array<{ firstName?: string; lastName?: string; team?: string; photo?: string }>;
          if (!Array.isArray(parsed)) continue;

          parsed.forEach((player) => {
            const fullName = `${player.firstName || ""} ${player.lastName || ""}`.trim();
            const teamName = (player.team || "").trim();
            const normalizedName = normalizePlayerName(fullName);
            const photo = (player.photo || "").trim();
            if (!teamName || !normalizedName || !photo) return;
            nextMap[`${teamName.toLowerCase()}|${normalizedName}`] = photo;
          });
        } catch {
          // Ignore malformed players payloads.
        }
      }

      setPlayerPhotoByTeamAndName(nextMap);
    };

    rebuildPlayerPhotoLookup();

    const onStorage = (event: StorageEvent) => {
      if (event.key?.endsWith(":players")) {
        rebuildPlayerPhotoLookup();
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const hasMatchId = Boolean(matchId);
    const matchStartKey = `ligr:match-started:${matchId || "global"}`;
    const forceHidePreMatchKey = `ligr:force-hide-prematch:${matchId || "global"}`;
    const legacyGlobalMatchStartKey = "ligr:match-started:global";
    const legacyForceHidePreMatchKey = "ligr:force-hide-prematch";
    if (typeof window === "undefined") return;

    const hasStartSignal = () => {
      if (hasMatchId) {
        return Boolean(localStorage.getItem(matchStartKey) || localStorage.getItem(forceHidePreMatchKey));
      }
      return Boolean(
        localStorage.getItem(matchStartKey) ||
        localStorage.getItem(forceHidePreMatchKey) ||
        localStorage.getItem(legacyGlobalMatchStartKey) ||
        localStorage.getItem(legacyForceHidePreMatchKey),
      );
    };

    if (hasStartSignal()) {
      setShowPreMatchPreview(false);
    }

    const onStorage = (event: StorageEvent) => {
      if (
        event.newValue &&
        (event.key === matchStartKey ||
          event.key === forceHidePreMatchKey ||
          (!hasMatchId && (event.key === legacyGlobalMatchStartKey || event.key === legacyForceHidePreMatchKey)))
      ) {
        setShowPreMatchPreview(false);
      }
    };

    const poll = window.setInterval(() => {
      if (hasStartSignal()) {
        setShowPreMatchPreview(false);
      }
    }, 800);

    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(poll);
    };
  }, [matchId]);

  useEffect(() => {
    const applyEngineMessage = (d: Record<string, unknown>) => {
      if (d.type === "score") {
        setHomeTeam((d.homeTeam as string) || "KOTI");
        setAwayTeam((d.awayTeam as string) || "VIERAS");
        setHomeScore(typeof d.homeScore === "number" ? d.homeScore : 0);
        setAwayScore(typeof d.awayScore === "number" ? d.awayScore : 0);
        setPeriod((d.period as string) || "1");
        setClock((d.clock as string) || "00:00");
        if (typeof d.homeKitColor === "string" && d.homeKitColor) setHomeKitColor(d.homeKitColor);
        if (typeof d.awayKitColor === "string" && d.awayKitColor) setAwayKitColor(d.awayKitColor);
        if (d.clockRunning === true) {
          setShowPreMatchPreview(false);
          setShowAboutToStart(false);
          setShowHalftimeStats(false);
          setShowGameClock(true);
        }
        if (d.clockRunning === false) {
          setShowGameClock(false);
        }
      }
      if (d.type === "resetMatch") {
        if (!d.matchId || d.matchId === matchId) {
          setHomeScore(0);
          setAwayScore(0);
          setPeriod("1");
          setClock("00:00");
          setGoalText("");
          setShowGoal(false);
          setShowGoalScorer(false);
          setGoalScorerInfo(null);
          setShowGoalRecap(false);
          setGoalRecapInfo(null);
          setGoalScorerHistory([]);
          setRedCardCounts({ home: 0, away: 0 });
          setShowCardScorer(false);
          setCardScorerInfo(null);
          setShowSubstitutionCard(false);
          setSubstitutionCardInfo(null);
          setLowerThird("");
          setShowLowerThird(false);
          setPenaltyText("");
          setShowPenalty(false);
          setLineup("");
          setShowLineup(false);
          setFullscreenText("");
          setShowFullscreen(false);
          setScene("scorebug");
          setShowPreMatchPreview(true);
          setShowGameClock(false);
          setShowAboutToStart(false);
          setAboutToStartText("Ottelu alkaa pian");
          setHomePenaltyShootout([]);
          setAwayPenaltyShootout([]);
          setShowHalftimeStats(false);
          if (halftimeStatsTimeoutRef.current) {
            window.clearTimeout(halftimeStatsTimeoutRef.current);
            halftimeStatsTimeoutRef.current = null;
          }
          setHalftimeStatsTitle("1. jakso paattynyt");
          setHalftimeStatRows([]);
          setHomeRosterOverlay((prev) => ({ ...prev, visible: false }));
          setAwayRosterOverlay((prev) => ({ ...prev, visible: false }));
        }
      }
      if (d.type === "scene" && typeof d.scene === "string") setScene(d.scene);
      if (d.type === "matchStart") {
        const incomingMatchId = typeof d.matchId === "string" ? d.matchId.toLowerCase().trim() : "";
        if (!normalizedMatchId || !incomingMatchId || incomingMatchId === normalizedMatchId) {
          setShowPreMatchPreview(false);
          setShowAboutToStart(false);
          setShowHalftimeStats(false);
          setShowGameClock(false);
        }
      }
      if (d.type === "hidePreMatch") {
        const incomingMatchId = typeof d.matchId === "string" ? d.matchId.toLowerCase().trim() : "";
        if (!normalizedMatchId || !incomingMatchId || incomingMatchId === normalizedMatchId) {
          setShowPreMatchPreview(false);
          setShowAboutToStart(false);
          setShowHalftimeStats(false);
          setShowGameClock(false);
        }
      }
      if (d.type === "aboutToStart") {
        const incomingMatchId = typeof d.matchId === "string" ? d.matchId.toLowerCase().trim() : "";
        if (!normalizedMatchId || !incomingMatchId || incomingMatchId === normalizedMatchId) {
          setShowPreMatchPreview(false);
          setShowGameClock(false);
          setShowHalftimeStats(false);
          setPenaltyText("");
          setShowPenalty(false);
          setShowAboutToStart(true);
          setAboutToStartText(typeof d.text === "string" && d.text.trim() ? d.text : "Ottelu alkaa pian");
          setHomeRosterOverlay((prev) => ({ ...prev, visible: false }));
          setAwayRosterOverlay((prev) => ({ ...prev, visible: false }));
          if (aboutToStartTimeoutRef.current) {
            window.clearTimeout(aboutToStartTimeoutRef.current);
            aboutToStartTimeoutRef.current = null;
          }
        }
      }
      if (d.type === "penaltyShootout") {
        const incomingMatchId = typeof d.matchId === "string" ? d.matchId.toLowerCase().trim() : "";
        if (!normalizedMatchId || !incomingMatchId || incomingMatchId === normalizedMatchId) {
          const sanitizeAttempts = (raw: unknown): PenaltyShootoutAttempt[] => {
            if (!Array.isArray(raw)) return [];
            return raw
              .map((entry) => {
                if (!entry || typeof entry !== "object") return null;
                const result = (entry as { result?: unknown }).result;
                const player = (entry as { player?: unknown }).player;
                if (result !== "scored" && result !== "missed") return null;
                return {
                  result,
                  player: typeof player === "string" && player.trim() ? player.trim() : "Tuntematon",
                };
              })
              .filter((entry): entry is PenaltyShootoutAttempt => entry !== null)
              .slice(0, 5);
          };

          setHomePenaltyShootout(sanitizeAttempts(d.homeAttempts));
          setAwayPenaltyShootout(sanitizeAttempts(d.awayAttempts));
        }
      }
      if (d.type === "halftimeStats") {
        const incomingMatchId = typeof d.matchId === "string" ? d.matchId.toLowerCase().trim() : "";
        if (!normalizedMatchId || !incomingMatchId || incomingMatchId === normalizedMatchId) {
          setShowPreMatchPreview(false);
          setShowAboutToStart(false);
          setShowGameClock(false);
          setShowHalftimeStats(true);
          setHalftimeStatsTitle(typeof d.title === "string" && d.title.trim() ? d.title : "1. jakso paattynyt");
          setHalftimeStatRows(
            Array.isArray(d.stats)
              ? d.stats
                  .map((row) => ({
                    key: typeof row?.key === "string" ? row.key : "",
                    label: typeof row?.label === "string" ? row.label : "",
                    home: typeof row?.home === "string" ? row.home : String(row?.home ?? "-"),
                    away: typeof row?.away === "string" ? row.away : String(row?.away ?? "-"),
                  }))
                  .filter((row) => row.key && row.label)
              : []
          );
          setHomeRosterOverlay((prev) => ({ ...prev, visible: false }));
          setAwayRosterOverlay((prev) => ({ ...prev, visible: false }));
          const nextScene = typeof d.nextScene === "string" ? d.nextScene : "scorebug";
          const nextText = typeof d.nextText === "string" && d.nextText.trim() ? d.nextText : "Ottelu alkaa pian";
          if (halftimeStatsTimeoutRef.current) {
            window.clearTimeout(halftimeStatsTimeoutRef.current);
          }
          halftimeStatsTimeoutRef.current = window.setTimeout(() => {
            setShowHalftimeStats(false);
            if (nextScene === "aboutToStart") {
              setShowAboutToStart(true);
              setAboutToStartText(nextText);
              setShowGameClock(false);
            } else {
              setScene("scorebug");
              setShowGameClock(true);
            }
          }, 30000);
        }
      }
      if (d.type === "halftimeStatsHide") {
        const incomingMatchId = typeof d.matchId === "string" ? d.matchId.toLowerCase().trim() : "";
        if (!normalizedMatchId || !incomingMatchId || incomingMatchId === normalizedMatchId) {
          if (halftimeStatsTimeoutRef.current) {
            window.clearTimeout(halftimeStatsTimeoutRef.current);
            halftimeStatsTimeoutRef.current = null;
          }
          setShowHalftimeStats(false);
          setScene("scorebug");
          setShowGameClock(true);
        }
      }
      if (d.type === "overlayStyle") setOverlayStyle(d.style as OverlayStyleKey);
      if (d.type === "teamRosterOverlay") {
        const incomingMatchId = typeof d.matchId === "string" ? d.matchId.toLowerCase().trim() : "";
        if (!normalizedMatchId || !incomingMatchId || incomingMatchId === normalizedMatchId) {
          const parseRosterPanel = (value: unknown): OverlayRosterPanel => {
            const panel: Record<string, unknown> = typeof value === "object" && value !== null
              ? (value as Record<string, unknown>)
              : {};
            return {
              visible: Boolean(panel.visible),
              teamName: typeof panel.teamName === "string" ? panel.teamName : "",
              mode: panel.mode === "rotation" ? "rotation" : "lineup",
              lineupOnly: Boolean(panel.lineupOnly),
              formation: typeof panel.formation === "string" ? panel.formation : "",
              rows: Array.isArray(panel.rows)
                ? panel.rows
                    .map((row) => {
                      if (typeof row !== "object" || row === null) return null;
                      const rowRecord = row as Record<string, unknown>;
                      return {
                        role: typeof rowRecord.role === "string" ? rowRecord.role : "",
                        player: typeof rowRecord.player === "string" ? rowRecord.player : "",
                      };
                    })
                    .filter((row): row is { role: string; player: string } => row !== null)
                : [],
              starting: Array.isArray(panel.starting) ? panel.starting.filter((item): item is string => typeof item === "string") : [],
              bench: Array.isArray(panel.bench) ? panel.bench.filter((item): item is string => typeof item === "string") : [],
            };
          };

          setHomeRosterOverlay(parseRosterPanel(d.home));
          setAwayRosterOverlay(parseRosterPanel(d.away));
        }
      }
      if (d.type === "goal") {
        setGoalText((d.text as string) || "");
        setShowGoal(true);
        setTimeout(() => setShowGoal(false), 5000);
      }
      if (d.type === "goalScorer") {
        const scorer = (d.scorer as string) || "";
        const minute = (d.minute as string) || "";
        const side = (d.side as string) === "away" ? "away" : "home";
        const recapPayload = { scorer, minute, side: side as "home" | "away" };
        setGoalScorerInfo({
          scorer,
          minute,
          teamName: (d.teamName as string) || "",
          teamLogo: (d.teamLogo as string) || "",
          side,
        });
        setShowGoalRecap(false);
        setGoalRecapInfo(recapPayload);
        setGoalScorerHistory((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.scorer === recapPayload.scorer && last.minute === recapPayload.minute && last.side === recapPayload.side) {
            return prev;
          }
          return [...prev, recapPayload];
        });
        if (goalRecapTimeoutRef.current) window.clearTimeout(goalRecapTimeoutRef.current);
        setShowGoalScorer(true);
        if (goalScorerTimeoutRef.current) window.clearTimeout(goalScorerTimeoutRef.current);
        goalScorerTimeoutRef.current = window.setTimeout(() => {
          setShowGoalScorer(false);
          setGoalRecapInfo(recapPayload);
          setShowGoalRecap(true);
          if (goalRecapTimeoutRef.current) window.clearTimeout(goalRecapTimeoutRef.current);
          goalRecapTimeoutRef.current = window.setTimeout(() => setShowGoalRecap(false), 8000);
        }, 6000);
      }
      if (d.type === "cardScorer") {
        const nextCardType = (d.cardType as string) === "red" ? "red" : "yellow";
        const side = (d.side as string) === "away" ? "away" : "home";
        const eventKey = typeof d.eventId === "string" && d.eventId.trim()
          ? d.eventId.trim()
          : `${side}|${nextCardType}|${(d.player as string) || ""}|${(d.minute as string) || ""}|${typeof d.redCardCount === "number" ? d.redCardCount : ""}`;
        const now = Date.now();
        const seenAt = processedCardEventsRef.current[eventKey];
        if (seenAt && now - seenAt < 15000) {
          return;
        }
        processedCardEventsRef.current[eventKey] = now;
        Object.entries(processedCardEventsRef.current).forEach(([key, ts]) => {
          if (now - ts > 60000) {
            delete processedCardEventsRef.current[key];
          }
        });
        setCardScorerInfo({
          player: (d.player as string) || "",
          minute: (d.minute as string) || "",
          teamName: (d.teamName as string) || "",
          teamLogo: (d.teamLogo as string) || "",
          side,
          cardType: nextCardType,
        });
        if (nextCardType === "red") {
          const incomingRedCount = typeof d.redCardCount === "number" ? Math.max(0, d.redCardCount) : null;
          setRedCardCounts((prev) => ({
            ...prev,
            [side]: incomingRedCount !== null ? incomingRedCount : prev[side] + 1,
          }));
        }
        setShowCardScorer(true);
        if (cardScorerTimeoutRef.current) window.clearTimeout(cardScorerTimeoutRef.current);
        cardScorerTimeoutRef.current = window.setTimeout(() => setShowCardScorer(false), 6000);
      }
      if (d.type === "substitutionCard") {
        const pairs = Array.isArray(d.pairs)
          ? d.pairs
              .map((pair) => ({
                outPlayer: typeof pair?.outPlayer === "string" ? pair.outPlayer : "",
                inPlayer: typeof pair?.inPlayer === "string" ? pair.inPlayer : "",
              }))
              .filter((pair) => pair.outPlayer && pair.inPlayer)
          : [];

        if (pairs.length > 0) {
          setSubstitutionCardInfo({
            minute: (d.minute as string) || "",
            teamName: (d.teamName as string) || "",
            teamLogo: (d.teamLogo as string) || "",
            pairs,
          });
          setShowSubstitutionCard(true);
          if (substitutionCardTimeoutRef.current) window.clearTimeout(substitutionCardTimeoutRef.current);
          substitutionCardTimeoutRef.current = window.setTimeout(() => setShowSubstitutionCard(false), 8000);
        }
      }
      if (d.type === "lower") {
        setLowerThird((d.text as string) || "");
        setShowLowerThird(true);
        setTimeout(() => setShowLowerThird(false), 6000);
      }
      if (d.type === "penalty") {
        setPenaltyText((d.text as string) || "");
        setShowPenalty(true);
        setTimeout(() => setShowPenalty(false), 6000);
      }
      if (d.type === "lineup") {
        setLineup((d.text as string) || "");
        setShowLineup(true);
        setTimeout(() => setShowLineup(false), 9000);
      }
      if (d.type === "fullscreen") {
        setFullscreenText((d.text as string) || "");
        setShowFullscreen(true);
        setTimeout(() => setShowFullscreen(false), 7000);
      }
      if (d.type === "branding") {
        setHomeLogo((d.homeLogo as string) || "");
        setAwayLogo((d.awayLogo as string) || "");
        setLeagueLogo((d.leagueLogo as string) || "");
        setSponsorLogo((d.sponsorLogo as string) || "");
      }
    };

    const applyRelayPayload = (raw: string | null) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const relayTs = Number(parsed.relayTs || 0);
        if (!Number.isFinite(relayTs) || relayTs <= lastRelayTsRef.current) return;
        lastRelayTsRef.current = relayTs;
        applyEngineMessage(parsed);
      } catch {
        // Ignore malformed relay payloads.
      }
    };

    const channel = typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("ligr_full_clone_engine")
      : null;
    if (channel) {
      channel.onmessage = (event) => {
        try {
          const payload = event.data as Record<string, unknown>;
          const relayTs = Number(payload?.relayTs || 0);
          if (Number.isFinite(relayTs) && relayTs > 0) {
            if (relayTs <= lastRelayTsRef.current) return;
            lastRelayTsRef.current = relayTs;
          }
          applyEngineMessage(payload);
        } catch {
          // Ignore malformed channel payloads.
        }
      };
    }

    const unsubscribeRelay = relaySubscribe((payload) => {
      const relayTs = Number(payload?.relayTs || 0);
      if (Number.isFinite(relayTs) && relayTs > 0) {
        if (relayTs <= lastRelayTsRef.current) return;
        lastRelayTsRef.current = relayTs;
      }
      applyEngineMessage(payload);
    });

    const onStorage = (event: StorageEvent) => {
      if (event.key === ENGINE_RELAY_KEY) {
        applyRelayPayload(event.newValue);
      }
    };

    if (typeof window !== "undefined") {
      applyRelayPayload(localStorage.getItem(ENGINE_RELAY_KEY));
      window.addEventListener("storage", onStorage);
    }

    const relayPoll = window.setInterval(() => {
      if (typeof window === "undefined") return;
      applyRelayPayload(localStorage.getItem(ENGINE_RELAY_KEY));
    }, 300);

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage);
      }
      if (aboutToStartTimeoutRef.current) {
        window.clearTimeout(aboutToStartTimeoutRef.current);
      }
      if (halftimeStatsTimeoutRef.current) {
        window.clearTimeout(halftimeStatsTimeoutRef.current);
      }
      if (goalScorerTimeoutRef.current) {
        window.clearTimeout(goalScorerTimeoutRef.current);
      }
      if (goalRecapTimeoutRef.current) {
        window.clearTimeout(goalRecapTimeoutRef.current);
      }
      unsubscribeRelay();
      window.clearInterval(relayPoll);
      channel?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, normalizedMatchId]);

  const s = STYLE_CFGS[overlayStyle];
  const streamPalette = {
    deep: "#03383d",
    dark: "#06484d",
    base: "#0a6b72",
    light: "#0d8f96",
    line: "rgba(171,244,236,0.32)",
    text: "#ecfffd",
    textDim: "rgba(236,255,253,0.82)",
    accent: "#24d0bb",
    accentBright: "#78f4e0",
    scoreBg: "linear-gradient(180deg, #ebfffb 0%, #bff3ea 100%)",
  };
  const graphicsReady = !showPreMatchPreview;
  const visibleRosterSide = awayRosterOverlay.visible ? "away" : homeRosterOverlay.visible ? "home" : null;
  const visibleRosterPanel = visibleRosterSide === "away" ? awayRosterOverlay : visibleRosterSide === "home" ? homeRosterOverlay : null;
  const lineupOnlyFallback = Boolean(visibleRosterPanel?.lineupOnly);
  const isHomeRosterPanel = visibleRosterSide === "home";
  const visibleRosterLogo = isHomeRosterPanel ? homeLogo : awayLogo;
  const getRotationPlayerPhoto = (panel: OverlayRosterPanel, playerName: string) => {
    const normalizedTeam = (panel.teamName || "").trim().toLowerCase();
    const normalizedName = normalizePlayerName(playerName || "");
    if (!normalizedName) return "";

    if (normalizedTeam) {
      const key = `${normalizedTeam}|${normalizedName}`;
      if (playerPhotoByTeamAndName[key]) return playerPhotoByTeamAndName[key];
    }

    const suffix = `|${normalizedName}`;
    const fallbackEntry = Object.entries(playerPhotoByTeamAndName).find(([key]) => key.endsWith(suffix));
    return fallbackEntry?.[1] || "";
  };
  const startDate = startAt ? new Date(startAt) : null;
  const hasKickoffPassed = Boolean(startDate && !Number.isNaN(startDate.getTime()) && nowMs >= startDate.getTime());
  const periodValue = Number.parseInt(period, 10);
  const goalHalfLabel = periodValue >= 2 ? "Jakso 2" : "Jakso 1";
  const halftimeDisplayLabel = periodValue === 1 ? "Tauko" : goalHalfLabel;
  const halftimeTitleText = halftimeStatsTitle?.trim() ? halftimeStatsTitle : `${goalHalfLabel} paattynyt`;
  const periodSuffix = periodValue === 1 ? "ST" : periodValue === 2 ? "ND" : periodValue === 3 ? "RD" : "TH";
  const periodLabel = Number.isFinite(periodValue) && periodValue > 0 ? `${periodValue}${periodSuffix}` : `${period}`;
  const [clockMinutesPart = "0", clockSecondsPart = "0"] = (clock || "").split(":");
  const clockMinutesValue = Number.parseInt(clockMinutesPart, 10);
  const clockSecondsValue = Number.parseInt(clockSecondsPart, 10);
  const safeMinutes = Number.isFinite(clockMinutesValue) ? Math.max(0, clockMinutesValue) : 0;
  const safeSeconds = Number.isFinite(clockSecondsValue) ? Math.max(0, clockSecondsValue) : 0;
  const totalClockSeconds = safeMinutes * 60 + safeSeconds;
  const formatClock = (totalSeconds: number) => `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
  const isFirstHalf = periodValue === 1;
  const isSecondHalf = periodValue === 2;
  const firstHalfBaseSeconds = 45 * 60;
  const secondHalfBaseSeconds = 90 * 60;
  const showFirstHalfAddedTime = isFirstHalf && totalClockSeconds >= firstHalfBaseSeconds;
  const showSecondHalfAddedTime = isSecondHalf && totalClockSeconds >= secondHalfBaseSeconds;
  const showAddedTimeClock = showFirstHalfAddedTime || showSecondHalfAddedTime;
  const addedTimeSeconds = showFirstHalfAddedTime
    ? totalClockSeconds - firstHalfBaseSeconds
    : showSecondHalfAddedTime
      ? totalClockSeconds - secondHalfBaseSeconds
      : 0;
  const displayMainClock = showFirstHalfAddedTime
    ? "45:00"
    : showSecondHalfAddedTime
      ? "90:00"
      : formatClock(totalClockSeconds);
  const displayAddedClock = formatClock(Math.max(0, addedTimeSeconds));
  const kickoffLabel = startDate && !Number.isNaN(startDate.getTime())
    ? startDate.toLocaleString("fi-FI", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Aikaa ei asetettu";
  const kickoffDateLabel = startDate && !Number.isNaN(startDate.getTime())
    ? startDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "";
  const kickoffTimeLabel = startDate && !Number.isNaN(startDate.getTime())
    ? startDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "";
  const formatScorerMinute = (minuteValue: string) => {
    const parsedMinute = Number.parseInt((minuteValue || "").split(":")[0] || "0", 10);
    return Number.isFinite(parsedMinute) ? `${Math.max(0, parsedMinute)}'` : minuteValue;
  };
  const buildScorerLines = (side: "home" | "away") => {
    const grouped = new Map<string, { name: string; minutes: string[] }>();
    goalScorerHistory
      .filter((entry) => entry.side === side)
      .forEach((entry) => {
        const key = normalizePlayerName(entry.scorer || "") || (entry.scorer || "").trim().toLowerCase();
        const minuteText = formatScorerMinute(entry.minute);
        const existing = grouped.get(key);
        if (existing) {
          existing.minutes.push(minuteText);
          return;
        }
        grouped.set(key, {
          name: (entry.scorer || "MAALINTEKIJA").toUpperCase(),
          minutes: [minuteText],
        });
      });
    return Array.from(grouped.values()).map((player) => `${player.name} ${player.minutes.join(", ")}`);
  };
  const homeScorerLines = buildScorerLines("home");
  const awayScorerLines = buildScorerLines("away");
  const latestGoalEntry = goalScorerHistory.length > 0 ? goalScorerHistory[goalScorerHistory.length - 1] : null;
  const latestGoalLine = latestGoalEntry
    ? `${(latestGoalEntry.scorer || "MAALINTEKIJA").toUpperCase()} ${formatScorerMinute(latestGoalEntry.minute)}`
    : "-";
  const normalizedAboutToStartText = aboutToStartText.trim().toLowerCase();
  const isSecondHalfRecap = normalizedAboutToStartText === "jakso 2";
  const isHalftimeRecap = normalizedAboutToStartText === "tauko";
  const isMatchEndedRecap = normalizedAboutToStartText.includes("päättynyt") || normalizedAboutToStartText.includes("paattynyt");
  const isPenaltyShootout = normalizedAboutToStartText === "rangaistuspotkut";
  const isRecapBoard = isSecondHalfRecap || isHalftimeRecap || isMatchEndedRecap;
  const recapBoardLabel = isMatchEndedRecap ? "Ottelu on päättynyt" : isHalftimeRecap ? "Tauko" : "Jakso 2";
  const recapInfoLine = isMatchEndedRecap ? aboutToStartText : latestGoalLine;
  const homePenaltyScore = homePenaltyShootout.filter((item) => item.result === "scored").length;
  const awayPenaltyScore = awayPenaltyShootout.filter((item) => item.result === "scored").length;
  const penaltyRound = Math.min(5, Math.max(homePenaltyShootout.length, awayPenaltyShootout.length) + 1);
  const renderPenaltyAttempt = (attempt: PenaltyShootoutAttempt | undefined, key: string) => {
    if (attempt?.result === "scored") {
      return <span key={key} className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-200/65 bg-emerald-500 text-sm font-black text-white">O</span>;
    }
    if (attempt?.result === "missed") {
      return <span key={key} className="flex h-7 w-7 items-center justify-center rounded-full border border-red-200/65 bg-red-500 text-sm font-black text-white">X</span>;
    }
    return <span key={key} className="h-7 w-7 rounded-full border border-white/55 bg-white/10" />;
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-transparent">
      <div className="relative h-[1080px] w-[1920px] overflow-hidden bg-transparent">
      <AnimatePresence>
        {showPreMatchPreview && (
          <motion.div
            key="prematch-preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-40 flex flex-col"
            style={{ background: "linear-gradient(180deg, rgba(3,56,61,0.9) 0%, rgba(5,72,77,0.78) 60%, rgba(3,45,49,0.92) 100%)" }}
          >
            {/* ── Top info bar ── */}
            <div className="flex items-center justify-between px-16 py-5">
              {(kickoffDateLabel || kickoffTimeLabel) ? (
                <p className="text-[26px] font-semibold tracking-wide" style={{ color: streamPalette.textDim }}>
                  {kickoffDateLabel}{kickoffDateLabel && kickoffTimeLabel ? "\u2002\u2002" : ""}{kickoffTimeLabel}
                </p>
              ) : <div />}
              {venue ? (
                <p className="text-[26px] font-semibold tracking-wide" style={{ color: streamPalette.textDim }}>Stadium: {venue}</p>
              ) : leagueLogo ? (
                <img src={leagueLogo} alt="" className="h-9 object-contain" />
              ) : <div />}
            </div>

            {/* Thin separator */}
            <div className="mx-0 h-px" style={{ background: streamPalette.line }} />

            {/* ── Main content ── */}
            <div className="flex flex-1 flex-col items-center justify-center gap-8">
              <p className="text-[42px] font-semibold tracking-[0.06em]" style={{ color: streamPalette.textDim }}>Waiting for match</p>

              <div className="flex w-full items-center justify-center gap-0">
                {/* Home team */}
                <div className="flex w-[560px] flex-col items-center gap-5">
                  {homeLogo
                    ? <img src={homeLogo} alt={homeTeam} className="h-44 w-44 object-contain drop-shadow-2xl" />
                    : <div className="flex h-44 w-44 items-center justify-center rounded-full text-7xl font-black" style={{ background: "rgba(255,255,255,0.14)", color: streamPalette.text }}>{homeTeam.slice(0, 1)}</div>
                  }
                  <p className="text-[38px] font-black uppercase tracking-[0.05em]" style={{ color: streamPalette.text }}>{homeTeam}</p>
                </div>

                {/* Score */}
                <div className="flex w-[400px] flex-col items-center justify-center gap-4">
                  <p className="text-[100px] font-black tabular-nums leading-none tracking-tight" style={{ color: streamPalette.text }}>
                    {homeScore}<span className="mx-3" style={{ color: "rgba(236,255,253,0.58)" }}>:</span>{awayScore}
                  </p>
                </div>

                {/* Away team */}
                <div className="flex w-[560px] flex-col items-center gap-5">
                  {awayLogo
                    ? <img src={awayLogo} alt={awayTeam} className="h-44 w-44 object-contain drop-shadow-2xl" />
                    : <div className="flex h-44 w-44 items-center justify-center rounded-full text-7xl font-black" style={{ background: "rgba(255,255,255,0.14)", color: streamPalette.text }}>{awayTeam.slice(0, 1)}</div>
                  }
                  <p className="text-[38px] font-black uppercase tracking-[0.05em]" style={{ color: streamPalette.text }}>{awayTeam}</p>
                </div>
              </div>

              {hasKickoffPassed ? (
                <p className="text-[28px] font-semibold uppercase tracking-[0.22em]" style={{ color: streamPalette.accentBright }}>Alkaa pian</p>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {graphicsReady && showAboutToStart && (
          <motion.div
            key="about-to-start"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 z-[35]"
          >
            {isPenaltyShootout ? (
              <div className="absolute bottom-8 left-1/2 w-[min(1660px,calc(100vw-3rem))] -translate-x-1/2">
                <div className="mb-3 flex justify-center">
                  <div className="rounded-t-[160px] border px-20 py-2 text-center text-[34px] font-black uppercase tracking-[0.12em] shadow-xl" style={{ borderColor: streamPalette.line, background: "rgba(10,107,114,0.95)", color: streamPalette.text }}>
                    Rangaistuspotkut
                  </div>
                </div>

                <div className="overflow-hidden border shadow-2xl" style={{ borderColor: "rgba(191,255,246,0.22)", background: "linear-gradient(180deg, rgba(17,92,97,0.96) 0%, rgba(8,69,74,0.98) 100%)", boxShadow: "0 18px 44px rgba(0,0,0,0.42)" }}>
                  <div className="flex h-[86px] items-center border-b px-6" style={{ borderColor: "rgba(191,255,246,0.16)" }}>
                    <div className="flex w-[40%] items-center gap-4">
                      {homeLogo ? <img src={homeLogo} alt={homeTeam} className="h-14 w-14 object-contain" /> : <div className="h-14 w-14 rounded-full bg-white/20" />}
                      <p className="truncate text-[38px] font-black uppercase tracking-[0.03em] text-white">{homeTeam}</p>
                    </div>

                    <div className="flex w-[20%] justify-center">
                      <div
                        className="grid h-[62px] w-[320px] grid-cols-[72px_1fr_72px] items-center rounded-[24px] border text-[#0b4e54] shadow-lg"
                        style={{ borderColor: "rgba(10,96,102,0.22)", background: "linear-gradient(180deg, #ebfffb 0%, #c9f4ec 100%)" }}
                      >
                        <div className="text-center text-[34px] font-black leading-none">
                          ({homePenaltyScore})
                        </div>
                        <div className="text-center text-[52px] font-black leading-none">
                          {homeScore} - {awayScore}
                        </div>
                        <div className="text-center text-[34px] font-black leading-none">
                          ({awayPenaltyScore})
                        </div>
                      </div>
                    </div>

                    <div className="flex w-[40%] items-center justify-end gap-4 text-right">
                      <p className="truncate text-[38px] font-black uppercase tracking-[0.03em] text-white">{awayTeam}</p>
                      {awayLogo ? <img src={awayLogo} alt={awayTeam} className="h-14 w-14 object-contain" /> : <div className="h-14 w-14 rounded-full bg-white/20" />}
                    </div>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-8 px-8 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        {Array.from({ length: 5 }).map((_, index) => renderPenaltyAttempt(homePenaltyShootout[index], `home-pen-${index}`))}
                      </div>
                      <div className="mt-2 grid grid-cols-5 gap-2">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <p key={`home-penalty-name-${index}`} className="truncate text-center text-[11px] font-black uppercase tracking-[0.02em] text-white/88">
                            {homePenaltyShootout[index]?.player || "-"}
                          </p>
                        ))}
                      </div>
                    </div>

                    <p className="pt-1 text-[36px] font-black uppercase tracking-[0.08em] text-white">Kierros {penaltyRound}</p>

                    <div className="min-w-0">
                      <div className="flex items-center justify-end gap-3">
                        {Array.from({ length: 5 }).map((_, index) => renderPenaltyAttempt(awayPenaltyShootout[index], `away-pen-${index}`))}
                      </div>
                      <div className="mt-2 grid grid-cols-5 gap-2">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <p key={`away-penalty-name-${index}`} className="truncate text-center text-[11px] font-black uppercase tracking-[0.02em] text-white/88">
                            {awayPenaltyShootout[index]?.player || "-"}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : isRecapBoard ? (
              <div className="absolute bottom-8 left-1/2 w-[min(1660px,calc(100vw-3rem))] -translate-x-1/2">
                <div className="mb-3 flex justify-center">
                  <div
                    className="rounded-t-[160px] border px-20 py-2 text-center text-[34px] font-black uppercase tracking-[0.12em] shadow-xl"
                    style={{ borderColor: streamPalette.line, background: "rgba(10,107,114,0.95)", color: streamPalette.text }}
                  >
                    {recapBoardLabel}
                  </div>
                </div>
                <div
                  className="overflow-hidden border shadow-2xl"
                  style={{
                    borderColor: "rgba(191,255,246,0.22)",
                    background: "linear-gradient(180deg, rgba(17,92,97,0.96) 0%, rgba(8,69,74,0.98) 100%)",
                    boxShadow: "0 18px 44px rgba(0,0,0,0.42)",
                  }}
                >
                  <div className="flex h-[76px] items-center border-b px-6" style={{ borderColor: "rgba(191,255,246,0.16)" }}>
                    <div className="flex w-[40%] items-center gap-4">
                      {homeLogo ? <img src={homeLogo} alt={homeTeam} className="h-14 w-14 object-contain" /> : <div className="h-14 w-14 rounded-full bg-white/20" />}
                      <p className="truncate text-[38px] font-black uppercase tracking-[0.03em] text-white">{homeTeam}</p>
                    </div>

                    <div className="flex w-[20%] justify-center">
                      <div className="flex h-[62px] w-[176px] items-center justify-center rounded-[24px] border text-[56px] font-black leading-none text-[#0b4e54] shadow-lg" style={{ borderColor: "rgba(10,96,102,0.22)", background: "linear-gradient(180deg, #ebfffb 0%, #c9f4ec 100%)" }}>
                        {homeScore} - {awayScore}
                      </div>
                    </div>

                    <div className="flex w-[40%] items-center justify-end gap-4 text-right">
                      <p className="truncate text-[38px] font-black uppercase tracking-[0.03em] text-white">{awayTeam}</p>
                      {awayLogo ? <img src={awayLogo} alt={awayTeam} className="h-14 w-14 object-contain" /> : <div className="h-14 w-14 rounded-full bg-white/20" />}
                    </div>
                  </div>

                  <div className={`flex min-h-[52px] items-center border-b px-6 py-2 ${isMatchEndedRecap ? "justify-center" : ""}`} style={{ borderColor: "rgba(191,255,246,0.14)" }}>
                    <p className={`text-[18px] font-black uppercase tracking-[0.02em] text-white ${isMatchEndedRecap ? "w-full text-center" : ""}`}>{recapInfoLine}</p>
                  </div>

                  <div className="px-6 py-2.5">
                    <p className="text-[13px] font-black uppercase tracking-[0.18em]" style={{ color: "#d8fff9" }}>Maalintekijat</p>
                    <div className="mt-1 grid grid-cols-2 gap-8">
                      <div>
                        <p className="text-[18px] font-black uppercase text-white">{homeTeam}</p>
                        {homeScorerLines.length > 0 ? (
                          homeScorerLines.map((line, index) => (
                            <p key={`about-home-scorer-${index}`} className="text-[17px] font-black uppercase leading-tight text-white/92">
                              {line}
                            </p>
                          ))
                        ) : (
                          <p className="text-[17px] font-black uppercase leading-tight text-white/55">-</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[18px] font-black uppercase text-white">{awayTeam}</p>
                        {awayScorerLines.length > 0 ? (
                          awayScorerLines.map((line, index) => (
                            <p key={`about-away-scorer-${index}`} className="text-[17px] font-black uppercase leading-tight text-white/92">
                              {line}
                            </p>
                          ))
                        ) : (
                          <p className="text-[17px] font-black uppercase leading-tight text-white/55">-</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="absolute bottom-8 left-1/2 w-[calc(100vw-2rem)] max-w-[1220px] -translate-x-1/2">
                  <div className="w-full rounded-t-[160px] border py-2 text-center text-[34px] font-black uppercase tracking-[0.12em] shadow-xl" style={{ borderColor: streamPalette.line, background: "rgba(10,107,114,0.95)", color: streamPalette.text }}>
                    {period}. jakso
                  </div>

                  <div className="mt-2 flex h-[66px] w-full items-center border px-6 shadow-2xl" style={{ borderColor: streamPalette.line, background: "linear-gradient(to right, #0d8f96 0%, #0a6b72 50%, #0d8f96 100%)" }}>
                    <div className="flex w-[44%] items-center gap-3">
                      {homeLogo ? (
                        <img src={homeLogo} alt={homeTeam} className="h-14 w-14 object-contain" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full text-2xl font-black" style={{ background: "rgba(255,255,255,0.2)", color: streamPalette.text }}>{homeTeam.slice(0, 1)}</div>
                      )}
                      <p className="text-[36px] font-black uppercase tracking-[0.03em]" style={{ color: streamPalette.text }}>{homeTeam}</p>
                    </div>

                    <div className="flex w-[12%] justify-center">
                      <div className="flex h-[68px] w-[170px] items-center justify-center rounded-full border text-[52px] font-black text-[#02363a] shadow-lg" style={{ borderColor: "rgba(7,72,77,0.28)", background: streamPalette.scoreBg }}>
                        {homeScore} - {awayScore}
                      </div>
                    </div>

                    <div className="flex w-[44%] items-center justify-end gap-3 text-right">
                      <p className="text-[36px] font-black uppercase tracking-[0.03em]" style={{ color: streamPalette.text }}>{awayTeam}</p>
                      {awayLogo ? (
                        <img src={awayLogo} alt={awayTeam} className="h-14 w-14 object-contain" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full text-2xl font-black" style={{ background: "rgba(255,255,255,0.2)", color: streamPalette.text }}>{awayTeam.slice(0, 1)}</div>
                      )}
                    </div>
                  </div>

                  <p className="mt-4 text-center text-2xl font-bold uppercase tracking-[0.24em]" style={{ color: streamPalette.textDim }}>{aboutToStartText}</p>
                </div>

              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {graphicsReady && showHalftimeStats && (
          <motion.div
            key="halftime-stats"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 z-[34] flex items-center justify-center"
          >
            <div className="w-[1240px] border text-white shadow-2xl backdrop-blur-sm" style={{ borderColor: streamPalette.line, background: "rgba(3,56,61,0.72)", color: streamPalette.text }}>
              <div className="border-b py-3 text-center" style={{ borderColor: streamPalette.line, background: "rgba(10,107,114,0.95)" }}>
                <p className="text-4xl font-black uppercase tracking-[0.06em]">Ottelu Tilastot</p>
                <p className="text-lg font-semibold uppercase tracking-[0.2em]" style={{ color: "rgba(236,255,253,0.74)" }}>{halftimeDisplayLabel}</p>
                <p className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: "rgba(236,255,253,0.84)" }}>{halftimeTitleText}</p>
              </div>

              <div className="flex items-center border-b px-4 py-2" style={{ borderColor: streamPalette.line, background: "linear-gradient(to right, #0d8f96 0%, #0a6b72 50%, #0d8f96 100%)" }}>
                <div className="flex w-[40%] items-center gap-3">
                  {homeLogo ? <img src={homeLogo} alt={homeTeam} className="h-12 w-12 object-contain" /> : null}
                  <p className="text-4xl font-black uppercase">{homeTeam}</p>
                </div>

                <div className="flex w-[20%] justify-center">
                  <div className="rounded-full border px-8 py-1 text-5xl font-black text-[#02363a]" style={{ borderColor: "rgba(7,72,77,0.28)", background: streamPalette.scoreBg }}>
                    {homeScore} - {awayScore}
                  </div>
                </div>

                <div className="flex w-[40%] items-center justify-end gap-3">
                  <p className="text-4xl font-black uppercase">{awayTeam}</p>
                  {awayLogo ? <img src={awayLogo} alt={awayTeam} className="h-12 w-12 object-contain" /> : null}
                </div>
              </div>

              <div className="px-4 py-2" style={{ background: "rgba(3,56,61,0.66)" }}>
                {(halftimeStatRows.length > 0 ? halftimeStatRows : [
                  { key: "goals", label: "Maalit", home: String(homeScore), away: String(awayScore) },
                ]).map((row) => (
                  <div key={`ht-row-${row.key}`} className="grid grid-cols-[120px_1fr_120px] items-center border-b py-1" style={{ borderColor: streamPalette.line }}>
                    <p className="text-center text-5xl font-black" style={{ color: streamPalette.text }}>{row.home}</p>
                    <p className="text-center text-4xl font-black uppercase tracking-[0.04em]" style={{ color: "rgba(236,255,253,0.94)" }}>{row.label}</p>
                    <p className="text-center text-5xl font-black" style={{ color: streamPalette.text }}>{row.away}</p>
                  </div>
                ))}
              </div>

              <div className="h-8" style={{ background: "rgba(13,143,150,0.5)" }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── GOAL ── */}
      <AnimatePresence>
        {graphicsReady && showGoal && (
          <motion.div
            key="goal"
            initial={{ y: -160, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -160, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            style={{ background: s.goalBg }}
            className="absolute top-0 left-0 right-0 flex flex-col items-center py-8 shadow-2xl"
          >
            <p style={{ color: s.goalAccentColor, fontSize: 13, letterSpacing: "0.25em", fontWeight: 700 }}>
              MAALI
            </p>
            <p style={{ color: s.goalTextColor, fontSize: 36, fontWeight: 900, lineHeight: 1.1 }}>
              {goalText}
            </p>
            <p style={{ color: s.goalAccentColor, fontSize: 13, marginTop: 6 }}>
              {homeTeam}  {homeScore} – {awayScore}  {awayTeam}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PENALTY / EVENT ── */}
      <AnimatePresence>
        {graphicsReady && showPenalty && !showAboutToStart && (
          <motion.div
            key="penalty"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            style={{ background: s.penaltyBg, color: s.penaltyTextColor }}
            className="absolute top-8 right-0 px-10 py-5 shadow-2xl font-bold text-xl"
          >
            {penaltyText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LOWER THIRD ── */}
      <AnimatePresence>
        {graphicsReady && showLowerThird && (
          <motion.div
            key="lower"
            initial={{ x: -520 }}
            animate={{ x: 0 }}
            exit={{ x: -520 }}
            transition={{ type: "spring", stiffness: 200, damping: 28 }}
            style={{
              background: s.lowerBg,
              borderLeft: s.lowerLeftBorder,
              color: s.lowerTextColor,
            }}
            className="absolute bottom-32 left-0 px-8 py-5 min-w-[320px] shadow-2xl"
          >
            <p style={{ color: s.lowerAccentColor, fontSize: 11, letterSpacing: "0.2em", fontWeight: 700 }}>
              INFO
            </p>
            <p style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{lowerThird}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LINEUP ── */}
      <AnimatePresence>
        {graphicsReady && showLineup && (
          <motion.div
            key="lineup"
            initial={{ scale: 0.88, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.88, opacity: 0 }}
            transition={{ duration: 0.35 }}
            style={{ background: s.lineupBg }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div style={{
              border: `1px solid ${s.dividerColor}`,
              minWidth: 420,
              maxWidth: 600,
              borderRadius: 8,
              overflow: "hidden",
            }}>
              <div style={{ background: s.lineupAccentColor, padding: "12px 28px" }}>
                <p style={{ color: s.lineupBg, fontWeight: 800, fontSize: 13, letterSpacing: "0.2em" }}>
                  AVAUSKOKOONPANO
                </p>
              </div>
              <div style={{ padding: "24px 28px", color: s.lineupTextColor }}>
                <p style={{ whiteSpace: "pre-line", fontSize: 17, lineHeight: 1.75 }}>{lineup}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FULLSCREEN ── */}
      <AnimatePresence>
        {graphicsReady && showFullscreen && (
          <motion.div
            key="fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: s.fullscreenBg }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          >
            <p style={{ color: s.fullscreenAccentColor, fontSize: 13, letterSpacing: "0.3em", fontWeight: 700 }}>
              LIVE
            </p>
            <p style={{ color: s.fullscreenTextColor, fontSize: 52, fontWeight: 900, textAlign: "center", maxWidth: "70%" }}>
              {fullscreenText}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SCOREBUG + CLOCK BOARD ── */}
      {graphicsReady && scene === "scorebug" && showGameClock && (
        <div className="absolute left-6 top-6 z-30 w-[360px]">
          {/* Period label */}
          <div className="w-20 rounded-t-md py-0.5 text-center text-xs font-black uppercase tracking-[0.12em] text-white shadow-md" style={{ background: "rgba(10,107,114,0.95)" }}>
            {periodLabel}
          </div>

          {/* Main scorebug bar */}
          <div className="mt-0.5 flex h-11 items-center overflow-visible border shadow-xl" style={{ borderColor: streamPalette.line, background: "linear-gradient(to right, #0d8f96 0%, #0a6b72 50%, #0d8f96 100%)" }}>
            {/* Clock */}
            <div className="flex h-full w-[84px] shrink-0 items-center justify-center text-xl font-black tabular-nums" style={{ background: streamPalette.deep, color: streamPalette.text }}>
              {displayMainClock}
            </div>

            {/* Home */}
            <div
              className="flex min-w-0 flex-1 items-center gap-1.5 px-2"
              style={{ background: `linear-gradient(to right, ${homeKitColor}55, ${homeKitColor}11)` }}
            >
              {homeLogo
                ? <img src={homeLogo} alt={homeTeam} className="h-6 w-6 shrink-0 object-contain" />
                : <div className="h-6 w-6 shrink-0 rounded-full bg-white/20" />
              }
              <p className="truncate text-sm font-black uppercase tracking-wide text-white">{homeTeam}</p>
              {redCardCounts.home > 0 && (
                <span className="shrink-0 rounded-sm bg-[#d93a42] px-1 text-xs font-black text-white">{redCardCounts.home}</span>
              )}
            </div>

            {/* Score */}
            <div className="relative flex h-[52px] w-[72px] shrink-0 -translate-y-0.5 items-center justify-center rounded-b-[30px] rounded-t-[10px] border text-2xl font-black text-[#02363a] shadow-md" style={{ borderColor: "rgba(7,72,77,0.28)", background: streamPalette.scoreBg }}>
              <span>{homeScore}</span>
              <span className="mx-1.5 text-lg">-</span>
              <span>{awayScore}</span>
            </div>

            {/* Away */}
            <div
              className="flex min-w-0 flex-1 items-center justify-end gap-1.5 px-2"
              style={{ background: `linear-gradient(to left, ${awayKitColor}55, ${awayKitColor}11)` }}
            >
              {redCardCounts.away > 0 && (
                <span className="shrink-0 rounded-sm bg-[#d93a42] px-1 text-xs font-black text-white">{redCardCounts.away}</span>
              )}
              <p className="truncate text-right text-sm font-black uppercase tracking-wide text-white">{awayTeam}</p>
              {awayLogo
                ? <img src={awayLogo} alt={awayTeam} className="h-6 w-6 shrink-0 object-contain" />
                : <div className="h-6 w-6 shrink-0 rounded-full bg-white/20" />
              }
            </div>
          </div>

          {/* Added time */}
          {showAddedTimeClock ? (
            <div className="mt-0.5 w-32 rounded-sm py-0.5 text-center text-base font-black tabular-nums text-[#02363a] shadow-md" style={{ background: "linear-gradient(to right, #72e6d2 0%, #c0fff4 50%, #72e6d2 100%)" }}>
              {displayAddedClock}
            </div>
          ) : null}
        </div>
      )}

      {/* ── LINEUP PANEL (lineup mode only) ── */}
      {graphicsReady && visibleRosterPanel?.visible && visibleRosterPanel.mode === "lineup" && (
        <div className="absolute bottom-6 left-6 z-30 w-[560px] overflow-hidden rounded-2xl p-4 shadow-2xl" style={{ background: "rgba(3,56,61,0.82)", color: streamPalette.text }}>
          <div className="rounded-xl px-4 py-3" style={{ background: "rgba(10,107,114,0.8)" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: isHomeRosterPanel ? "#7ef6e4" : "#8ae9ff" }}>
                  {isHomeRosterPanel ? "Kotijoukkue" : "Vierasjoukkue"}
                </p>
                <p className="mt-1 text-lg font-bold">{visibleRosterPanel.teamName}</p>
              </div>
              {visibleRosterLogo ? (
                <img src={visibleRosterLogo} alt={visibleRosterPanel.teamName} className="h-14 w-14 rounded-full object-contain" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-black" style={{ background: "rgba(255,255,255,0.2)", color: streamPalette.text }}>
                  {visibleRosterPanel.teamName.slice(0, 1) || "?"}
                </div>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(236,255,253,0.75)" }}>Avauskokoonpano</p>
          <div className="mt-1 space-y-1">
            {visibleRosterPanel.starting.length === 0 ? (
              <p className="text-sm" style={{ color: "rgba(236,255,253,0.75)" }}>Ei avauskokoonpanoa.</p>
            ) : (
              visibleRosterPanel.starting.map((player, index) => (
                <p key={`ov-center-start-${index}`} className="text-sm">{index + 1}. {player}</p>
              ))
            )}
          </div>
          <p className="mt-3 inline-block rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide" style={{ background: "rgba(3,56,61,0.76)", color: "rgba(236,255,253,0.86)" }}>Vaihtopelaajat</p>
          <div className="mt-1 space-y-1">
            {visibleRosterPanel.bench.length === 0 ? (
              <p className="text-sm" style={{ color: "rgba(236,255,253,0.75)" }}>Ei vaihtopelaajia.</p>
            ) : (
              visibleRosterPanel.bench.map((player, index) => (
                <p key={`ov-center-bench-${index}`} className="rounded-md px-2 py-1 text-sm" style={{ background: "rgba(3,56,61,0.76)", color: "rgba(236,255,253,0.9)" }}>{player}</p>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── FORMATION PITCH VIEW (rotation mode) ── */}
      {graphicsReady && visibleRosterPanel?.visible && visibleRosterPanel.mode === "rotation" && visibleRosterPanel.rows.length > 0 && (() => {
        const kitColor = isHomeRosterPanel ? homeKitColor : awayKitColor;
        const slots = getRotationVisualRows(visibleRosterPanel);
        const orderedSlots = [...slots].sort((a, b) => {
          const aTop = 100 - a.top;
          const bTop = 100 - b.top;
          return aTop - bTop;
        });
        return (
          <div className="absolute inset-0 z-30 flex items-start justify-center pt-20">
            <div className="flex h-[68%] w-[86%] flex-col overflow-hidden border border-white/20 bg-[#066d73]/95 shadow-2xl">
              {/* Header bar */}
              <div className="flex h-[56px] shrink-0 items-center gap-3 border-b border-white/20 px-4" style={{ background: "rgba(0,0,0,0.42)" }}>
                {visibleRosterLogo
                  ? <img src={visibleRosterLogo} alt={visibleRosterPanel.teamName} className="h-10 w-10 object-contain drop-shadow" />
                  : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-lg font-black text-white">{visibleRosterPanel.teamName.slice(0,1)}</div>
                }
                <p className="text-[26px] font-black uppercase tracking-[0.03em] text-white">{visibleRosterPanel.teamName}</p>
                <div className="ml-2 h-7 w-px bg-white/35" />
                <p className="text-[22px] font-black uppercase tracking-[0.06em] text-white">FORMATION <span className="ml-2">{visibleRosterPanel.formation}</span></p>
              </div>

              <div className="flex h-[24px] items-center border-b border-white/20 bg-[#0d8f96] px-4">
                <p className="text-[12px] font-semibold tracking-wide text-white/95">{venue || "Stadium"}</p>
              </div>

              <div className="grid flex-1 grid-cols-[220px_1fr_200px]">
                {/* Starting XI list */}
                <div className="border-r border-white/20 bg-black/20 px-4 py-4">
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/80">Avauskokoonpano</p>
                  <div className="space-y-1.5">
                    {orderedSlots.map((slot) => {
                      const num = getPlayerNumber(slot.player);
                      const lastName = getPlayerLastName(slot.player).toUpperCase();
                      return (
                        <p key={`starter-list-${slot.key}`} className="text-[18px] font-black uppercase leading-tight text-white">
                          {num ? `${num} ` : ""}{lastName}
                        </p>
                      );
                    })}
                  </div>
                </div>

                {/* Pitch */}
                <div className="relative overflow-hidden">
                  {/* Pitch outline & lines */}
                  <div className="pointer-events-none absolute inset-x-9 inset-y-4 border-2 border-white/40">
                    <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-px bg-white/40" />
                    <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" width="130" height="130" viewBox="0 0 130 130">
                      <circle cx="65" cy="65" r="58" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
                    </svg>
                    <div className="absolute top-0 left-1/2 h-[22%] w-[44%] -translate-x-1/2 border-2 border-t-0 border-white/40" />
                    <div className="absolute top-0 left-1/2 h-[9%] w-[18%] -translate-x-1/2 border-2 border-t-0 border-white/40" />
                    <div className="absolute bottom-0 left-1/2 h-[22%] w-[44%] -translate-x-1/2 border-2 border-b-0 border-white/40" />
                    <div className="absolute bottom-0 left-1/2 h-[9%] w-[18%] -translate-x-1/2 border-2 border-b-0 border-white/40" />
                  </div>

                  {/* Player tokens */}
                  {slots.map((slot) => {
                    const num = getPlayerNumber(slot.player);
                    const lastName = getPlayerLastName(slot.player).toUpperCase();
                    const displayTop = 100 - slot.top;
                    const playerPhoto = getRotationPlayerPhoto(visibleRosterPanel, slot.player);
                    return (
                      <div
                        key={`pitch-slot-${slot.key}`}
                        className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                        style={{ left: `${slot.left}%`, top: `${displayTop}%` }}
                      >
                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white/60 bg-[#0d3f42] shadow-lg">
                          {playerPhoto
                            ? <img src={playerPhoto} alt={slot.player} className="h-full w-full object-cover" />
                            : <div className="text-lg font-black text-white">{num || "?"}</div>
                          }
                        </div>
                        <p className="mt-0.5 text-[12px] font-black leading-none text-white drop-shadow">{num ? `${num}.` : ""} {lastName}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Bench list */}
                <div className="border-l border-white/20 bg-black/20 px-4 py-4">
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/80">Vaihtopelaajat</p>
                  <div className="space-y-1.5">
                    {visibleRosterPanel.bench.length === 0 ? (
                      <p className="text-sm text-white/70">Ei vaihtopelaajia.</p>
                    ) : (
                      visibleRosterPanel.bench.map((player, index) => {
                        const num = getPlayerNumber(player);
                        const lastName = getPlayerLastName(player).toUpperCase();
                        return (
                          <p key={`bench-list-${index}`} className="text-[16px] font-black uppercase leading-tight text-white">
                            {num ? `${num} ` : ""}{lastName}
                          </p>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── LEAGUE LOGO ── */}
      {leagueLogo && (
        <div className="absolute top-4 left-4">
          <img src={leagueLogo} alt="" className="h-10 object-contain" />
        </div>
      )}

      {/* ── SPONSOR LOGO ── */}
      {sponsorLogo && (
        <div className="absolute top-4 right-4">
          <img src={sponsorLogo} alt="" className="h-10 object-contain" />
        </div>
      )}

      {/* ⚽ GOAL SCORER LOWER-THIRD — bottom-left */}
      <AnimatePresence>
        {graphicsReady && showGoalScorer && goalScorerInfo && (() => {
          const playerPhoto = playerPhotoByTeamAndName[
            `${goalScorerInfo.teamName.toLowerCase()}|${normalizePlayerName(goalScorerInfo.scorer)}`
          ] || "";
          return (
            <motion.div
              key="goal-scorer"
              initial={{ x: -600, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -600, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="absolute bottom-8 left-8 z-40 overflow-hidden"
              style={{
                background: "linear-gradient(100deg, #06484d 0%, #0a6b72 60%, #08575d 100%)",
                borderRadius: 12,
                minWidth: 520,
                boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
              }}
            >
              {/* TOP ribbon */}
              <div className="flex h-9 items-center justify-between border-b px-3" style={{ background: "linear-gradient(90deg, #7bf6e6 0%, #26d3be 45%, #0fa192 100%)", borderColor: "rgba(0,0,0,0.24)" }}>
                <span style={{ color: "#043a3f", fontSize: 14, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Goal Scorer
                </span>
                <span style={{ color: "#043a3f", fontSize: 13, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {goalScorerInfo.minute}&apos; | {goalHalfLabel}
                </span>
              </div>

              <div className="flex items-stretch">
                {/* Team logo */}
                <div className="flex flex-shrink-0 items-center justify-center px-5" style={{ background: "rgba(3,56,61,0.45)" }}>
                  {goalScorerInfo.teamLogo
                    ? <img src={goalScorerInfo.teamLogo} alt={goalScorerInfo.teamName} className="h-14 w-14 object-contain" />
                    : <div className="h-14 w-14 rounded-full bg-gray-700" />}
                </div>

                {/* Text */}
                <div className="flex flex-1 flex-col justify-center gap-[3px] py-3 pl-4 pr-3">
                  <div
                    className="inline-flex w-fit items-center gap-1 rounded px-2 py-[2px]"
                    style={{ background: "rgba(3,56,61,0.82)" }}
                  >
                    <span style={{ color: "#78f4e0", fontSize: 11, fontWeight: 800, letterSpacing: "0.14em" }}>
                      GOAL
                    </span>
                  </div>
                  <p
                    className="leading-tight"
                    style={{ color: "#ecfffd", fontSize: 22, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase" }}
                  >
                    {goalScorerInfo.scorer}
                  </p>
                </div>

                {/* Player photo */}
                <div className="flex flex-shrink-0 items-center justify-center pr-4">
                  {playerPhoto
                    ? <img src={playerPhoto} alt={goalScorerInfo.scorer} className="h-16 w-16 rounded-full object-cover" style={{ border: "2px solid rgba(255,255,255,0.18)" }} />
                    : <div className="flex h-16 w-16 items-center justify-center rounded-full text-3xl" style={{ background: "rgba(255,255,255,0.08)" }}>⚽</div>}
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {graphicsReady && showGoalRecap && !showGoalScorer && goalRecapInfo && (() => {
          const minuteNumber = Number.parseInt((goalRecapInfo.minute || "").split(":")[0] || "0", 10);
          const minuteLabel = Number.isFinite(minuteNumber) ? `${Math.max(0, minuteNumber)}'` : goalRecapInfo.minute;
          const scorerLabel = goalRecapInfo.scorer ? goalRecapInfo.scorer.toUpperCase() : "MAALINTEKIJA";
          const scorerOnAway = goalRecapInfo.side === "away";
          const formatScorerMinute = (minuteValue: string) => {
            const parsedMinute = Number.parseInt((minuteValue || "").split(":")[0] || "0", 10);
            return Number.isFinite(parsedMinute) ? `${Math.max(0, parsedMinute)}'` : minuteValue;
          };
          const buildScorerLines = (side: "home" | "away") => {
            const grouped = new Map<string, { name: string; minutes: string[] }>();
            goalScorerHistory
              .filter((entry) => entry.side === side)
              .forEach((entry) => {
                const key = normalizePlayerName(entry.scorer || "") || (entry.scorer || "").trim().toLowerCase();
                const minuteText = formatScorerMinute(entry.minute);
                const existing = grouped.get(key);
                if (existing) {
                  existing.minutes.push(minuteText);
                  return;
                }
                grouped.set(key, {
                  name: (entry.scorer || "MAALINTEKIJA").toUpperCase(),
                  minutes: [minuteText],
                });
              });
            return Array.from(grouped.values()).map((player) => `${player.name} ${player.minutes.join(", ")}`);
          };
          const homeScorerLines = buildScorerLines("home");
          const awayScorerLines = buildScorerLines("away");
          return (
            <motion.div
              key="goal-recap"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 14 }}
              transition={{ duration: 0.28 }}
              className="absolute bottom-6 left-1/2 z-[38] w-[1020px] -translate-x-1/2 overflow-hidden border shadow-2xl"
              style={{
                borderColor: streamPalette.line,
                background: "linear-gradient(180deg, rgba(5,54,59,0.96) 0%, rgba(4,44,48,0.92) 100%)",
                boxShadow: "0 12px 44px rgba(0,0,0,0.6)",
              }}
            >
              <div className="flex h-[66px] items-center border-b px-4" style={{ borderColor: streamPalette.line, background: "linear-gradient(to right, rgba(13,143,150,0.36) 0%, rgba(10,107,114,0.2) 50%, rgba(13,143,150,0.36) 100%)" }}>
                <div className="flex w-[40%] items-center gap-3">
                  {homeLogo
                    ? <img src={homeLogo} alt={homeTeam} className="h-12 w-12 object-contain" />
                    : <div className="h-12 w-12 rounded-full bg-white/20" />
                  }
                  <p className="truncate text-[31px] font-black uppercase tracking-[0.03em]" style={{ color: streamPalette.text }}>{homeTeam}</p>
                </div>

                <div className="flex w-[20%] justify-center">
                  <div className="flex h-[58px] w-[172px] items-center justify-center rounded-t-[32px] rounded-b-[18px] text-[50px] font-black leading-none text-[#04373c]" style={{ background: "linear-gradient(180deg, #f2fffd 0%, #c7f5ed 100%)", border: "1px solid rgba(7,72,77,0.32)" }}>
                    {homeScore} - {awayScore}
                  </div>
                </div>

                <div className="flex w-[40%] items-center justify-end gap-3">
                  <p className="truncate text-right text-[31px] font-black uppercase tracking-[0.03em]" style={{ color: streamPalette.text }}>{awayTeam}</p>
                  {awayLogo
                    ? <img src={awayLogo} alt={awayTeam} className="h-12 w-12 object-contain" />
                    : <div className="h-12 w-12 rounded-full bg-white/20" />
                  }
                </div>
              </div>

              <div className="flex h-[34px] items-center px-5" style={{ background: "linear-gradient(90deg, rgba(3,56,61,0.9) 0%, rgba(6,72,77,0.84) 50%, rgba(3,56,61,0.9) 100%)" }}>
                <p
                  className={`text-[29px] font-black uppercase leading-none ${scorerOnAway ? "ml-auto text-right" : ""}`}
                  style={{ letterSpacing: "0.02em" }}
                >
                  <span style={{ color: streamPalette.text }}>{scorerLabel}</span>
                  <span className="ml-2" style={{ color: streamPalette.accentBright }}>{minuteLabel}</span>
                </p>
              </div>

              <div className="border-t px-5 py-2" style={{ borderColor: streamPalette.line, background: "rgba(3,56,61,0.8)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: streamPalette.accentBright }}>
                  Maalintekijat
                </p>
                <div className="mt-1 grid grid-cols-2 gap-5">
                  <div>
                    <p className="text-[13px] font-bold uppercase leading-tight" style={{ color: streamPalette.text }}>
                      {homeTeam}
                    </p>
                    <div className="mt-0.5 space-y-0.5">
                      {homeScorerLines.length > 0 ? (
                        homeScorerLines.map((line, idx) => (
                          <p key={`home-goal-line-${idx}`} className="text-[13px] font-semibold uppercase leading-tight" style={{ color: "rgba(236,255,253,0.86)" }}>
                            {line}
                          </p>
                        ))
                      ) : (
                        <p className="text-[13px] font-semibold uppercase leading-tight" style={{ color: "rgba(236,255,253,0.64)" }}>
                          -
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[13px] font-bold uppercase leading-tight" style={{ color: streamPalette.text }}>
                      {awayTeam}
                    </p>
                    <div className="mt-0.5 space-y-0.5">
                      {awayScorerLines.length > 0 ? (
                        awayScorerLines.map((line, idx) => (
                          <p key={`away-goal-line-${idx}`} className="text-[13px] font-semibold uppercase leading-tight" style={{ color: "rgba(236,255,253,0.86)" }}>
                            {line}
                          </p>
                        ))
                      ) : (
                        <p className="text-[13px] font-semibold uppercase leading-tight" style={{ color: "rgba(236,255,253,0.64)" }}>
                          -
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* CARD PLAYER LOWER-THIRD — bottom-left */}
      <AnimatePresence>
        {graphicsReady && showCardScorer && cardScorerInfo && (() => {
          const playerPhoto = playerPhotoByTeamAndName[
            `${cardScorerInfo.teamName.toLowerCase()}|${normalizePlayerName(cardScorerInfo.player)}`
          ] || "";
          const minuteNumber = Number.parseInt((cardScorerInfo.minute || "").split(":")[0] || "0", 10);
          const minuteLabel = Number.isFinite(minuteNumber) ? `${Math.max(0, minuteNumber)}'` : "";
          const isRedCard = cardScorerInfo.cardType === "red";
          const titleColor = isRedCard ? "#ff9d9d" : "#f7d95a";
          const titleText = isRedCard ? "RED CARD" : "YELLOW CARD";

          return (
            <motion.div
              key={`card-scorer-${cardScorerInfo.cardType}`}
              initial={{ x: -600, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -600, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="absolute bottom-8 left-8 z-40 flex items-stretch overflow-hidden"
              style={{
                background: "linear-gradient(100deg, #06484d 0%, #0a6b72 60%, #08575d 100%)",
                borderRadius: 12,
                minWidth: 460,
                boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
              }}
            >
              <div className="flex flex-shrink-0 items-center justify-center px-5" style={{ background: "rgba(3,56,61,0.45)" }}>
                {cardScorerInfo.teamLogo
                  ? <img src={cardScorerInfo.teamLogo} alt={cardScorerInfo.teamName} className="h-14 w-14 object-contain" />
                  : <div className="h-14 w-14 rounded-full bg-gray-700" />}
              </div>

              <div className="flex flex-1 flex-col justify-center gap-[3px] py-3 pl-4 pr-3">
                <div className="inline-flex w-fit items-center gap-1 rounded px-2 py-[2px]" style={{ background: "rgba(3,56,61,0.82)" }}>
                  <span style={{ color: titleColor, fontSize: 11, fontWeight: 800, letterSpacing: "0.14em" }}>
                    {minuteLabel} {titleText}
                  </span>
                </div>
                <p
                  className="leading-tight"
                  style={{ color: "#ecfffd", fontSize: 22, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase" }}
                >
                  {cardScorerInfo.player}
                </p>
              </div>

              <div className="flex flex-shrink-0 items-center justify-center pr-4">
                {playerPhoto
                  ? <img src={playerPhoto} alt={cardScorerInfo.player} className="h-16 w-16 rounded-full object-cover" style={{ border: "2px solid rgba(255,255,255,0.18)" }} />
                  : <div className="flex h-16 w-16 items-center justify-center rounded-full text-3xl" style={{ background: "rgba(255,255,255,0.08)" }}>{isRedCard ? "🟥" : "🟨"}</div>}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* SUBSTITUTION CARD — bottom-left */}
      <AnimatePresence>
        {graphicsReady && showSubstitutionCard && substitutionCardInfo && (() => {
          const minuteNumber = Number.parseInt((substitutionCardInfo.minute || "").split(":")[0] || "0", 10);
          const minuteLabel = Number.isFinite(minuteNumber) ? `${Math.max(0, minuteNumber)}'` : "";
          return (
            <motion.div
              key="substitution-card"
              initial={{ x: -700, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -700, opacity: 0 }}
              transition={{ type: "spring", stiffness: 250, damping: 26 }}
              className="absolute bottom-8 left-8 z-40"
            >
              <div className="relative min-w-[760px]">
                <div
                  className="mb-1 ml-14 w-[360px] rounded px-4 py-1 text-center"
                  style={{ background: "linear-gradient(90deg, rgba(3,56,61,0.35) 0%, rgba(10,107,114,0.95) 50%, rgba(3,56,61,0.35) 100%)" }}
                >
                  <span style={{ color: "#ecfffd", fontSize: 28, fontWeight: 900, letterSpacing: "0.03em", textTransform: "uppercase" }}>
                    SUBSTITUTION {minuteLabel}
                  </span>
                </div>

                <div className="absolute left-0 top-8 z-10 flex h-20 w-20 items-center justify-center">
                  {substitutionCardInfo.teamLogo
                    ? <img src={substitutionCardInfo.teamLogo} alt={substitutionCardInfo.teamName} className="h-16 w-16 object-contain" />
                    : <div className="h-16 w-16 rounded-full bg-gray-700" />}
                </div>

                <div className="ml-14 space-y-1">
                  {substitutionCardInfo.pairs.slice(0, 5).map((pair, index) => (
                    <div key={`sub-card-row-${index}`} className="grid grid-cols-[1fr_1fr] gap-1">
                      <div
                        className="flex h-12 items-center justify-between pl-5 pr-2"
                        style={{ background: "linear-gradient(90deg, rgba(6,72,77,0.95) 0%, rgba(13,143,150,0.95) 68%, rgba(6,72,77,0.92) 100%)" }}
                      >
                        <span style={{ color: "#ffffff", fontSize: 34, fontWeight: 900, letterSpacing: "0.02em", textTransform: "uppercase" }}>
                          {pair.outPlayer}
                        </span>
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          style={{ background: "#e53935", color: "#ffffff", fontSize: 18, fontWeight: 900 }}
                        >
                          ▼
                        </span>
                      </div>

                      <div
                        className="flex h-12 items-center justify-between pl-5 pr-2"
                        style={{ background: "linear-gradient(90deg, rgba(6,72,77,0.95) 0%, rgba(13,143,150,0.95) 68%, rgba(6,72,77,0.92) 100%)" }}
                      >
                        <span style={{ color: "#ffffff", fontSize: 34, fontWeight: 900, letterSpacing: "0.02em", textTransform: "uppercase" }}>
                          {pair.inPlayer}
                        </span>
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          style={{ background: "#2ebf5f", color: "#ffffff", fontSize: 18, fontWeight: 900 }}
                        >
                          ▲
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
      </div>
    </div>
  );
}

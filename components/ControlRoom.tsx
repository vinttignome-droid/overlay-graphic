"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Sidebar from "@/components/Sidebar";
import { motion } from "framer-motion";
import { relayPublish } from "@/lib/realtimeRelay";
import { isServerSyncDone, SYNC_DONE_EVENT } from "@/lib/serverSyncSignal";

interface ControlRoomProps {
  sport: string;
  onLogout?: () => void;
}

export default function ControlRoom({ sport, onLogout }: ControlRoomProps) {
  // Storage avaimet heti funktion alkuun
  // ...existing code...

  // Kuuntele localStorage-muutoksia (esim. polling tai toinen selain)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (event: StorageEvent) => {
      // Synkronoi vain relevantit avaimet
      if (!event.key) return;
      const keys = [leaguesStorageKey, teamsStorageKey, matchesStorageKey, playersStorageKey, lineupsStorageKey, footballRotationsStorageKey];
      if (!keys.includes(event.key)) return;
      // Lataa uusimmat tiedot localStoragesta
      try {
        if (event.key === leaguesStorageKey) {
          const raw = localStorage.getItem(leaguesStorageKey);
          setLeagues(raw ? JSON.parse(raw) : []);
        } else if (event.key === teamsStorageKey) {
          const raw = localStorage.getItem(teamsStorageKey);
          setTeams(raw ? JSON.parse(raw) : []);
        } else if (event.key === matchesStorageKey) {
          const raw = localStorage.getItem(matchesStorageKey);
          setMatches(raw ? JSON.parse(raw) : []);
        } else if (event.key === playersStorageKey) {
          const raw = localStorage.getItem(playersStorageKey);
          setPlayers(raw ? JSON.parse(raw) : []);
        } else if (event.key === lineupsStorageKey) {
          const raw = localStorage.getItem(lineupsStorageKey);
          setLineupsByTeam(raw ? JSON.parse(raw) : {});
        } else if (event.key === footballRotationsStorageKey) {
          const raw = localStorage.getItem(footballRotationsStorageKey);
          setFootballRotationsByTeam(raw ? JSON.parse(raw) : {});
        }
      } catch {}
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [leaguesStorageKey, teamsStorageKey, matchesStorageKey, playersStorageKey, lineupsStorageKey, footballRotationsStorageKey]);

type League = {
  name: string;
  logo: string;
  rules: string;
  matchTimeMinutes: number;
  extraTimeEnabled: boolean;
  extraTimeFirstHalfMinutes: number;
  extraTimeSecondHalfMinutes: number;
  penaltiesEnabled: boolean;
  goldenGoalEnabled: boolean;
};

type Match = {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  scheduledAt: string;
  rules: string;
  matchTimeMinutes: number;
  extraTimeEnabled: boolean;
  extraTimeFirstHalfMinutes: number;
  extraTimeSecondHalfMinutes: number;
  penaltiesEnabled: boolean;
  goldenGoalEnabled: boolean;
  halftimeMinutes: number;
  refereeName: string;
  aet1Name: string;
  aet2Name: string;
  venue: string;
  homeScore?: number;
  awayScore?: number;
  status?: "scheduled" | "live" | "played";
  collectedStats: string[];
};

type TeamBackgroundInfo = {
  headCoach: string;
  manager: string;
  others: string;
};

type Team = {
  name: string;
  leagues: string[];
  logo: string;
  background: TeamBackgroundInfo;
};

type FootballRotation = {
  formation: string;
  assignments: Record<string, string>;
};

type PlayerPosition = "Maalivahti" | "Puolustaja" | "Keskikenttä" | "Hyökkääjä";

type Player = {
  firstName: string;
  lastName: string;
  team: string;
  number: string;
  photo: string;
  position: PlayerPosition | "";
};

const PLAYER_POSITION_OPTIONS: PlayerPosition[] = ["Maalivahti", "Puolustaja", "Keskikenttä", "Hyökkääjä"];

const normalizePlayerPosition = (value: unknown): PlayerPosition | "" => {
  if (typeof value !== "string") return "";
  return PLAYER_POSITION_OPTIONS.includes(value as PlayerPosition) ? (value as PlayerPosition) : "";
};

const isPlaceholderTeamName = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized === "home" || normalized === "away" || normalized === "koti" || normalized === "vieras";
};

const MATCH_STATS_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "goals", label: "Maalit" },
  { key: "saves", label: "Torjunnat" },
  { key: "shots", label: "Laukaukset" },
  { key: "shotsOnTarget", label: "Laukaukset maalia kohti" },
  { key: "penalties", label: "Rangaistuspotkut" },
  { key: "fouls", label: "Rikkeet" },
  { key: "yellowCards", label: "Keltaiset kortit" },
  { key: "redCards", label: "Punaiset kortit" },
  { key: "corners", label: "Kulmapotkut" },
  { key: "offsides", label: "Paitsio" },
  { key: "substitutions", label: "Vaihdot" },
];

const DEFAULT_MATCH_STATS = MATCH_STATS_OPTIONS.map((option) => option.key);

const FOOTBALL_FORMATIONS: Array<{ key: string; positions: string[] }> = [
  { key: "4-3-3", positions: ["MV", "OP", "KP", "KP", "VP", "KK", "KK", "KK", "OLH", "KH", "ORH"] },
  { key: "4-4-2", positions: ["MV", "OP", "KP", "KP", "VP", "OLK", "KK", "KK", "ORK", "KH", "KH"] },
  { key: "4-2-3-1", positions: ["MV", "OP", "KP", "KP", "VP", "PKK", "PKK", "OHK", "HK", "OHK", "KH"] },
  { key: "3-5-2", positions: ["MV", "KP", "KP", "KP", "OLW", "KK", "KK", "KK", "ORW", "KH", "KH"] },
  { key: "5-3-2", positions: ["MV", "VWB", "KP", "KP", "KP", "OWB", "KK", "KK", "KK", "KH", "KH"] },
  { key: "5-4-1", positions: ["MV", "VWB", "KP", "KP", "KP", "OWB", "OLK", "KK", "KK", "ORK", "KH"] },
];

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
    { top: 44, left: 22 },
    { top: 40, left: 50 },
    { top: 44, left: 78 },
    { top: 24, left: 50 },
  ],
  "5-3-2": [
    { top: 90, left: 50 },
    { top: 72, left: 10 },
    { top: 76, left: 28 },
    { top: 76, left: 50 },
    { top: 76, left: 72 },
    { top: 72, left: 90 },
    { top: 54, left: 30 },
    { top: 50, left: 50 },
    { top: 54, left: 70 },
    { top: 28, left: 40 },
    { top: 28, left: 60 },
  ],
  "5-4-1": [
    { top: 90, left: 50 },
    { top: 72, left: 10 },
    { top: 76, left: 28 },
    { top: 76, left: 50 },
    { top: 76, left: 72 },
    { top: 72, left: 90 },
    { top: 52, left: 18 },
    { top: 52, left: 40 },
    { top: 52, left: 60 },
    { top: 52, left: 82 },
    { top: 26, left: 50 },
  ],
};

const DEFAULT_PLAYER_SILHOUETTE = `data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><rect width='128' height='128' fill='#f3f4f6'/><circle cx='64' cy='44' r='22' fill='#9ca3af'/><path d='M22 118c2-24 18-38 42-38s40 14 42 38' fill='#9ca3af'/></svg>"
)}`;

const ENGINE_RELAY_KEY = "ligr:engine-relay";

const toThemeToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");

const createThemeMatchId = (homeTeam: string, awayTeam: string) => `${toThemeToken(homeTeam)}-vs-${toThemeToken(awayTeam)}`;
  const [clockRunning, setClockRunning] = useState(false);
  const [externalClockActive, setExternalClockActive] = useState(false);

  /* ============= graphics state ============= */
  const [scene, setScene] = useState("scorebug");
  const [goalText, setGoalText] = useState("");
  const [showGoal, setShowGoal] = useState(false);
  const [lowerThird, setLowerThird] = useState("");
  const [showLowerThird, setShowLowerThird] = useState(false);
  const [penaltyText, setPenaltyText] = useState("");
  const [showPenalty, setShowPenalty] = useState(false);
  const [lineup, setLineup] = useState("");
  const [showLineup, setShowLineup] = useState(false);
  const [fullscreenText, setFullscreenText] = useState("");
  const [showFullscreen, setShowFullscreen] = useState(false);

  /* ============= assets ============= */
  const [homeLogo, setHomeLogo] = useState("");
  const [awayLogo, setAwayLogo] = useState("");
  const [leagueLogo, setLeagueLogo] = useState("");
  const [sponsorLogo, setSponsorLogo] = useState("");

  /* ============= league/team/player data ============= */
  const [leagues, setLeagues] = useState<League[]>([]);
  const [newLeague, setNewLeague] = useState("");
  const [newLeagueLogo, setNewLeagueLogo] = useState("");
  const [newLeagueRules, setNewLeagueRules] = useState("");
  const [newLeagueMatchTimeMinutes, setNewLeagueMatchTimeMinutes] = useState("90");
  const [newLeagueExtraTimeEnabled, setNewLeagueExtraTimeEnabled] = useState(false);
  const [newLeagueExtraTimeFirstHalfMinutes, setNewLeagueExtraTimeFirstHalfMinutes] = useState("15");
  const [newLeagueExtraTimeSecondHalfMinutes, setNewLeagueExtraTimeSecondHalfMinutes] = useState("15");
  const [newLeaguePenaltiesEnabled, setNewLeaguePenaltiesEnabled] = useState(false);
  const [newLeagueGoldenGoalEnabled, setNewLeagueGoldenGoalEnabled] = useState(false);
  const [editingLeagueIndex, setEditingLeagueIndex] = useState<number | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [newMatchHomeTeam, setNewMatchHomeTeam] = useState("");
  const [newMatchAwayTeam, setNewMatchAwayTeam] = useState("");
  const [newMatchLeague, setNewMatchLeague] = useState("");
  const [newMatchScheduledAt, setNewMatchScheduledAt] = useState("");
  const [matchError, setMatchError] = useState("");
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [newTeam, setNewTeam] = useState("");
  const [teamLeagues, setTeamLeagues] = useState<string[]>([]);
  const [newTeamLogo, setNewTeamLogo] = useState("");
  const [newTeamHeadCoach, setNewTeamHeadCoach] = useState("");
  const [newTeamManager, setNewTeamManager] = useState("");
  const [newTeamOthers, setNewTeamOthers] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [newPlayerFirstName, setNewPlayerFirstName] = useState("");
  const [newPlayerLastName, setNewPlayerLastName] = useState("");
  const [playerTeam, setPlayerTeam] = useState("");
  const [newPlayerNumber, setNewPlayerNumber] = useState("");
  const [newPlayerPhoto, setNewPlayerPhoto] = useState("");
  const [newPlayerPosition, setNewPlayerPosition] = useState<PlayerPosition | "">("");
  const [editingPlayerIndex, setEditingPlayerIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"players" | "teams" | "leagues" | "matches" | "overlays">("players");
  const [teamSearch, setTeamSearch] = useState("");
  const [leagueSearch, setLeagueSearch] = useState("");
  const [lineupTeam, setLineupTeam] = useState("");
  const [lineupsByTeam, setLineupsByTeam] = useState<Record<string, { starting: string[]; bench: string[] }>>({});
  const [footballRotationsByTeam, setFootballRotationsByTeam] = useState<Record<string, FootballRotation>>({});
  const [draggedLineupPlayerKey, setDraggedLineupPlayerKey] = useState<string | null>(null);
  const [expandedTeamName, setExpandedTeamName] = useState<string | null>(null);
  const [activeOverlayStyle, setActiveOverlayStyle] = useState<"classic-dark" | "modern-blue" | "neon-sport" | "ligr-pro">("ligr-pro");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const teamImportInputRef = useRef<HTMLInputElement | null>(null);
  const [teamImportName, setTeamImportName] = useState("");
  const [copiedMatchId, setCopiedMatchId] = useState<string | null>(null);
  const [productionUrlVersionByMatchId, setProductionUrlVersionByMatchId] = useState<Record<string, string>>({});
  const engineChannelRef = useRef<BroadcastChannel | null>(null);
  const leaguesStorageKey = `ligr:${sport}:leagues`;
  const teamsStorageKey = `ligr:${sport}:teams`;
  const matchesStorageKey = `ligr:${sport}:matches`;
  const matchLinkDataStorageKey = `ligr:${sport}:match-link-data`;
  const playersStorageKey = `ligr:${sport}:players`;
  const lineupsStorageKey = `ligr:${sport}:lineups`;
  const footballRotationsStorageKey = `ligr:${sport}:football-rotations`;
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [syncReady, setSyncReady] = useState(() =>
    typeof window !== "undefined" && isServerSyncDone()
  );

  // Wait for ServerStorageSync to finish loading server data into localStorage
  // before ControlRoom reads from localStorage (prevents empty-data race condition).
  useEffect(() => {
    if (syncReady) return;
    const handleSyncDone = () => setSyncReady(true);
    window.addEventListener(SYNC_DONE_EVENT, handleSyncDone);
    return () => window.removeEventListener(SYNC_DONE_EVENT, handleSyncDone);
  }, [syncReady]);

  /* ============= realtime engine ============= */
  const relayEngineMessage = (payload: Record<string, unknown>) => {
    const message = { ...payload, relayTs: Date.now() };
    engineChannelRef.current?.postMessage(message);
    if (typeof window !== "undefined") {
      localStorage.setItem(ENGINE_RELAY_KEY, JSON.stringify(message));
    }
    relayPublish(message);
  };

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("ligr_full_clone_engine");
    engineChannelRef.current = channel;

    channel.onmessage = (event) => {
      const d = event.data;
      if (d.type === "score") {
        setHomeTeam(d.homeTeam);
        setAwayTeam(d.awayTeam);
        setHomeScore(d.homeScore);
        setAwayScore(d.awayScore);
        setPeriod(d.period);
        setClock(d.clock);
        const incomingHomeTeam = typeof d.homeTeam === "string" ? d.homeTeam : "";
        const incomingAwayTeam = typeof d.awayTeam === "string" ? d.awayTeam : "";
        const incomingHomeScore = typeof d.homeScore === "number" ? d.homeScore : 0;
        const incomingAwayScore = typeof d.awayScore === "number" ? d.awayScore : 0;
        const incomingClock = typeof d.clock === "string" ? d.clock : "00:00";
        const incomingClockRunning = d.clockRunning === true;
        const hasStarted = incomingClock !== "00:00" || incomingHomeScore > 0 || incomingAwayScore > 0;

        setMatches((prev) => {
          const incomingMatchId = createThemeMatchId(incomingHomeTeam, incomingAwayTeam);
          return prev.map((match) => {
            const matchThemeId = match.matchId && match.matchId !== "undefined" && match.matchId !== "null"
              ? match.matchId
              : createThemeMatchId(match.homeTeam, match.awayTeam);

            if (matchThemeId !== incomingMatchId) return match;

            return {
              ...match,
              homeScore: incomingHomeScore,
              awayScore: incomingAwayScore,
              status: incomingClockRunning ? "live" : (hasStarted ? "played" : (match.status || "scheduled")),
            };
          });
        });

        if (typeof d.clockRunning === "boolean") {
          const incomingSource = typeof d.source === "string" ? d.source : "";
          if (incomingSource === "livescore") {
            setExternalClockActive(d.clockRunning);
            if (!d.clockRunning) {
              setClockRunning(false);
            }
          } else {
            setClockRunning(d.clockRunning);
          }
        }
      }
      if (d.type === "resetMatch") {
        setClockRunning(false);
        setExternalClockActive(false);
        setHomeScore(0);
        setAwayScore(0);
        setPeriod("1");
        setClock("00:00");
        setGoalText("");
        setShowGoal(false);
        setLowerThird("");
        setShowLowerThird(false);
        setPenaltyText("");
        setShowPenalty(false);
        setLineup("");
        setShowLineup(false);
        setFullscreenText("");
        setShowFullscreen(false);
        setScene("scorebug");
      }
      if (d.type === "scene") setScene(d.scene);
      if (d.type === "goal") {
        setGoalText(d.text);
        setShowGoal(true);
        setTimeout(() => setShowGoal(false), 5000);
      }
      if (d.type === "lower") {
        setLowerThird(d.text);
        setShowLowerThird(true);
        setTimeout(() => setShowLowerThird(false), 6000);
      }
      if (d.type === "penalty") {
        setPenaltyText(d.text);
        setShowPenalty(true);
        setTimeout(() => setShowPenalty(false), 6000);
      }
      if (d.type === "lineup") {
        setLineup(d.text);
        setShowLineup(true);
        setTimeout(() => setShowLineup(false), 9000);
      }
      if (d.type === "fullscreen") {
        setFullscreenText(d.text);
        setShowFullscreen(true);
        setTimeout(() => setShowFullscreen(false), 7000);
      }
      if (d.type === "branding") {
        setHomeLogo(d.homeLogo);
        setAwayLogo(d.awayLogo);
        setLeagueLogo(d.leagueLogo);
        setSponsorLogo(d.sponsorLogo);
      }
    };

    return () => {
      channel.close();
      engineChannelRef.current = null;
    };
  }, [sport]);

  useEffect(() => {
    if (!clockRunning || externalClockActive) return;
    const interval = setInterval(() => {
      setClock((prev) => {
        const [m, s] = prev.split(":").map(Number);
        const total = m * 60 + s + 1;
        const nm = String(Math.floor(total / 60)).padStart(2, "0");
        const ns = String(total % 60).padStart(2, "0");
        const newTime = `${nm}:${ns}`;
        if (shouldBroadcastScoreState) {
          relayEngineMessage({
            type: "score",
            source: "control-room",
            homeTeam,
            awayTeam,
            homeScore,
            awayScore,
            period,
            clock: newTime,
            clockRunning: true,
          });
        }
        return newTime;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [clockRunning, externalClockActive, homeTeam, awayTeam, homeScore, awayScore, period, shouldBroadcastScoreState]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const heartbeat = window.setInterval(() => {
      if (shouldBroadcastScoreState) {
        relayEngineMessage({
          type: "score",
          source: "control-room",
          homeTeam,
          awayTeam,
          homeScore,
          awayScore,
          period,
          clock,
          clockRunning,
        });
      }
      relayEngineMessage({ type: "scene", scene });
      relayEngineMessage({ type: "overlayStyle", style: activeOverlayStyle });
      relayEngineMessage({
        type: "branding",
        homeLogo,
        awayLogo,
        leagueLogo,
        sponsorLogo,
      });
    }, 1500);

    return () => window.clearInterval(heartbeat);
  }, [activeOverlayStyle, awayLogo, awayScore, awayTeam, clock, clockRunning, homeLogo, homeScore, homeTeam, leagueLogo, period, scene, shouldBroadcastScoreState, sponsorLogo]);

  useEffect(() => {
    if (!syncReady || typeof window === "undefined") return;
    setHasLoadedStorage(false);

    const parseFromStorage = <T,>(key: string): T[] => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as T[]) : [];
      } catch {
        return [];
      }
    };

    const storedLeagues = parseFromStorage<Array<Partial<League> & { name?: string; logo?: string }>[number]>(leaguesStorageKey)
      .map((league) => ({
        legacyExtraTimeMinutes: typeof (league as { extraTimeMinutes?: unknown }).extraTimeMinutes === "number"
          ? ((league as { extraTimeMinutes?: number }).extraTimeMinutes as number)
          : 30,
        name: league.name ?? "",
        logo: league.logo ?? "",
        rules: typeof league.rules === "string" ? league.rules : "",
        matchTimeMinutes: typeof league.matchTimeMinutes === "number" ? league.matchTimeMinutes : 90,
        extraTimeEnabled: Boolean(league.extraTimeEnabled),
        extraTimeFirstHalfMinutes: typeof league.extraTimeFirstHalfMinutes === "number"
          ? league.extraTimeFirstHalfMinutes
          : Math.max(1, Math.round((typeof (league as { extraTimeMinutes?: unknown }).extraTimeMinutes === "number"
              ? ((league as { extraTimeMinutes?: number }).extraTimeMinutes as number)
              : 30) / 2)),
        extraTimeSecondHalfMinutes: typeof league.extraTimeSecondHalfMinutes === "number"
          ? league.extraTimeSecondHalfMinutes
          : Math.max(1, Math.round((typeof (league as { extraTimeMinutes?: unknown }).extraTimeMinutes === "number"
              ? ((league as { extraTimeMinutes?: number }).extraTimeMinutes as number)
              : 30) / 2)),
        penaltiesEnabled: Boolean(league.penaltiesEnabled),
        goldenGoalEnabled: Boolean(league.goldenGoalEnabled),
      }))
      .map(({ legacyExtraTimeMinutes: _legacyExtraTimeMinutes, ...league }) => league)
      .filter((league) => league.name.trim());

    setLeagues(storedLeagues);
    const storedTeams = parseFromStorage<{
      name?: string;
      league?: string;
      leagues?: string[];
      logo?: string;
      headCoach?: string;
      manager?: string;
      others?: string;
      background?: Partial<TeamBackgroundInfo>;
    }>(teamsStorageKey)
      .map((team) => ({
        name: typeof team.name === "string" ? team.name : "",
        logo: typeof team.logo === "string" ? team.logo : "",
        leagues: Array.isArray(team.leagues)
          ? team.leagues.filter(Boolean)
          : team.league
            ? [team.league]
            : [],
        background: {
          headCoach:
            typeof team.background?.headCoach === "string"
              ? team.background.headCoach
              : typeof team.headCoach === "string"
                ? team.headCoach
                : "",
          manager:
            typeof team.background?.manager === "string"
              ? team.background.manager
              : typeof team.manager === "string"
                ? team.manager
                : "",
          others:
            typeof team.background?.others === "string"
              ? team.background.others
              : typeof team.others === "string"
                ? team.others
                : "",
        },
      }));

    setTeams(storedTeams);
    const storedMatches = parseFromStorage<Partial<Match> & { id?: string }>(matchesStorageKey)
      .map((match) => ({
        homeTeam: match.homeTeam ?? "",
        awayTeam: match.awayTeam ?? "",
        id: match.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        matchId: typeof match.matchId === "string" && match.matchId.trim()
          ? match.matchId
          : createThemeMatchId(match.homeTeam ?? "home", match.awayTeam ?? "away"),
        league: match.league ?? "",
        scheduledAt: match.scheduledAt ?? "",
        rules: typeof match.rules === "string" ? match.rules : "",
        matchTimeMinutes: typeof match.matchTimeMinutes === "number" ? match.matchTimeMinutes : 90,
        extraTimeEnabled: Boolean(match.extraTimeEnabled),
        extraTimeFirstHalfMinutes: typeof match.extraTimeFirstHalfMinutes === "number" ? match.extraTimeFirstHalfMinutes : 15,
        extraTimeSecondHalfMinutes: typeof match.extraTimeSecondHalfMinutes === "number" ? match.extraTimeSecondHalfMinutes : 15,
        penaltiesEnabled: Boolean(match.penaltiesEnabled),
        goldenGoalEnabled: Boolean(match.goldenGoalEnabled),
        halftimeMinutes: typeof match.halftimeMinutes === "number" && match.halftimeMinutes >= 0
          ? match.halftimeMinutes
          : Math.round((typeof match.matchTimeMinutes === "number" ? match.matchTimeMinutes : 90) / 2),
        refereeName: typeof (match as { refereeName?: unknown }).refereeName === "string"
          ? ((match as { refereeName?: string }).refereeName as string)
          : "",
        aet1Name: typeof (match as { aet1Name?: unknown }).aet1Name === "string"
          ? ((match as { aet1Name?: string }).aet1Name as string)
          : typeof (match as { aet1Minutes?: unknown }).aet1Minutes === "number"
            ? String((match as { aet1Minutes?: number }).aet1Minutes as number)
            : "",
        aet2Name: typeof (match as { aet2Name?: unknown }).aet2Name === "string"
          ? ((match as { aet2Name?: string }).aet2Name as string)
          : typeof (match as { aet2Minutes?: unknown }).aet2Minutes === "number"
            ? String((match as { aet2Minutes?: number }).aet2Minutes as number)
            : "",
        venue: typeof (match as { venue?: unknown }).venue === "string"
          ? ((match as { venue?: string }).venue as string)
          : "",
        homeScore: typeof (match as { homeScore?: unknown }).homeScore === "number"
          ? ((match as { homeScore?: number }).homeScore as number)
          : 0,
        awayScore: typeof (match as { awayScore?: unknown }).awayScore === "number"
          ? ((match as { awayScore?: number }).awayScore as number)
          : 0,
        status: (typeof (match as { status?: unknown }).status === "string"
          && ["scheduled", "live", "played"].includes((match as { status?: string }).status || ""))
          ? ((match as { status?: "scheduled" | "live" | "played" }).status as "scheduled" | "live" | "played")
          : "scheduled",
        collectedStats: Array.isArray(match.collectedStats)
          ? match.collectedStats.filter(
              (stat): stat is string =>
                typeof stat === "string" && MATCH_STATS_OPTIONS.some((option) => option.key === stat)
            )
          : DEFAULT_MATCH_STATS,
      }))
      .filter((match) => match.homeTeam && match.awayTeam);

    setMatches(storedMatches);
    const storedPlayers = parseFromStorage<Partial<Player>>(playersStorageKey)
      .map((player) => ({
        firstName: typeof player.firstName === "string" ? player.firstName : "",
        lastName: typeof player.lastName === "string" ? player.lastName : "",
        team: typeof player.team === "string" ? player.team : "",
        number: typeof player.number === "string" ? player.number : "",
        photo: typeof player.photo === "string" ? player.photo : "",
        position: normalizePlayerPosition(player.position),
      }))
      .filter((player) => player.firstName || player.lastName);

    setPlayers(storedPlayers);

    const rawLineups = typeof window !== "undefined" ? localStorage.getItem(lineupsStorageKey) : null;
    if (rawLineups) {
      try {
        const parsed = JSON.parse(rawLineups) as Record<string, { starting?: string[]; bench?: string[] }>;
        const normalized = Object.entries(parsed || {}).reduce<Record<string, { starting: string[]; bench: string[] }>>((acc, [teamName, value]) => {
          acc[teamName] = {
            starting: Array.isArray(value?.starting) ? value.starting : [],
            bench: Array.isArray(value?.bench) ? value.bench : [],
          };
          return acc;
        }, {});
        setLineupsByTeam(normalized);
      } catch {
        setLineupsByTeam({});
      }
    } else {
      setLineupsByTeam({});
    }

    const rawFootballRotations = typeof window !== "undefined" ? localStorage.getItem(footballRotationsStorageKey) : null;
    if (rawFootballRotations) {
      try {
        const parsed = JSON.parse(rawFootballRotations) as Record<string, FootballRotation>;
        setFootballRotationsByTeam(parsed || {});
      } catch {
        setFootballRotationsByTeam({});
      }
    } else {
      setFootballRotationsByTeam({});
    }
    setHasLoadedStorage(true);
  }, [syncReady, leaguesStorageKey, teamsStorageKey, matchesStorageKey, playersStorageKey, lineupsStorageKey, footballRotationsStorageKey]);

  useEffect(() => {
    if (!hasLoadedStorage || typeof window === "undefined") return;
    localStorage.setItem(leaguesStorageKey, JSON.stringify(leagues));
  }, [hasLoadedStorage, leagues, leaguesStorageKey]);

  useEffect(() => {
    if (!hasLoadedStorage || typeof window === "undefined") return;
    localStorage.setItem(teamsStorageKey, JSON.stringify(teams));
  }, [hasLoadedStorage, teams, teamsStorageKey]);

  useEffect(() => {
    if (!hasLoadedStorage || typeof window === "undefined") return;
    localStorage.setItem(matchesStorageKey, JSON.stringify(matches));
  }, [hasLoadedStorage, matches, matchesStorageKey]);

  useEffect(() => {
    if (!hasLoadedStorage || typeof window === "undefined") return;
    localStorage.setItem(playersStorageKey, JSON.stringify(players));
  }, [hasLoadedStorage, players, playersStorageKey]);

  useEffect(() => {
    if (!hasLoadedStorage || typeof window === "undefined") return;
    localStorage.setItem(lineupsStorageKey, JSON.stringify(lineupsByTeam));
  }, [hasLoadedStorage, lineupsByTeam, lineupsStorageKey]);

  useEffect(() => {
    if (!hasLoadedStorage || typeof window === "undefined") return;
    localStorage.setItem(footballRotationsStorageKey, JSON.stringify(footballRotationsByTeam));
  }, [hasLoadedStorage, footballRotationsByTeam, footballRotationsStorageKey]);

  useEffect(() => {
    if (!hasLoadedStorage || typeof window === "undefined") return;

    const matchLinkData = matches.reduce<Record<string, { homeTeam: string; awayTeam: string; homeLogo: string; awayLogo: string; leagueLogo: string; startAt: string; refereeName: string; aet1Name: string; aet2Name: string; venue: string; collectedStats: string[]; extraTimeEnabled: boolean; penaltiesEnabled: boolean; goldenGoalEnabled: boolean; matchTimeMinutes: number; extraTimeFirstHalfMinutes: number; extraTimeSecondHalfMinutes: number }>>((acc, match) => {
      const resolvedMatchId = match.matchId && match.matchId !== "undefined" && match.matchId !== "null"
        ? match.matchId
        : createThemeMatchId(match.homeTeam, match.awayTeam);
      const homeTeamLogo = teams.find((team) => team.name === match.homeTeam)?.logo || "";
      const awayTeamLogo = teams.find((team) => team.name === match.awayTeam)?.logo || "";
      const matchLeagueLogo = leagues.find((league) => league.name === match.league)?.logo || "";

      acc[resolvedMatchId] = {
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeLogo: homeTeamLogo,
        awayLogo: awayTeamLogo,
        leagueLogo: matchLeagueLogo,
        startAt: match.scheduledAt || "",
        refereeName: match.refereeName || "",
        aet1Name: match.aet1Name || "",
        aet2Name: match.aet2Name || "",
        venue: match.venue || "",
        collectedStats: Array.isArray(match.collectedStats) ? match.collectedStats : [],
        extraTimeEnabled: Boolean(match.extraTimeEnabled),
        penaltiesEnabled: Boolean(match.penaltiesEnabled),
        goldenGoalEnabled: Boolean(match.goldenGoalEnabled),
        matchTimeMinutes: typeof match.matchTimeMinutes === "number" && match.matchTimeMinutes > 0 ? match.matchTimeMinutes : 90,
        extraTimeFirstHalfMinutes: typeof match.extraTimeFirstHalfMinutes === "number" && match.extraTimeFirstHalfMinutes >= 0 ? match.extraTimeFirstHalfMinutes : 15,
        extraTimeSecondHalfMinutes: typeof match.extraTimeSecondHalfMinutes === "number" && match.extraTimeSecondHalfMinutes >= 0 ? match.extraTimeSecondHalfMinutes : 15,
      };

      return acc;
    }, {});

    localStorage.setItem(matchLinkDataStorageKey, JSON.stringify(matchLinkData));
  }, [hasLoadedStorage, leagues, matchLinkDataStorageKey, matches, teams]);

  /* ============= actions ============= */
  const updateScore = () => {
    if (!shouldBroadcastScoreState) return;
    relayEngineMessage({
      type: "score",
      source: "control-room",
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      period,
      clock,
      clockRunning,
    });
  };
  const triggerGoal = () => {
    relayEngineMessage({ type: "goal", text: goalText });
  };
  const triggerLower = () => {
    relayEngineMessage({ type: "lower", text: lowerThird });
  };
  const triggerPenalty = () => {
    relayEngineMessage({ type: "penalty", text: penaltyText });
  };
  const triggerLineup = (text?: string) => {
    relayEngineMessage({ type: "lineup", text: text ?? lineup });
  };
  const triggerFullscreen = () => {
    relayEngineMessage({ type: "fullscreen", text: fullscreenText });
  };
  const copyToClipboard = async (text: string) => {
    if (typeof window === "undefined") return false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fall through to legacy copy method.
      }
    }

    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      textArea.setSelectionRange(0, textArea.value.length);
      const copied = document.execCommand("copy");
      document.body.removeChild(textArea);
      return copied;
    } catch {
      return false;
    }
  };
  const changeScene = (s: string) => {
    relayEngineMessage({ type: "scene", scene: s });
  };
  const activateOverlayPackage = (style: "classic-dark" | "modern-blue" | "neon-sport" | "ligr-pro") => {
    setActiveOverlayStyle(style);
    relayEngineMessage({ type: "overlayStyle", style });
  };
  const updateBranding = () => {
    relayEngineMessage({
      type: "branding",
      homeLogo,
      awayLogo,
      leagueLogo,
      sponsorLogo,
    });
  };

  const resetLeagueForm = () => {
    setNewLeague("");
    setNewLeagueLogo("");
    setNewLeagueRules("");
    setNewLeagueMatchTimeMinutes("90");
    setNewLeagueExtraTimeEnabled(false);
    setNewLeagueExtraTimeFirstHalfMinutes("15");
    setNewLeagueExtraTimeSecondHalfMinutes("15");
    setNewLeaguePenaltiesEnabled(false);
    setNewLeagueGoldenGoalEnabled(false);
    setEditingLeagueIndex(null);
  };

  const addLeague = () => {
    if(!newLeague.trim()) return;

    const parsedMatchTime = Number.parseInt(newLeagueMatchTimeMinutes, 10);
    const parsedExtraTimeFirstHalf = Number.parseInt(newLeagueExtraTimeFirstHalfMinutes, 10);
    const parsedExtraTimeSecondHalf = Number.parseInt(newLeagueExtraTimeSecondHalfMinutes, 10);

    const leaguePayload: League = {
      name: newLeague.trim(),
      logo: newLeagueLogo,
      rules: newLeagueRules.trim(),
      matchTimeMinutes: Number.isFinite(parsedMatchTime) && parsedMatchTime > 0 ? parsedMatchTime : 90,
      extraTimeEnabled: newLeagueExtraTimeEnabled,
      extraTimeFirstHalfMinutes: Number.isFinite(parsedExtraTimeFirstHalf) && parsedExtraTimeFirstHalf >= 0 ? parsedExtraTimeFirstHalf : 15,
      extraTimeSecondHalfMinutes: Number.isFinite(parsedExtraTimeSecondHalf) && parsedExtraTimeSecondHalf >= 0 ? parsedExtraTimeSecondHalf : 15,
      penaltiesEnabled: newLeaguePenaltiesEnabled,
      goldenGoalEnabled: newLeagueGoldenGoalEnabled,
    };

    if (editingLeagueIndex !== null) {
      setLeagues((prev) => prev.map((league, index) => (index === editingLeagueIndex ? leaguePayload : league)));
    } else {
      setLeagues((prev) => [...prev, leaguePayload]);
    }

    resetLeagueForm();
  };

  const startEditingLeague = (index: number) => {
    const league = leagues[index];
    if (!league) return;

    setNewLeague(league.name);
    setNewLeagueLogo(league.logo);
    setNewLeagueRules(league.rules);
    setNewLeagueMatchTimeMinutes(String(league.matchTimeMinutes));
    setNewLeagueExtraTimeEnabled(league.extraTimeEnabled);
    setNewLeagueExtraTimeFirstHalfMinutes(String(league.extraTimeFirstHalfMinutes));
    setNewLeagueExtraTimeSecondHalfMinutes(String(league.extraTimeSecondHalfMinutes));
    setNewLeaguePenaltiesEnabled(league.penaltiesEnabled);
    setNewLeagueGoldenGoalEnabled(league.goldenGoalEnabled);
    setEditingLeagueIndex(index);
  };
  const addTeam = () => {
    if(!newTeam.trim()) return;
    const teamPayload: Team = {
      name: newTeam.trim(),
      leagues: teamLeagues,
      logo: newTeamLogo,
      background: {
        headCoach: newTeamHeadCoach.trim(),
        manager: newTeamManager.trim(),
        others: newTeamOthers.trim(),
      },
    };

    if (editingTeamIndex !== null) {
      setTeams((prev) =>
        prev.map((t, i) =>
          i === editingTeamIndex
            ? teamPayload
            : t
        )
      );
      setEditingTeamIndex(null);
    } else {
      setTeams((prev) => [...prev, teamPayload]);
    }
    setNewTeam("");
    setTeamLeagues([]);
    setNewTeamLogo("");
    setNewTeamHeadCoach("");
    setNewTeamManager("");
    setNewTeamOthers("");
    setTeamModalOpen(false);
  };

  const addMatch = () => {
    if (!newMatchHomeTeam || !newMatchAwayTeam) {
      setMatchError("Valitse koti- ja vierasjoukkue.");
      return;
    }
    if (newMatchHomeTeam === newMatchAwayTeam) {
      setMatchError("Koti- ja vierasjoukkue eivät voi olla sama.");
      return;
    }

    const selectedLeague = leagues.find((league) => league.name === newMatchLeague);
    const themeMatchId = createThemeMatchId(newMatchHomeTeam, newMatchAwayTeam);

    const newMatch: Match = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      matchId: themeMatchId,
      homeTeam: newMatchHomeTeam,
      awayTeam: newMatchAwayTeam,
      league: newMatchLeague,
      scheduledAt: newMatchScheduledAt,
      rules: selectedLeague?.rules ?? "",
      matchTimeMinutes: selectedLeague?.matchTimeMinutes ?? 90,
      extraTimeEnabled: selectedLeague?.extraTimeEnabled ?? false,
      extraTimeFirstHalfMinutes: selectedLeague?.extraTimeFirstHalfMinutes ?? 15,
      extraTimeSecondHalfMinutes: selectedLeague?.extraTimeSecondHalfMinutes ?? 15,
      penaltiesEnabled: selectedLeague?.penaltiesEnabled ?? false,
      goldenGoalEnabled: selectedLeague?.goldenGoalEnabled ?? false,
      halftimeMinutes: Math.round((selectedLeague?.matchTimeMinutes ?? 90) / 2),
      refereeName: "",
      aet1Name: "",
      aet2Name: "",
      venue: "",
      homeScore: 0,
      awayScore: 0,
      status: "scheduled",
      collectedStats: DEFAULT_MATCH_STATS,
    };

    setMatches((prev) => [newMatch, ...prev]);
    setNewMatchHomeTeam("");
    setNewMatchAwayTeam("");
    setNewMatchLeague("");
    setNewMatchScheduledAt("");
    setMatchError("");
  };

  const removeMatch = (id: string) => {
    setMatches((prev) => prev.filter((match) => match.id !== id));
    setEditingMatchId((prev) => (prev === id ? null : prev));
  };

  const updateMatch = (id: string, updater: (match: Match) => Match) => {
    setMatches((prev) => prev.map((match) => (match.id === id ? updater(match) : match)));
  };

  const addPlayer = () => {
    if(!newPlayerFirstName.trim() || !newPlayerLastName.trim()) return;
    const playerPayload: Player = {
      firstName: newPlayerFirstName.trim(),
      lastName: newPlayerLastName.trim(),
      team: playerTeam,
      number: newPlayerNumber,
      photo: newPlayerPhoto,
      position: newPlayerPosition,
    };

    if (editingPlayerIndex !== null) {
      setPlayers(prev => prev.map((p, i) => i === editingPlayerIndex ? playerPayload : p));
      setEditingPlayerIndex(null);
    } else {
      setPlayers(prev=>[...prev, playerPayload]);
    }
    setNewPlayerFirstName("");
    setNewPlayerLastName("");
    setPlayerTeam("");
    setNewPlayerNumber("");
    setNewPlayerPhoto("");
    setNewPlayerPosition("");
    setPlayerModalOpen(false);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { removeBackground } = await import('@imgly/background-removal');
      const processedBlob = await removeBackground(file);
      const url = URL.createObjectURL(processedBlob);
      setNewPlayerPhoto(url);
    } catch (error) {
      console.error('Background removal failed:', error);
      // Fallback to original
      const url = URL.createObjectURL(file);
      setNewPlayerPhoto(url);
    }
  };

  const toDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error("Failed to read image as data URL."));
      };
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(blob);
    });

  const handleTeamLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await toDataUrl(file);
    setNewTeamLogo(dataUrl);
  };

  const handleLeagueLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await toDataUrl(file);
    setNewLeagueLogo(dataUrl);
  };

  const openPlayerModal = () => {
    setEditingPlayerIndex(null);
    setNewPlayerFirstName("");
    setNewPlayerLastName("");
    setPlayerTeam("");
    setNewPlayerNumber("");
    setNewPlayerPhoto("");
    setNewPlayerPosition("");
    setPlayerModalOpen(true);
  };

  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editingTeamIndex, setEditingTeamIndex] = useState<number | null>(null);

  const startEditingPlayer = (index: number) => {
    const player = players[index];
    setNewPlayerFirstName(player.firstName);
    setNewPlayerLastName(player.lastName);
    setPlayerTeam(player.team);
    setNewPlayerNumber(player.number);
    setNewPlayerPhoto(player.photo);
    setNewPlayerPosition(player.position || "");
    setEditingPlayerIndex(index);
    setPlayerModalOpen(true);
  };

  const startEditingTeam = (index: number) => {
    const team = teams[index];
    setNewTeam(team.name);
    setTeamLeagues(team.leagues);
    setNewTeamLogo(team.logo);
    setNewTeamHeadCoach(team.background?.headCoach || "");
    setNewTeamManager(team.background?.manager || "");
    setNewTeamOthers(team.background?.others || "");
    setEditingTeamIndex(index);
    setTeamModalOpen(true);
  };

  const cancelEditing = () => {
    setEditingPlayerIndex(null);
    setNewPlayerFirstName("");
    setNewPlayerLastName("");
    setPlayerTeam("");
    setNewPlayerNumber("");
    setNewPlayerPhoto("");
    setNewPlayerPosition("");
    setPlayerModalOpen(false);

    setEditingTeamIndex(null);
    setNewTeam("");
    setTeamLeagues([]);
    setNewTeamLogo("");
    setNewTeamHeadCoach("");
    setNewTeamManager("");
    setNewTeamOthers("");
    setTeamModalOpen(false);
  };

  const removeLeague = (index: number) => {
    const removedLeague = leagues[index]?.name;
    setLeagues(prev => prev.filter((_, i) => i !== index));
    if (removedLeague) {
      setTeams((prev) => prev.map((team) => ({
        ...team,
        leagues: team.leagues.filter((league) => league !== removedLeague),
      })));
    }
  };
  const removeTeam = (index: number) => {
    setTeams(prev => prev.filter((_, i) => i !== index));
  };
  const removePlayer = (index: number) => {
    setPlayers(prev => prev.filter((_, i) => i !== index));
  };

  const parseImportedPlayers = (text: string, fallbackTeam = "") => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return [];

    const detectDelimiter = (headerLine: string) => {
      const candidates = [",", ";", "\t"];
      let best = ",";
      let bestCount = -1;

      for (const delimiter of candidates) {
        const count = headerLine.split(delimiter).length;
        if (count > bestCount) {
          best = delimiter;
          bestCount = count;
        }
      }
      return best;
    };

    const splitRow = (row: string, delimiter: string) =>
      row.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ""));

    const delimiter = detectDelimiter(lines[0]);
    const headers = splitRow(lines[0], delimiter).map((h) => h.toLowerCase().replace(/^\uFEFF/, ""));
    const findHeader = (...names: string[]) => {
      for (const name of names) {
        const index = headers.indexOf(name);
        if (index >= 0) return index;
      }
      return -1;
    };

    const idx = {
      firstName: findHeader("firstname", "etunimi"),
      lastName: findHeader("lastname", "sukunimi"),
      legacyName: findHeader("name", "nimi"),
      team: findHeader("team", "joukkue"),
      number: findHeader("number", "pelinumero"),
      photo: findHeader("photo", "kuva"),
      position: findHeader("position", "pelipaikka"),
    };

    const importedPlayers: Player[] = lines.slice(1).map((line) => {
      const cols = splitRow(line, delimiter);
      const legacyName = idx.legacyName >= 0 ? cols[idx.legacyName] ?? "" : "";
      const [legacyFirstName = "", ...legacyLastParts] = legacyName.split(" ").filter(Boolean);
      const legacyLastName = legacyLastParts.join(" ");

      const firstName = idx.firstName >= 0 ? cols[idx.firstName] ?? "" : legacyFirstName;
      const lastName = idx.lastName >= 0 ? cols[idx.lastName] ?? "" : legacyLastName;

      const parsedPosition = idx.position >= 0 ? cols[idx.position] ?? "" : "";
      const normalizedPosition = normalizePlayerPosition(parsedPosition);

      return {
        firstName,
        lastName,
        team: idx.team >= 0 ? cols[idx.team] ?? "" : fallbackTeam,
        number: idx.number >= 0 ? cols[idx.number] ?? "" : "",
        photo: idx.photo >= 0 ? cols[idx.photo] ?? "" : "",
        position: normalizedPosition,
      };
    });

    return importedPlayers
      .filter((p) => p.firstName || p.lastName)
      .map((p) => ({
        ...p,
        team: p.team || fallbackTeam,
      }));
  };

  const handleImportPlayers = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const importedPlayers = parseImportedPlayers(text);

    setPlayers((prev) => [...prev, ...importedPlayers]);
    if (importInputRef.current) importInputRef.current.value = "";
  };

  const handleImportPlayersToTeam = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !teamImportName) return;

    const text = await file.text();
    const importedPlayers = parseImportedPlayers(text, teamImportName);

    setPlayers((prev) => [...prev, ...importedPlayers]);
    if (teamImportInputRef.current) teamImportInputRef.current.value = "";
    setTeamImportName("");
  };

  const openTeamImport = (teamName: string) => {
    setTeamImportName(teamName);
    teamImportInputRef.current?.click();
  };

  const filteredPlayers = useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    const teamQ = teamFilter.trim();

    return players.filter((p) => {
      const matchesSearch =
        !q
        || p.firstName.toLowerCase().includes(q)
        || p.lastName.toLowerCase().includes(q)
        || p.team.toLowerCase().includes(q)
        || p.number.includes(q)
        || p.position.toLowerCase().includes(q);
      const matchesTeam = !teamQ || p.team === teamQ;
      return matchesSearch && matchesTeam;
    });
  }, [players, playerSearch, teamFilter]);

  const filteredTeams = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) =>
      t.name.toLowerCase().includes(q) || t.leagues.some((league) => league.toLowerCase().includes(q))
    );
  }, [teams, teamSearch]);

  const filteredLeagues = useMemo(() => {
    const q = leagueSearch.trim().toLowerCase();
    if (!q) return leagues;
    return leagues.filter((l) => l.name.toLowerCase().includes(q));
  }, [leagues, leagueSearch]);

  const lineupTeamPlayers = useMemo(() => {
    if (!lineupTeam) return [];
    return players
      .filter((p) => p.team === lineupTeam)
      .map((p, index) => ({
        ...p,
        key: `${lineupTeam}-${index}-${p.firstName}-${p.lastName}-${p.number}`,
      }));
  }, [players, lineupTeam]);

  const lineupTeamPlayerMap = useMemo(
    () => new Map(lineupTeamPlayers.map((player) => [player.key, player])),
    [lineupTeamPlayers]
  );

  const footballFormation = useMemo(
    () => FOOTBALL_FORMATIONS.find((formation) => formation.key === (footballRotationsByTeam[lineupTeam]?.formation || "4-3-3")) || FOOTBALL_FORMATIONS[0],
    [footballRotationsByTeam, lineupTeam]
  );

  const footballRotationAssignments = footballRotationsByTeam[lineupTeam]?.assignments || {};

  const currentLineup = lineupsByTeam[lineupTeam] ?? { starting: [], bench: [] };
  const startingLineup = currentLineup.starting;
  const benchLineup = currentLineup.bench;
  const startingLineupKeySet = useMemo(() => new Set(startingLineup), [startingLineup]);
  const startingLineupPlayers = useMemo(
    () => startingLineup
      .map((key) => lineupTeamPlayerMap.get(key))
      .filter((player): player is NonNullable<typeof player> => Boolean(player)),
    [lineupTeamPlayerMap, startingLineup]
  );

  const updateLineupForTeam = (
    teamName: string,
    updater: (lineup: { starting: string[]; bench: string[] }) => { starting: string[]; bench: string[] }
  ) => {
    if (!teamName) return;
    setLineupsByTeam((prev) => {
      const base = prev[teamName] ?? { starting: [], bench: [] };
      return {
        ...prev,
        [teamName]: updater(base),
      };
    });
  };

  const updateFootballRotationForTeam = (
    teamName: string,
    updater: (rotation: FootballRotation) => FootballRotation
  ) => {
    if (!teamName) return;
    setFootballRotationsByTeam((prev) => {
      const base = prev[teamName] ?? { formation: "4-3-3", assignments: {} };
      return {
        ...prev,
        [teamName]: updater(base),
      };
    });
  };

  const availableLineupPlayers = useMemo(
    () => lineupTeamPlayers.filter((player) => !startingLineup.includes(player.key) && !benchLineup.includes(player.key)),
    [lineupTeamPlayers, startingLineup, benchLineup]
  );

  useEffect(() => {
    if (!lineupTeam) return;
    updateLineupForTeam(lineupTeam, (lineupValue) => ({
      starting: lineupValue.starting.filter((key) => lineupTeamPlayerMap.has(key)),
      bench: lineupValue.bench.filter((key) => lineupTeamPlayerMap.has(key)),
    }));
  }, [lineupTeam, lineupTeamPlayerMap]);

  useEffect(() => {
    if (!lineupTeam || !isFootballSport) return;

    updateFootballRotationForTeam(lineupTeam, (rotation) => {
      const validAssignments = Object.entries(rotation.assignments || {}).reduce<Record<string, string>>((acc, [positionKey, playerKey]) => {
        if (lineupTeamPlayerMap.has(playerKey) && startingLineupKeySet.has(playerKey)) {
          acc[positionKey] = playerKey;
        }
        return acc;
      }, {});

      return {
        formation: rotation.formation || "4-3-3",
        assignments: validAssignments,
      };
    });
  }, [isFootballSport, lineupTeam, lineupTeamPlayerMap, startingLineupKeySet]);

  const addPlayerToStarting = (key: string) => {
    if (!lineupTeam) return;
    updateLineupForTeam(lineupTeam, (lineupValue) => ({
      bench: lineupValue.bench.filter((id) => id !== key),
      starting: lineupValue.starting.includes(key) ? lineupValue.starting : [...lineupValue.starting, key],
    }));
  };

  const addPlayerToBench = (key: string) => {
    if (!lineupTeam) return;
    updateLineupForTeam(lineupTeam, (lineupValue) => ({
      starting: lineupValue.starting.filter((id) => id !== key),
      bench: lineupValue.bench.includes(key) ? lineupValue.bench : [...lineupValue.bench, key],
    }));
  };

  const removePlayerFromLineup = (key: string) => {
    if (!lineupTeam) return;
    updateLineupForTeam(lineupTeam, (lineupValue) => ({
      starting: lineupValue.starting.filter((id) => id !== key),
      bench: lineupValue.bench.filter((id) => id !== key),
    }));
  };

  const insertAtIndex = (list: string[], key: string, targetIndex?: number) => {
    const withoutKey = list.filter((id) => id !== key);
    if (targetIndex === undefined || targetIndex < 0 || targetIndex > withoutKey.length) {
      return [...withoutKey, key];
    }
    return [...withoutKey.slice(0, targetIndex), key, ...withoutKey.slice(targetIndex)];
  };

  const handleLineupDragStart = (key: string) => {
    setDraggedLineupPlayerKey(key);
  };

  const clearLineupDragState = () => {
    setDraggedLineupPlayerKey(null);
  };

  const dropLineupPlayer = (target: "available" | "starting" | "bench", targetIndex?: number) => {
    if (!draggedLineupPlayerKey) return;

    if (target === "available") {
      if (!lineupTeam) return;
      updateLineupForTeam(lineupTeam, (lineupValue) => ({
        starting: lineupValue.starting.filter((id) => id !== draggedLineupPlayerKey),
        bench: lineupValue.bench.filter((id) => id !== draggedLineupPlayerKey),
      }));
      clearLineupDragState();
      return;
    }

    if (target === "starting") {
      if (!lineupTeam) return;
      updateLineupForTeam(lineupTeam, (lineupValue) => ({
        bench: lineupValue.bench.filter((id) => id !== draggedLineupPlayerKey),
        starting: insertAtIndex(lineupValue.starting, draggedLineupPlayerKey, targetIndex),
      }));
      clearLineupDragState();
      return;
    }

    if (!lineupTeam) return;
    updateLineupForTeam(lineupTeam, (lineupValue) => ({
      starting: lineupValue.starting.filter((id) => id !== draggedLineupPlayerKey),
      bench: insertAtIndex(lineupValue.bench, draggedLineupPlayerKey, targetIndex),
    }));
    clearLineupDragState();
  };

  const publishBuiltLineup = () => {
    const starterNames = startingLineup
      .map((key) => lineupTeamPlayerMap.get(key))
      .filter(Boolean)
      .map((player) => `${player?.firstName} ${player?.lastName} #${player?.number || "-"}`)
      .join(", ");

    const benchNames = benchLineup
      .map((key) => lineupTeamPlayerMap.get(key))
      .filter(Boolean)
      .map((player) => `${player?.firstName} ${player?.lastName} #${player?.number || "-"}`)
      .join(", ");

    const lineupText = `${lineupTeam}\nAvaus: ${starterNames || "-"}\nVaihtopelaajat: ${benchNames || "-"}`;
    setLineup(lineupText);
    saveTeamSetup(lineupTeam);
    triggerLineup(lineupText);
  };

  const saveTeamSetup = (teamName = lineupTeam) => {
    if (!teamName || typeof window === "undefined") return;

    localStorage.setItem(lineupsStorageKey, JSON.stringify(lineupsByTeam));
    localStorage.setItem(footballRotationsStorageKey, JSON.stringify(footballRotationsByTeam));

    relayEngineMessage({
      type: "teamSetupUpdated",
      source: "control-room",
      sport,
      teamName,
      savedAt: Date.now(),
    });
  };

  const setFootballFormation = (formationKey: string) => {
    if (!lineupTeam) return;
    updateFootballRotationForTeam(lineupTeam, (rotation) => {
      const formation = FOOTBALL_FORMATIONS.find((item) => item.key === formationKey) || FOOTBALL_FORMATIONS[0];
      const validPositions = new Set(formation.positions.map((_, idx) => `${formation.key}-${idx}`));
      const filteredAssignments = Object.entries(rotation.assignments || {}).reduce<Record<string, string>>((acc, [positionKey, playerKey]) => {
        if (validPositions.has(positionKey)) {
          acc[positionKey] = playerKey;
        }
        return acc;
      }, {});

      return {
        formation: formation.key,
        assignments: filteredAssignments,
      };
    });
  };

  const setFootballRotationPlayer = (positionKey: string, playerKey: string) => {
    if (!lineupTeam) return;
    updateFootballRotationForTeam(lineupTeam, (rotation) => {
      const nextAssignments = { ...rotation.assignments };

      // Keep a player in only one position at a time.
      Object.keys(nextAssignments).forEach((key) => {
        if (nextAssignments[key] === playerKey) {
          delete nextAssignments[key];
        }
      });

      if (!playerKey) {
        delete nextAssignments[positionKey];
      } else {
        nextAssignments[positionKey] = playerKey;
      }

      return {
        ...rotation,
        assignments: nextAssignments,
      };
    });
  };

  const publishFootballRotation = () => {
    if (!lineupTeam) return;

    const rotationRows = footballFormation.positions.map((role, index) => {
      const positionKey = `${footballFormation.key}-${index}`;
      const player = lineupTeamPlayerMap.get(footballRotationAssignments[positionKey] || "");
      return `${role}: ${player ? `${player.firstName} ${player.lastName} #${player.number || "-"}` : "-"}`;
    });

    const rotationText = `${lineupTeam} - Avausrotaatio ${footballFormation.key}\n${rotationRows.join("\n")}`;
    setLineup(rotationText);
    saveTeamSetup(lineupTeam);
    triggerLineup(rotationText);
  };

  if (!syncReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-gray-600">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm font-medium">Ladataan tietoja palvelimelta…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 text-gray-900">
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <motion.h1 
              className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {sport} Control Room
            </motion.h1>
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
              value={sport}
              onChange={(e) => router.push(`/${e.target.value}/admin`)}
            >
              {availableSports.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex items-center gap-3"
          >
            <Button variant="outline" className="hover:bg-blue-50">Asetukset</Button>
            {onLogout && (
              <Button
                variant="outline"
                className="hover:bg-red-50 text-red-600 border-red-200"
                onClick={onLogout}
              >
                Kirjaudu ulos
              </Button>
            )}
          </motion.div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-12 space-y-6 lg:space-y-12">
        <motion.div 
          className="flex flex-col gap-6 lg:gap-8 lg:grid lg:grid-cols-[240px_1fr]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Sidebar
            subtitle="MANAGE"
            title="ASSETS"
            activeKey={activeTab}
            onSelect={(key) => setActiveTab(key as "leagues" | "players" | "teams" | "matches" | "overlays")}
            items={[
              { key: "leagues", label: "Sarja" },
              { key: "players", label: "Pelaaja" },
              { key: "teams", label: "Joukkue" },
              { key: "matches", label: "Ottelut" },
              { key: "overlays", label: "Overlayt" },
            ]}
          />











          <main className="space-y-6">
            {activeTab === "players" && (
              <>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase">Pelaajat</p>
                <h2 className="text-3xl font-bold text-gray-900">Pelaajan hallinta</h2>
                <p className="mt-1 text-sm text-gray-600">Lisää, muokkaa ja hallinnoi pelaajia nopeasti.</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  placeholder="Etsi pelaajia..."
                  className="w-full sm:min-w-[240px]"
                />
                <select
                  className="w-full sm:auto rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                >
                  <option value="">Kaikki joukkueet</option>
                  {teams.map((t, idx) => (
                    <option key={idx} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  className="hover:bg-gray-50 w-full sm:w-auto"
                  onClick={() => importInputRef.current?.click()}
                >
                  Tuo pelaajat
                </Button>
                <Button onClick={openPlayerModal} className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto">
                  Lisää pelaaja
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <motion.button
                className="group flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={openPlayerModal}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                  <span className="text-2xl font-bold">+</span>
                </div>
                <p className="mt-4 font-semibold text-gray-700">Luo pelaaja</p>
                <p className="mt-1 text-xs text-gray-500">Lisää uusi pelaaja joukkueeseen</p>
              </motion.button>

              {filteredPlayers.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
                  <p className="text-sm font-semibold text-gray-700">Ei pelaajia</p>
                  <p className="mt-1 text-sm text-gray-500">Lisää ensimmäinen pelaaja painamalla &#34;Lisää pelaaja&#34; -painiketta.</p>
                </div>
              ) : (
                filteredPlayers.map((p, i) => (
                  <motion.div
                    key={i}
                    className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i }}
                  >
                    <div className="p-6">
                      <div className="flex items-center gap-4">
                        <img
                          src={getPlayerPhoto(p.photo)}
                          alt={`${p.firstName} ${p.lastName}`}
                          className="h-14 w-14 rounded-full border border-gray-200 object-cover"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">{p.firstName} {p.lastName}</p>
                          <p className="text-sm text-gray-500">#{p.number} • {p.team}</p>
                          {p.position ? (
                            <p className="mt-0.5 text-xs font-medium text-indigo-600">{p.position}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Button
                          onClick={() => startEditingPlayer(i)}
                          size="sm"
                          className="bg-yellow-500 hover:bg-yellow-600"
                        >
                          Muokkaa
                        </Button>
                        <Button
                          onClick={() => removePlayer(i)}
                          size="sm"
                          variant="destructive"
                          className="hover:bg-red-700"
                        >
                          Poista
                        </Button>
                      </div>
                    </div>
                    {p.photo && (
                      <div className="absolute right-0 top-0 h-24 w-24">
                        <img src={p.photo} alt="" className="h-full w-full object-cover opacity-30" />
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>

            <input
              ref={importInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportPlayers}
            />

            </>)}

            {activeTab === "overlays" && (
              <>
                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase">Overlayt</p>
                    <h2 className="text-3xl font-bold text-gray-900">Overlay-paketit</h2>
                    <p className="mt-1 text-sm text-gray-600">Valitse visuaalinen tyyli lähetykseen. Paketki vaikuttaa scorebugiin, maaligrafiikkaan, lower third- ja fullscreen-overlayteihin.</p>
                  </div>
                  <a
                    href="/overlay"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
                  >
                    Avaa lähetysikkuna ↗
                  </a>
                </div>

                {/* Active package badge */}
                <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                  <span className="text-xs font-semibold uppercase text-gray-500">Aktiivinen paketti:</span>
                  <span className="text-sm font-bold text-gray-900">
                    {activeOverlayStyle === "classic-dark" && "Classic Dark"}
                    {activeOverlayStyle === "modern-blue" && "Modern Blue"}
                    {activeOverlayStyle === "neon-sport" && "Neon Sport"}
                    {activeOverlayStyle === "ligr-pro" && "LIGR Pro"}
                  </span>
                </div>

                {/* Package cards */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">

                  {/* Classic Dark */}
                  <div className={`rounded-2xl border-2 overflow-hidden transition-all ${activeOverlayStyle === "classic-dark" ? "border-yellow-500 shadow-lg" : "border-gray-200"}`}>
                    {/* Preview */}
                    <div style={{ background: "#0d0d1a", padding: "20px 16px 14px" }}>
                      <div style={{ border: "1px solid #c0a060", borderRadius: 4, display: "flex", alignItems: "stretch", overflow: "hidden" }}>
                        <div style={{ padding: "8px 12px", flex: 1 }}>
                          <div style={{ color: "rgba(192,160,96,0.75)", fontSize: 9, letterSpacing: "0.15em" }}>HOME</div>
                          <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, lineHeight: 1 }}>2</div>
                        </div>
                        <div style={{ width: 1, background: "rgba(192,160,96,0.35)", margin: "6px 0" }} />
                        <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                          <div style={{ color: "#c0a060", fontSize: 9, letterSpacing: "0.15em", fontWeight: 700 }}>1. JAKSO</div>
                          <div style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>38:14</div>
                        </div>
                        <div style={{ width: 1, background: "rgba(192,160,96,0.35)", margin: "6px 0" }} />
                        <div style={{ padding: "8px 12px", flex: 1, textAlign: "right" }}>
                          <div style={{ color: "rgba(192,160,96,0.75)", fontSize: 9, letterSpacing: "0.15em" }}>AWAY</div>
                          <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, lineHeight: 1 }}>1</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, padding: "6px 10px", background: "rgba(13,13,26,0.97)", borderLeft: "4px solid #c0a060" }}>
                        <div style={{ color: "#c0a060", fontSize: 8, letterSpacing: "0.2em" }}>INFO</div>
                        <div style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>#9 Etunimi Sukunimi</div>
                      </div>
                    </div>
                    {/* Info */}
                    <div className="bg-white p-4">
                      <p className="font-bold text-gray-900">Classic Dark</p>
                      <p className="text-xs text-gray-500 mt-1">Tumma taustaväri kultaisilla korostuksilla. Elegantti ja klassinen urheilulähetystyyli.</p>
                      <Button
                        onClick={() => activateOverlayPackage("classic-dark")}
                        className={`mt-3 w-full text-sm ${activeOverlayStyle === "classic-dark" ? "bg-yellow-600 hover:bg-yellow-700" : "bg-gray-800 hover:bg-gray-700"}`}
                      >
                        {activeOverlayStyle === "classic-dark" ? "✓ Aktiivinen" : "Aktivoi"}
                      </Button>
                    </div>
                  </div>

                  {/* Modern Blue */}
                  <div className={`rounded-2xl border-2 overflow-hidden transition-all ${activeOverlayStyle === "modern-blue" ? "border-blue-500 shadow-lg" : "border-gray-200"}`}>
                    <div style={{ background: "#002060", padding: "20px 16px 14px" }}>
                      <div style={{ background: "#003087", display: "flex", alignItems: "stretch", overflow: "hidden", borderRadius: 6 }}>
                        <div style={{ padding: "8px 12px", flex: 1 }}>
                          <div style={{ color: "rgba(122,180,255,0.8)", fontSize: 9, letterSpacing: "0.15em" }}>HOME</div>
                          <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, lineHeight: 1 }}>2</div>
                        </div>
                        <div style={{ width: 1, background: "rgba(122,180,255,0.35)", margin: "6px 0" }} />
                        <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                          <div style={{ color: "#7ab4ff", fontSize: 9, letterSpacing: "0.15em", fontWeight: 700 }}>1. JAKSO</div>
                          <div style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>38:14</div>
                        </div>
                        <div style={{ width: 1, background: "rgba(122,180,255,0.35)", margin: "6px 0" }} />
                        <div style={{ padding: "8px 12px", flex: 1, textAlign: "right" }}>
                          <div style={{ color: "rgba(122,180,255,0.8)", fontSize: 9, letterSpacing: "0.15em" }}>AWAY</div>
                          <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, lineHeight: 1 }}>1</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, padding: "6px 10px", background: "rgba(0,48,135,0.97)", borderLeft: "4px solid #7ab4ff" }}>
                        <div style={{ color: "#7ab4ff", fontSize: 8, letterSpacing: "0.2em" }}>INFO</div>
                        <div style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>#9 Etunimi Sukunimi</div>
                      </div>
                    </div>
                    <div className="bg-white p-4">
                      <p className="font-bold text-gray-900">Modern Blue</p>
                      <p className="text-xs text-gray-500 mt-1">Tumma sininen kansainvälisessä sarjatyylissä. UEFA / FIFA -henkinen paketti.</p>
                      <Button
                        onClick={() => activateOverlayPackage("modern-blue")}
                        className={`mt-3 w-full text-sm ${activeOverlayStyle === "modern-blue" ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-800 hover:bg-gray-700"}`}
                      >
                        {activeOverlayStyle === "modern-blue" ? "✓ Aktiivinen" : "Aktivoi"}
                      </Button>
                    </div>
                  </div>

                  {/* Neon Sport */}
                  <div className={`rounded-2xl border-2 overflow-hidden transition-all ${activeOverlayStyle === "neon-sport" ? "border-green-400 shadow-lg" : "border-gray-200"}`}>
                    <div style={{ background: "#0a0a0a", padding: "20px 16px 14px" }}>
                      <div style={{ background: "#060606", border: "1px solid #00ff88", display: "flex", alignItems: "stretch", overflow: "hidden", borderRadius: 2 }}>
                        <div style={{ padding: "8px 12px", flex: 1 }}>
                          <div style={{ color: "rgba(0,255,136,0.65)", fontSize: 9, letterSpacing: "0.15em" }}>HOME</div>
                          <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, lineHeight: 1 }}>2</div>
                        </div>
                        <div style={{ width: 1, background: "rgba(0,255,136,0.25)", margin: "6px 0" }} />
                        <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                          <div style={{ color: "#00ff88", fontSize: 9, letterSpacing: "0.15em", fontWeight: 700 }}>1. JAKSO</div>
                          <div style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>38:14</div>
                        </div>
                        <div style={{ width: 1, background: "rgba(0,255,136,0.25)", margin: "6px 0" }} />
                        <div style={{ padding: "8px 12px", flex: 1, textAlign: "right" }}>
                          <div style={{ color: "rgba(0,255,136,0.65)", fontSize: 9, letterSpacing: "0.15em" }}>AWAY</div>
                          <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, lineHeight: 1 }}>1</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, padding: "6px 10px", background: "rgba(6,6,6,0.98)", borderLeft: "4px solid #00ff88" }}>
                        <div style={{ color: "#00ff88", fontSize: 8, letterSpacing: "0.2em" }}>INFO</div>
                        <div style={{ color: "#00ff88", fontSize: 12, fontWeight: 800 }}>#9 Etunimi Sukunimi</div>
                      </div>
                    </div>
                    <div className="bg-white p-4">
                      <p className="font-bold text-gray-900">Neon Sport</p>
                      <p className="text-xs text-gray-500 mt-1">Musta pohja neonvihreillä korostuksilla. Räväkkä e-sports- ja modernin urheilun tyyli.</p>
                      <Button
                        onClick={() => activateOverlayPackage("neon-sport")}
                        className={`mt-3 w-full text-sm ${activeOverlayStyle === "neon-sport" ? "bg-green-600 hover:bg-green-700" : "bg-gray-800 hover:bg-gray-700"}`}
                      >
                        {activeOverlayStyle === "neon-sport" ? "✓ Aktiivinen" : "Aktivoi"}
                      </Button>
                    </div>
                  </div>

                  {/* LIGR Pro */}
                  <div className={`rounded-2xl border-2 overflow-hidden transition-all ${activeOverlayStyle === "ligr-pro" ? "border-red-500 shadow-lg" : "border-gray-200"}`}>
                    <div style={{ background: "#111", padding: "20px 16px 14px" }}>
                      <div style={{ background: "#1c1c1c", border: "2px solid #e84040", display: "flex", alignItems: "stretch", overflow: "hidden", borderRadius: 3 }}>
                        <div style={{ padding: "8px 12px", flex: 1 }}>
                          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, letterSpacing: "0.15em" }}>HOME</div>
                          <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, lineHeight: 1 }}>2</div>
                        </div>
                        <div style={{ width: 1, background: "rgba(232,64,64,0.4)", margin: "6px 0" }} />
                        <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                          <div style={{ color: "#e84040", fontSize: 9, letterSpacing: "0.15em", fontWeight: 700 }}>1. JAKSO</div>
                          <div style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>38:14</div>
                        </div>
                        <div style={{ width: 1, background: "rgba(232,64,64,0.4)", margin: "6px 0" }} />
                        <div style={{ padding: "8px 12px", flex: 1, textAlign: "right" }}>
                          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, letterSpacing: "0.15em" }}>AWAY</div>
                          <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, lineHeight: 1 }}>1</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, padding: "6px 10px", background: "rgba(28,28,28,0.98)", borderLeft: "4px solid #e84040" }}>
                        <div style={{ color: "#e84040", fontSize: 8, letterSpacing: "0.2em" }}>INFO</div>
                        <div style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>#9 Etunimi Sukunimi</div>
                      </div>
                    </div>
                    <div className="bg-white p-4">
                      <p className="font-bold text-gray-900">LIGR Pro</p>
                      <p className="text-xs text-gray-500 mt-1">Tummanharmaa pohja punaisilla korosteilla. Ammattimainen live-lähetystyyli.</p>
                      <Button
                        onClick={() => activateOverlayPackage("ligr-pro")}
                        className={`mt-3 w-full text-sm ${activeOverlayStyle === "ligr-pro" ? "bg-red-600 hover:bg-red-700" : "bg-gray-800 hover:bg-gray-700"}`}
                      >
                        {activeOverlayStyle === "ligr-pro" ? "✓ Aktiivinen" : "Aktivoi"}
                      </Button>
                    </div>
                  </div>

                </div>
              </>
            )}

            {activeTab === "teams" && (
              <>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase">Joukkueet</p>
                    <h2 className="text-3xl font-bold text-gray-900">Joukkueiden hallinta</h2>
                    <p className="mt-1 text-sm text-gray-600">Lisää, muokkaa ja seuraa joukkueita nopeasti.</p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center w-full sm:w-auto">
                    <Input
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      placeholder="Etsi joukkueita..."
                      className="w-full sm:min-w-[240px]"
                    />
                    <Button
                      onClick={() => setTeamModalOpen(true)}
                      className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                    >
                      Lisää joukkue
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <motion.button
                    className="group flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    onClick={() => setTeamModalOpen(true)}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600 group-hover:bg-green-100">
                      <span className="text-2xl font-bold">+</span>
                    </div>
                    <p className="mt-4 font-semibold text-gray-700">Luo joukkue</p>
                    <p className="mt-1 text-xs text-gray-500">Lisää uusi joukkue yhteen tai useampaan sarjaan</p>
                  </motion.button>

                  {filteredTeams.length === 0 ? (
                    <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
                      <p className="text-sm font-semibold text-gray-700">Ei joukkueita</p>
                      <p className="mt-1 text-sm text-gray-500">Lisää ensimmäinen joukkue painamalla &#39;Lisää joukkue&#39; -painiketta.</p>
                    </div>
                  ) : (
                    filteredTeams.map((t, i) => (
                        <motion.div
                          key={i}
                          className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 * i }}
                        >
                          <div className="p-6">
                            <div className="flex items-center gap-4">
                              <img
                                src={t.logo}
                                alt={t.name}
                                className="h-14 w-14 rounded-full border border-gray-200 object-cover"
                              />
                              <div>
                                <p className="font-semibold text-gray-900">{t.name}</p>
                                <p className="text-sm text-gray-500">{t.leagues.length ? t.leagues.join(", ") : "Ei sarjaa"}</p>
                                {(t.background.headCoach || t.background.manager || t.background.others) ? (
                                  <p className="mt-1 text-xs text-gray-600">
                                    {t.background.headCoach ? `Päävalmentaja: ${t.background.headCoach}` : ""}
                                    {t.background.headCoach && t.background.manager ? " • " : ""}
                                    {t.background.manager ? `Huoltaja: ${t.background.manager}` : ""}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-4">
                              <Button
                                size="sm"
                                variant="outline"
                                className="hover:bg-gray-50"
                                onClick={() => setExpandedTeamName((prev) => (prev === t.name ? null : t.name))}
                              >
                                {expandedTeamName === t.name ? "Piilota pelaajat" : `Näytä pelaajat (${players.filter((p) => p.team === t.name).length})`}
                              </Button>
                              {expandedTeamName === t.name && (
                                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                                  {players.filter((p) => p.team === t.name).length === 0 ? (
                                    <p className="text-sm text-gray-500">Joukkueelle ei ole lisätty pelaajia.</p>
                                  ) : (
                                    <ul className="space-y-1 text-sm text-gray-700">
                                      {players
                                        .filter((p) => p.team === t.name)
                                        .map((p, idx) => (
                                          <li key={`${p.firstName}-${p.lastName}-${idx}`}>
                                            #{p.number || "-"} {p.firstName} {p.lastName}
                                          </li>
                                        ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="mt-5 flex flex-wrap gap-2">
                              <Button
                                onClick={() => openTeamImport(t.name)}
                                size="sm"
                                variant="outline"
                                className="hover:bg-gray-50"
                              >
                                Tuo pelaajat joukkueeseen
                              </Button>
                              <Button
                                onClick={() => startEditingTeam(i)}
                                size="sm"
                                className="bg-yellow-500 hover:bg-yellow-600"
                              >
                                Muokkaa
                              </Button>
                              <Button
                                onClick={() => removeTeam(i)}
                                size="sm"
                                variant="destructive"
                                className="hover:bg-red-700"
                              >
                                Poista
                              </Button>
                            </div>
                          </div>
                          {t.logo && (
                            <div className="absolute right-0 top-0 h-24 w-24">
                              <img src={t.logo} alt="" className="h-full w-full object-cover opacity-30" />
                            </div>
                          )}
                        </motion.div>
                      ))
                  )}
                </div>
                <input
                  ref={teamImportInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleImportPlayersToTeam}
                />

                <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase text-gray-500">Kokoonpano</p>
                      <h3 className="text-2xl font-bold text-gray-900">Avaus ja vaihtopelaajat</h3>
                      <p className="mt-1 text-sm text-gray-600">Valitse joukkue ja rakenna kokoonpano pelaajista.</p>
                    </div>
                    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                      <select
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                        value={lineupTeam}
                        onChange={(e) => setLineupTeam(e.target.value)}
                      >
                        <option value="">Valitse joukkue</option>
                        {teams.map((team, idx) => (
                          <option key={`${team.name}-${idx}`} value={team.name}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        className="hover:bg-gray-50"
                        onClick={() => {
                          if (!lineupTeam) return;
                          updateLineupForTeam(lineupTeam, () => ({ starting: [], bench: [] }));
                        }}
                        disabled={!lineupTeam}
                      >
                        Tyhjennä
                      </Button>
                      <Button
                        variant="outline"
                        className="hover:bg-gray-50"
                        onClick={() => saveTeamSetup(lineupTeam)}
                        disabled={!lineupTeam}
                      >
                        Tallenna
                      </Button>
                      <Button
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={publishBuiltLineup}
                        disabled={!lineupTeam}
                      >
                        Lähetä kokoonpano
                      </Button>
                    </div>
                  </div>

                  {!lineupTeam ? (
                    <p className="mt-6 text-sm text-gray-500">Valitse joukkue nähdäksesi pelaajat henkilöittäin.</p>
                  ) : (
                    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <h4 className="text-sm font-semibold text-gray-700">Joukkueen pelaajat</h4>
                        <div
                          className="mt-3 space-y-2"
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            dropLineupPlayer("available");
                          }}
                        >
                          {availableLineupPlayers.length === 0 ? (
                            <p className="text-sm text-gray-500">Ei vapaita pelaajia lisättäväksi.</p>
                          ) : (
                            availableLineupPlayers.map((player) => (
                              <div
                                key={player.key}
                                className="rounded-lg border border-gray-200 bg-white p-3"
                                draggable
                                onDragStart={() => handleLineupDragStart(player.key)}
                                onDragEnd={clearLineupDragState}
                              >
                                <p className="font-medium text-gray-900">{player.firstName} {player.lastName}</p>
                                <p className="text-xs text-gray-500">#{player.number || "-"}</p>
                                <div className="mt-2 flex gap-2">
                                  <Button size="sm" onClick={() => addPlayerToStarting(player.key)} className="bg-indigo-600 hover:bg-indigo-700">Avaus</Button>
                                  <Button size="sm" variant="outline" onClick={() => addPlayerToBench(player.key)} className="hover:bg-gray-50">Vaihto</Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <h4 className="text-sm font-semibold text-gray-700">Avauskokoonpano ({startingLineup.length})</h4>
                        <div
                          className="mt-3 space-y-2"
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            dropLineupPlayer("starting");
                          }}
                        >
                          {startingLineup.length === 0 ? (
                            <p className="text-sm text-gray-500">Ei avauspelaajia valittuna.</p>
                          ) : (
                            startingLineup.map((key, index) => {
                              const player = lineupTeamPlayerMap.get(key);
                              if (!player) return null;
                              return (
                                <div
                                  key={key}
                                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
                                  draggable
                                  onDragStart={() => handleLineupDragStart(key)}
                                  onDragEnd={clearLineupDragState}
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={(event) => {
                                    event.preventDefault();
                                    dropLineupPlayer("starting", index);
                                  }}
                                >
                                  <p className="text-sm font-medium text-gray-900">#{player.number || "-"} {player.firstName} {player.lastName}</p>
                                  <Button size="sm" variant="ghost" onClick={() => removePlayerFromLineup(key)}>Poista</Button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <h4 className="text-sm font-semibold text-gray-700">Vaihtopelaajat ({benchLineup.length})</h4>
                        <div
                          className="mt-3 space-y-2"
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            dropLineupPlayer("bench");
                          }}
                        >
                          {benchLineup.length === 0 ? (
                            <p className="text-sm text-gray-500">Ei vaihtopelaajia valittuna.</p>
                          ) : (
                            benchLineup.map((key, index) => {
                              const player = lineupTeamPlayerMap.get(key);
                              if (!player) return null;
                              return (
                                <div
                                  key={key}
                                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
                                  draggable
                                  onDragStart={() => handleLineupDragStart(key)}
                                  onDragEnd={clearLineupDragState}
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={(event) => {
                                    event.preventDefault();
                                    dropLineupPlayer("bench", index);
                                  }}
                                >
                                  <p className="text-sm font-medium text-gray-900">#{player.number || "-"} {player.firstName} {player.lastName}</p>
                                  <Button size="sm" variant="ghost" onClick={() => removePlayerFromLineup(key)}>Poista</Button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {isFootballSport && (
                  <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-sm font-semibold uppercase text-gray-500">Jalkapallo</p>
                        <h3 className="text-2xl font-bold text-gray-900">Avausrotaatio</h3>
                        <p className="mt-1 text-sm text-gray-600">Määritä roolikohtainen avausjoukkue valitulle joukkueelle.</p>
                      </div>
                      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                        <select
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                          value={footballFormation.key}
                          onChange={(e) => setFootballFormation(e.target.value)}
                          disabled={!lineupTeam}
                        >
                          {FOOTBALL_FORMATIONS.map((formation) => (
                            <option key={formation.key} value={formation.key}>
                              {formation.key}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="outline"
                          className="hover:bg-gray-50"
                          onClick={() => {
                            if (!lineupTeam) return;
                            updateFootballRotationForTeam(lineupTeam, (rotation) => ({
                              ...rotation,
                              assignments: {},
                            }));
                          }}
                          disabled={!lineupTeam}
                        >
                          Tyhjennä rotaatio
                        </Button>
                        <Button
                          variant="outline"
                          className="hover:bg-gray-50"
                          onClick={() => saveTeamSetup(lineupTeam)}
                          disabled={!lineupTeam}
                        >
                          Tallenna rotaatio
                        </Button>
                        <Button
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={publishFootballRotation}
                          disabled={!lineupTeam}
                        >
                          Lähetä avausrotaatio
                        </Button>
                      </div>
                    </div>

                    {!lineupTeam ? (
                      <p className="mt-6 text-sm text-gray-500">Valitse joukkue, jotta voit tehdä avausrotaation.</p>
                    ) : (
                      <>
                        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {footballFormation.positions.map((role, index) => {
                            const positionKey = `${footballFormation.key}-${index}`;
                            const selectedPlayerKey = footballRotationAssignments[positionKey] || "";

                            return (
                              <div key={positionKey} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                                <p className="text-xs font-semibold uppercase text-gray-500">Rooli {index + 1}</p>
                                <p className="text-sm font-semibold text-gray-800">{role}</p>
                                <select
                                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                                  value={selectedPlayerKey}
                                  onChange={(e) => setFootballRotationPlayer(positionKey, e.target.value)}
                                >
                                  <option value="">Ei pelaajaa</option>
                                    {startingLineupPlayers.map((player) => (
                                    <option key={player.key} value={player.key}>
                                      {player.firstName} {player.lastName} #{player.number || "-"}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                          <p className="text-sm font-semibold text-gray-700">Kenttävisualisointi ({footballFormation.key})</p>
                          <div className="mt-4 rounded-xl border border-emerald-300 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 p-3 shadow-inner">
                            <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-lg border-2 border-white/70 bg-gradient-to-b from-emerald-500 to-emerald-700">
                              <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.05)_0px,rgba(255,255,255,0.05)_22px,rgba(0,0,0,0.08)_22px,rgba(0,0,0,0.08)_44px)]" />
                              <div className="absolute inset-0">
                                <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-white/60" />
                                <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60" />
                                <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
                                <div className="absolute left-1/2 top-0 h-16 w-44 -translate-x-1/2 border-2 border-white/60 border-t-0" />
                                <div className="absolute left-1/2 top-0 h-8 w-20 -translate-x-1/2 border-2 border-white/60 border-t-0" />
                                <div className="absolute left-1/2 top-[13%] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/70" />
                                <div className="absolute left-1/2 bottom-0 h-16 w-44 -translate-x-1/2 border-2 border-white/60 border-b-0" />
                                <div className="absolute left-1/2 bottom-0 h-8 w-20 -translate-x-1/2 border-2 border-white/60 border-b-0" />
                                <div className="absolute left-1/2 bottom-[13%] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/70" />
                                <div className="absolute left-0 top-0 h-6 w-6 rounded-br-full border-r-2 border-b-2 border-white/60" />
                                <div className="absolute right-0 top-0 h-6 w-6 rounded-bl-full border-l-2 border-b-2 border-white/60" />
                                <div className="absolute left-0 bottom-0 h-6 w-6 rounded-tr-full border-r-2 border-t-2 border-white/60" />
                                <div className="absolute right-0 bottom-0 h-6 w-6 rounded-tl-full border-l-2 border-t-2 border-white/60" />
                              </div>

                              {(FOOTBALL_FORMATION_COORDS[footballFormation.key] || []).map((coord, index) => {
                                const role = footballFormation.positions[index];
                                const positionKey = `${footballFormation.key}-${index}`;
                                const player = lineupTeamPlayerMap.get(footballRotationAssignments[positionKey] || "");

                                return (
                                  <div
                                    key={positionKey}
                                    className="absolute -translate-x-1/2 -translate-y-1/2"
                                    style={{ left: `${coord.left}%`, top: `${coord.top}%` }}
                                  >
                                    <div className="w-20 rounded-xl border border-white/70 bg-white/90 px-2 py-1 text-center shadow-sm">
                                      <p className="text-[10px] font-bold text-gray-700">{role}</p>
                                      <p className="text-[10px] text-gray-900 leading-tight">
                                        {player ? `${player.firstName} ${player.lastName}` : "-"}
                                      </p>
                                      <p className="text-[10px] text-gray-500">{player ? `#${player.number || "-"}` : "Ei valittu"}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === "matches" && (
              <>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase">Ottelut</p>
                    <h2 className="text-3xl font-bold text-gray-900">Otteluiden hallinta</h2>
                    <p className="mt-1 text-sm text-gray-600">Luo otteluita joukkueiden välille ja säädä ottelukohtaisia asetuksia.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div>
                    <p className="text-sm font-semibold uppercase text-gray-500">Ottelut</p>
                    <h3 className="text-2xl font-bold text-gray-900">Luo ottelu joukkueiden välille</h3>
                    <p className="mt-1 text-sm text-gray-600">Valitse koti- ja vierasjoukkue sekä halutessasi sarja ja aloitusaika.</p>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <select
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                      value={newMatchHomeTeam}
                      onChange={(e) => setNewMatchHomeTeam(e.target.value)}
                    >
                      <option value="">Kotijoukkue</option>
                      {teams.map((team, idx) => (
                        <option key={`${team.name}-home-${idx}`} value={team.name}>
                          {team.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                      value={newMatchAwayTeam}
                      onChange={(e) => setNewMatchAwayTeam(e.target.value)}
                    >
                      <option value="">Vierasjoukkue</option>
                      {teams.map((team, idx) => (
                        <option key={`${team.name}-away-${idx}`} value={team.name}>
                          {team.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                      value={newMatchLeague}
                      onChange={(e) => setNewMatchLeague(e.target.value)}
                    >
                      <option value="">Sarja (valinnainen)</option>
                      {leagues.map((league, idx) => (
                        <option key={`${league.name}-match-${idx}`} value={league.name}>
                          {league.name}
                        </option>
                      ))}
                    </select>

                    <Input
                      type="datetime-local"
                      value={newMatchScheduledAt}
                      onChange={(e) => setNewMatchScheduledAt(e.target.value)}
                    />
                  </div>

                  {matchError ? <p className="mt-3 text-sm text-red-600">{matchError}</p> : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button onClick={addMatch} className="bg-blue-600 hover:bg-blue-700">
                      Lisää ottelu
                    </Button>
                  </div>

                  <div className="mt-6 space-y-3">
                    {matches.length === 0 ? (
                      <p className="text-sm text-gray-500">Ei luotuja otteluita.</p>
                    ) : (
                      matches.map((match) => {
                        const resolvedMatchId = match.matchId && match.matchId !== "undefined" && match.matchId !== "null"
                          ? match.matchId
                          : createThemeMatchId(match.homeTeam, match.awayTeam);
                        const productionUrlVersion = productionUrlVersionByMatchId[resolvedMatchId];
                        const homeTeamLogo = teams.find((team) => team.name === match.homeTeam)?.logo || "";
                        const awayTeamLogo = teams.find((team) => team.name === match.awayTeam)?.logo || "";
                        const matchLeagueLogo = leagues.find((league) => league.name === match.league)?.logo || "";
                        const versionQuery = productionUrlVersion ? `&v=${encodeURIComponent(productionUrlVersion)}` : "";
                        const venueQuery = match.venue && match.venue.trim().length > 0
                          ? `&venue=${encodeURIComponent(match.venue.trim())}`
                          : "";
                        const livescoreUrl = `/livescore?match=${encodeURIComponent(resolvedMatchId)}${versionQuery}`;
                        const overlayUrl = `/overlay?match=${encodeURIComponent(resolvedMatchId)}${versionQuery}${venueQuery}`;

                        return <div key={match.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
                                Theme Match ID: {resolvedMatchId}
                              </p>
                              <p className="font-semibold text-gray-900">{match.homeTeam} vs {match.awayTeam}</p>
                              <p className="text-sm text-gray-600">
                                {match.league ? `Sarja: ${match.league}` : "Sarjaa ei valittu"}
                                {match.scheduledAt ? ` • ${new Date(match.scheduledAt).toLocaleString()}` : " • Aikaa ei asetettu"}
                              </p>
                              <p className="text-xs text-gray-600">
                                Peliaika {match.matchTimeMinutes} min • Tauko / väliaika {match.halftimeMinutes} min ({String(Math.floor(match.halftimeMinutes)).padStart(2,"0")}:00) • {match.extraTimeEnabled ? `Jatkoaika ${match.extraTimeFirstHalfMinutes}+${match.extraTimeSecondHalfMinutes}` : "Ei jatkoaikaa"} • {match.penaltiesEnabled ? "Rankkarit" : "Ei rankkareita"} • {match.goldenGoalEnabled ? "Kultainen maali" : "Ei kultaista maalia"}
                              </p>
                              <p className="text-xs text-gray-600">
                                Erotuomari: {match.refereeName || "Ei asetettu"} • AET1: {match.aet1Name || "Ei asetettu"} • AET2: {match.aet2Name || "Ei asetettu"}
                              </p>
                              <p className="text-xs text-gray-600">
                                Tilastot: {match.collectedStats.length > 0
                                  ? match.collectedStats
                                      .map((key) => MATCH_STATS_OPTIONS.find((option) => option.key === key)?.label || key)
                                      .join(", ")
                                  : "Ei valittuja tilastoja"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={livescoreUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-100 transition-colors"
                              >
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                Open livescore ↗
                              </a>
                              <Button
                                size="sm"
                                variant="outline"
                                className="hover:bg-gray-50"
                                onClick={() => setEditingMatchId((prev) => (prev === match.id ? null : match.id))}
                              >
                                {editingMatchId === match.id ? "Sulje asetukset" : "Asetukset"}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => removeMatch(match.id)}>
                                Poista
                              </Button>
                            </div>
                          </div>

                          {editingMatchId === match.id && (
                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                              <Input
                                type="number"
                                value={String(match.matchTimeMinutes)}
                                onChange={(e) => {
                                  const value = Number.parseInt(e.target.value, 10);
                                  updateMatch(match.id, (current) => ({
                                    ...current,
                                    matchTimeMinutes: Number.isFinite(value) && value > 0 ? value : 90,
                                  }));
                                }}
                                placeholder="Peliaika (min)"
                              />
                              <div className="relative">
                                <Input
                                  type="number"
                                  value={String(match.halftimeMinutes)}
                                  onChange={(e) => {
                                    const value = Number.parseInt(e.target.value, 10);
                                    updateMatch(match.id, (current) => ({
                                      ...current,
                                      halftimeMinutes: Number.isFinite(value) && value >= 0 ? value : Math.round(current.matchTimeMinutes / 2),
                                    }));
                                  }}
                                  placeholder="Tauko / väliaika (min)"
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">
                                  {String(Math.floor(match.halftimeMinutes)).padStart(2, "0")}:00
                                </span>
                              </div>
                              <Input
                                type="number"
                                value={String(match.extraTimeFirstHalfMinutes)}
                                onChange={(e) => {
                                  const value = Number.parseInt(e.target.value, 10);
                                  updateMatch(match.id, (current) => ({
                                    ...current,
                                    extraTimeFirstHalfMinutes: Number.isFinite(value) && value >= 0 ? value : 15,
                                  }));
                                }}
                                placeholder="Jatkoaika 1 (min)"
                                disabled={!match.extraTimeEnabled}
                              />
                              <Input
                                type="number"
                                value={String(match.extraTimeSecondHalfMinutes)}
                                onChange={(e) => {
                                  const value = Number.parseInt(e.target.value, 10);
                                  updateMatch(match.id, (current) => ({
                                    ...current,
                                    extraTimeSecondHalfMinutes: Number.isFinite(value) && value >= 0 ? value : 15,
                                  }));
                                }}
                                placeholder="Jatkoaika 2 (min)"
                                disabled={!match.extraTimeEnabled}
                              />
                              <Input
                                value={match.rules}
                                onChange={(e) => updateMatch(match.id, (current) => ({ ...current, rules: e.target.value }))}
                                placeholder="Pelisäännöt"
                              />
                              <Input
                                value={match.venue || ""}
                                onChange={(e) => updateMatch(match.id, (current) => ({ ...current, venue: e.target.value }))}
                                placeholder="Stadion / Areena"
                              />
                              <Input
                                value={match.refereeName}
                                onChange={(e) => updateMatch(match.id, (current) => ({ ...current, refereeName: e.target.value }))}
                                placeholder="Erotuomarin nimi"
                              />
                              <Input
                                value={match.aet1Name}
                                onChange={(e) => updateMatch(match.id, (current) => ({ ...current, aet1Name: e.target.value }))}
                                placeholder="AET1"
                              />
                              <Input
                                value={match.aet2Name}
                                onChange={(e) => updateMatch(match.id, (current) => ({ ...current, aet2Name: e.target.value }))}
                                placeholder="AET2"
                              />

                              <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={match.extraTimeEnabled}
                                  onChange={(e) => updateMatch(match.id, (current) => ({ ...current, extraTimeEnabled: e.target.checked }))}
                                />
                                <span>Jatkoaika</span>
                              </label>
                              <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={match.penaltiesEnabled}
                                  onChange={(e) => updateMatch(match.id, (current) => ({ ...current, penaltiesEnabled: e.target.checked }))}
                                />
                                <span>Rangaistuspotkut</span>
                              </label>
                              <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={match.goldenGoalEnabled}
                                  onChange={(e) => updateMatch(match.id, (current) => ({ ...current, goldenGoalEnabled: e.target.checked }))}
                                />
                                <span>Kultainen maali</span>
                              </label>

                              <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-gray-200 bg-white p-3">
                                <p className="text-sm font-semibold text-gray-700">Kerattavat tilastot</p>
                                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                  {MATCH_STATS_OPTIONS.map((option) => (
                                    <label key={option.key} className="flex items-center gap-2 text-sm text-gray-700">
                                      <input
                                        type="checkbox"
                                        checked={match.collectedStats.includes(option.key)}
                                        onChange={(e) => {
                                          updateMatch(match.id, (current) => {
                                            const nextStats = e.target.checked
                                              ? Array.from(new Set([...current.collectedStats, option.key]))
                                              : current.collectedStats.filter((key) => key !== option.key);

                                            return {
                                              ...current,
                                              collectedStats: nextStats,
                                            };
                                          });
                                        }}
                                      />
                                      <span>{option.label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* Production links */}
                              <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
                                <p className="text-sm font-semibold text-blue-900">Tuotantolinkit</p>
                                <p className="mt-0.5 text-xs text-blue-700">Käytä näitä linkkejä OBS / vMix -browser source -lähteen tai tuotantotiimin jakamiseen.</p>
                                <div className="mt-3 space-y-2">
                                  {/* Overlay browser source */}
                                  <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2">
                                    <span className="shrink-0 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Browser Source</span>
                                    <code className="flex-1 truncate text-xs text-gray-700 font-mono select-all">
                                      {typeof window !== "undefined" ? `${window.location.origin}${overlayUrl}` : overlayUrl}
                                    </code>
                                    <button
                                      type="button"
                                      className="shrink-0 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                                      onClick={async () => {
                                        const url = typeof window !== "undefined" ? `${window.location.origin}${overlayUrl}` : overlayUrl;
                                        const copied = await copyToClipboard(url);
                                        if (copied) {
                                          setCopiedMatchId(match.id);
                                          setTimeout(() => setCopiedMatchId((prev) => (prev === match.id ? null : prev)), 2000);
                                        }
                                      }}
                                    >
                                      {copiedMatchId === match.id ? "✓ Kopioitu!" : "Kopioi"}
                                    </button>
                                    <button
                                      type="button"
                                      className="shrink-0 rounded-lg border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                                      onClick={() => {
                                        setProductionUrlVersionByMatchId((prev) => ({
                                          ...prev,
                                          [resolvedMatchId]: String(Date.now()),
                                        }));
                                      }}
                                    >
                                      Refresh URL
                                    </button>
                                    <a
                                      href={overlayUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="shrink-0 rounded-lg border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                                    >
                                      Avaa ↗
                                    </a>
                                  </div>
                                  {/* Control room link */}
                                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                                    <span className="shrink-0 rounded bg-gray-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Control Room</span>
                                    <code className="flex-1 truncate text-xs text-gray-700 font-mono select-all">
                                      {typeof window !== "undefined" ? window.location.href : ""}
                                    </code>
                                  </div>
                                </div>
                              </div>

                            </div>
                          )}
                        </div>;
                      })
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === "leagues" && (
              <>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase">Sarjat</p>
                    <h2 className="text-3xl font-bold text-gray-900">Sarjojen hallinta</h2>
                    <p className="mt-1 text-sm text-gray-600">Lisää ja muokkaa sarjoja.</p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center w-full sm:w-auto">
                    <Input
                      value={leagueSearch}
                      onChange={(e) => setLeagueSearch(e.target.value)}
                      placeholder="Etsi sarjoja..."
                      className="w-full sm:min-w-[240px]"
                    />
                    <Button onClick={addLeague} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                      Lisää sarja
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
                    <p className="text-sm font-semibold text-gray-700">{editingLeagueIndex !== null ? "Muokkaa sarjaa" : "Luo sarja"}</p>
                    <p className="mt-2 text-sm text-gray-500">Määritä sarjan nimi, logo ja pelisäännöt.</p>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input
                        placeholder="Sarjan nimi"
                        value={newLeague}
                        onChange={(e) => setNewLeague(e.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="Peliaika (min)"
                        value={newLeagueMatchTimeMinutes}
                        onChange={(e) => setNewLeagueMatchTimeMinutes(e.target.value)}
                      />
                      <label className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 cursor-pointer hover:border-blue-300 hover:bg-white">
                        <span>Lataa logo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLeagueLogoUpload}
                          className="hidden"
                        />
                      </label>
                      <Input
                        type="number"
                        placeholder="Jatkoaika 1 (min)"
                        value={newLeagueExtraTimeFirstHalfMinutes}
                        onChange={(e) => setNewLeagueExtraTimeFirstHalfMinutes(e.target.value)}
                        disabled={!newLeagueExtraTimeEnabled}
                      />
                      <Input
                        type="number"
                        placeholder="Jatkoaika 2 (min)"
                        value={newLeagueExtraTimeSecondHalfMinutes}
                        onChange={(e) => setNewLeagueExtraTimeSecondHalfMinutes(e.target.value)}
                        disabled={!newLeagueExtraTimeEnabled}
                      />
                    </div>

                    <textarea
                      className="mt-3 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-700"
                      placeholder="Pelisäännöt"
                      value={newLeagueRules}
                      onChange={(e) => setNewLeagueRules(e.target.value)}
                      rows={3}
                    />

                    <div className="mt-3 grid grid-cols-1 gap-2 text-left sm:grid-cols-3">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={newLeagueExtraTimeEnabled}
                          onChange={(e) => setNewLeagueExtraTimeEnabled(e.target.checked)}
                        />
                        <span>Jatkoaika</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={newLeaguePenaltiesEnabled}
                          onChange={(e) => setNewLeaguePenaltiesEnabled(e.target.checked)}
                        />
                        <span>Rangaistuspotkut</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={newLeagueGoldenGoalEnabled}
                          onChange={(e) => setNewLeagueGoldenGoalEnabled(e.target.checked)}
                        />
                        <span>Kultainen maali</span>
                      </label>
                    </div>

                    <Button onClick={addLeague} className="mt-4 w-full bg-blue-600 hover:bg-blue-700">
                      {editingLeagueIndex !== null ? "Tallenna sarja" : "Lisää sarja"}
                    </Button>
                    {editingLeagueIndex !== null && (
                      <Button onClick={resetLeagueForm} variant="outline" className="mt-2 w-full hover:bg-gray-50">
                        Peruuta muokkaus
                      </Button>
                    )}
                  </div>

                  {filteredLeagues.length === 0 ? (
                    <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
                      <p className="text-sm font-semibold text-gray-700">Ei sarjoja</p>
                      <p className="mt-1 text-sm text-gray-500">Lisää ensimmäinen sarja painamalla &#39;Lisää sarja&#39; -painiketta.</p>
                    </div>
                  ) : (
                    filteredLeagues.map((l, i) => (
                      <motion.div
                        key={i}
                        className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * i }}
                      >
                        <div className="p-6">
                          <div className="flex items-center gap-4">
                            {l.logo ? (
                              <img
                                src={l.logo}
                                alt={l.name}
                                className="h-14 w-14 rounded-full border border-gray-200 object-cover"
                              />
                            ) : null}
                            <div>
                              <p className="font-semibold text-gray-900">{l.name}</p>
                              <p className="text-xs text-gray-500">Peliaika: {l.matchTimeMinutes} min</p>
                              <p className="text-xs text-gray-500">
                                {l.extraTimeEnabled ? `Jatkoaika: ${l.extraTimeFirstHalfMinutes}+${l.extraTimeSecondHalfMinutes} min` : "Ei jatkoaikaa"} • {l.penaltiesEnabled ? "Rankkarit" : "Ei rankkareita"} • {l.goldenGoalEnabled ? "Kultainen maali" : "Ei kultaista maalia"}
                              </p>
                              {l.rules ? <p className="mt-1 text-xs text-gray-600">Säännöt: {l.rules}</p> : null}
                            </div>
                          </div>
                          <div className="mt-5 flex flex-wrap gap-2">
                            <Button
                              onClick={() => startEditingLeague(i)}
                              size="sm"
                              className="bg-yellow-500 hover:bg-yellow-600"
                            >
                              Muokkaa
                            </Button>
                            <Button
                              onClick={() => removeLeague(i)}
                              size="sm"
                              variant="destructive"
                              className="hover:bg-red-700"
                            >
                              Poista
                            </Button>
                          </div>
                        </div>
                        {l.logo && (
                          <div className="absolute right-0 top-0 h-24 w-24">
                            <img src={l.logo} alt="" className="h-full w-full object-cover opacity-30" />
                          </div>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </>
            )}
          </main>
        </motion.div>
      </section>

      {playerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <motion.div
            className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingPlayerIndex !== null ? "Muokkaa pelaajaa" : "Luo pelaaja"}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Syötä pelaajan tiedot ja lisää se joukkueeseen.
                </p>
              </div>
              <button
                aria-label="Sulje"
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                onClick={cancelEditing}
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Etunimi"
                placeholder="Esim. Teemu"
                value={newPlayerFirstName}
                onChange={(e) => setNewPlayerFirstName(e.target.value)}
              />
              <Input
                label="Sukunimi"
                placeholder="Esim. Selänne"
                value={newPlayerLastName}
                onChange={(e) => setNewPlayerLastName(e.target.value)}
              />
              <Input
                label="Pelinumero"
                placeholder="Esim. 23"
                value={newPlayerNumber}
                onChange={(e) => setNewPlayerNumber(e.target.value)}
              />
              <select
                className="bg-white border border-gray-300 p-3 rounded-lg"
                value={newPlayerPosition}
                onChange={(e) => setNewPlayerPosition(e.target.value as PlayerPosition | "")}
              >
                <option value="">Valitse pelipaikka</option>
                {PLAYER_POSITION_OPTIONS.map((positionOption) => (
                  <option key={positionOption} value={positionOption}>
                    {positionOption}
                  </option>
                ))}
              </select>
              <select
                className="col-span-full bg-white border border-gray-300 p-3 rounded-lg"
                value={playerTeam}
                onChange={(e) => setPlayerTeam(e.target.value)}
              >
                <option value="">Valitse joukkue</option>
                {teams.map((t, idx) => (
                  <option key={idx} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              <label className="col-span-full flex flex-col gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 cursor-pointer hover:border-blue-300 hover:bg-white">
                <span className="font-medium text-gray-700">Lataa kuva</span>
                <span className="text-xs text-gray-500">Taustan poisto toimii automaattisesti.</span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="sr-only" />
                {newPlayerPhoto && (
                  <img src={newPlayerPhoto} alt="Esikatselu" className="mt-3 h-28 w-full rounded-lg object-cover" />
                )}
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={cancelEditing} className="hover:bg-gray-50">
                Peruuta
              </Button>
              <Button onClick={addPlayer} className="bg-purple-600 hover:bg-purple-700">
                {editingPlayerIndex !== null ? "Tallenna" : "Lisää pelaaja"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {teamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <motion.div
            className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingTeamIndex !== null ? 'Muokkaa joukkuetta' : 'Luo joukkue'}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Syötä joukkueen nimi, valitse sarjat ja lataa logo.
                </p>
              </div>
              <button
                aria-label="Sulje"
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                onClick={cancelEditing}
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Nimi"
                placeholder="Joukkueen nimi"
                value={newTeam}
                onChange={(e) => setNewTeam(e.target.value)}
              />
              <Input
                label="Päävalmentaja"
                placeholder="Esim. Mikko Valmentaja"
                value={newTeamHeadCoach}
                onChange={(e) => setNewTeamHeadCoach(e.target.value)}
              />
              <Input
                label="Huoltaja"
                placeholder="Esim. Antti Huoltaja"
                value={newTeamManager}
                onChange={(e) => setNewTeamManager(e.target.value)}
              />
              <Input
                label="Muut"
                placeholder="Esim. Joukkueenjohtaja, fysioterapeutti"
                value={newTeamOthers}
                onChange={(e) => setNewTeamOthers(e.target.value)}
              />
              <div className="col-span-full rounded-lg border border-gray-300 bg-white p-3">
                <p className="mb-2 text-sm font-medium text-gray-700">Sarjat</p>
                {leagues.length === 0 ? (
                  <p className="text-sm text-gray-500">Ei sarjoja valittavaksi.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {leagues.map((l, idx) => (
                      <label key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={teamLeagues.includes(l.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTeamLeagues((prev) => [...prev, l.name]);
                            } else {
                              setTeamLeagues((prev) => prev.filter((name) => name !== l.name));
                            }
                          }}
                        />
                        <span>{l.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <label className="col-span-full flex flex-col gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 cursor-pointer hover:border-blue-300 hover:bg-white">
                <span className="font-medium text-gray-700">Lataa logo</span>
                <input type="file" accept="image/*" onChange={handleTeamLogoUpload} className="sr-only" />
                {newTeamLogo && (
                  <img src={newTeamLogo} alt="Esikatselu" className="mt-3 h-28 w-full rounded-lg object-cover" />
                )}
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={cancelEditing} className="hover:bg-gray-50">
                Peruuta
              </Button>
              <Button onClick={addTeam} className="bg-green-600 hover:bg-green-700">
                {editingTeamIndex !== null ? "Tallenna" : "Lisää joukkue"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}

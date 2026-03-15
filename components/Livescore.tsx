"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";

type LiveEvent = {
  id: string;
  type: "goal" | "yellow" | "red" | "sub" | "info";
  minute: string;
  text: string;
};

type TeamLineup = {
  starting: string[];
  bench: string[];
};

type RotationRow = {
  role: string;
  player: string;
};

type RosterPanelPayload = {
  visible: boolean;
  teamName: string;
  mode: "rotation" | "lineup";
  lineupOnly?: boolean;
  formation: string;
  rows: RotationRow[];
  starting: string[];
  bench: string[];
};

type HalftimeStatRow = {
  key: string;
  label: string;
  home: string;
  away: string;
};

type TeamSide = "home" | "away";

type SubstitutionPair = {
  outPlayer: string;
  inPlayer: string;
};

type PenaltyShootoutResult = "scored" | "missed";

type PenaltyShootoutAttempt = {
  player: string;
  result: PenaltyShootoutResult;
};

type GoalRecord = {
  player: string;
  side: TeamSide;
  minute: number;
};

type CardRecord = {
  player: string;
  side: TeamSide;
  cardType: "yellow" | "red";
  minute: number;
};

type SubstitutionRecord = {
  side: TeamSide;
  minute: number;
  pairs: SubstitutionPair[];
};

type PenaltyShootoutContext = {
  homeAttempts: PenaltyShootoutAttempt[];
  awayAttempts: PenaltyShootoutAttempt[];
};

type MatchStartContext = {
  homeStarting: string[];
  awayStarting: string[];
  homeGoalkeeper: string;
  awayGoalkeeper: string;
};

type StatCounterMap = Record<string, { home: number; away: number }>;

const EVENT_ICONS: Record<LiveEvent["type"], string> = {
  goal: "⚽",
  yellow: "🟨",
  red: "🟥",
  sub: "🔄",
  info: "ℹ️",
};

const ENGINE_RELAY_KEY = "ligr:engine-relay";
const PLAYER_MATCH_STATS_KEY = "ligr:player-match-stats";
const TEAM_MATCH_STATS_KEY = "ligr:team-match-stats";
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
const STAT_ICON_BY_KEY: Record<string, string> = {
  goals: "⚽",
  shots: "◎",
  shotsOnTarget: "◉",
  corners: "◜",
  fouls: "✱",
  yellowCards: "🟨",
  redCards: "🟥",
  penalties: "🎯",
  offsides: "⟂",
  saves: "🧤",
  substitutions: "🔄",
};
const DISPLAY_ONLY_STATS = new Set(["goals"]);
const MAX_MULTI_SUBSTITUTIONS = 5;
const MAX_PENALTY_SHOOTOUT_ATTEMPTS = 5;
const createEmptySubstitutionPair = (): SubstitutionPair => ({ outPlayer: "", inPlayer: "" });
const sanitizeClockPart = (value: string, maxValue: number) => {
  const digitsOnly = value.replace(/\D/g, "").slice(-2);
  if (!digitsOnly) return "00";
  return String(Math.min(maxValue, Number.parseInt(digitsOnly, 10) || 0)).padStart(2, "0");
};

const clockToMinute = (clockValue: string) => {
  const [minutes = "0", seconds = "0"] = clockValue.split(":");
  const minuteValue = Number.parseInt(minutes, 10);
  const secondValue = Number.parseInt(seconds, 10);
  if (!Number.isFinite(minuteValue) || minuteValue < 0) return 0;
  if (!Number.isFinite(secondValue) || secondValue < 0) return Math.max(0, minuteValue);
  return Math.max(0, minuteValue + (secondValue >= 30 ? 1 : 0));
};

const sanitizePositiveMinutes = (value: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return value >= 0 ? value : fallback;
};

const stripPlayerNumberSuffix = (name: string) => name.replace(/\s+#\d+\s*$/i, "").trim();

const splitPlayerName = (name: string) => {
  const clean = stripPlayerNumberSuffix(name);
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
};

export default function Livescore() {
  const searchParams = useSearchParams();
  const rawMatchId = (searchParams.get("match") || "").trim();
  const matchId = rawMatchId && rawMatchId !== "undefined" && rawMatchId !== "null" ? rawMatchId : "";
  const homeTeamFromQuery = (searchParams.get("homeTeam") || "").trim();
  const awayTeamFromQuery = (searchParams.get("awayTeam") || "").trim();
  const homeLogoFromQuery = (searchParams.get("homeLogo") || "").trim();
  const awayLogoFromQuery = (searchParams.get("awayLogo") || "").trim();
  const leagueLogoFromQuery = (searchParams.get("leagueLogo") || "").trim();

  const [homeTeam, setHomeTeam] = useState(homeTeamFromQuery || "HOME");
  const [awayTeam, setAwayTeam] = useState(awayTeamFromQuery || "AWAY");
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [period, setPeriod] = useState("1");
  const [clock, setClock] = useState("00:00");
  const [clockRunning, setClockRunning] = useState(false);
  const [homeLogo, setHomeLogo] = useState(homeLogoFromQuery);
  const [awayLogo, setAwayLogo] = useState(awayLogoFromQuery);
  const [leagueLogo, setLeagueLogo] = useState(leagueLogoFromQuery);
  const [homeKitColor, setHomeKitColor] = useState("#1a56db");
  const [awayKitColor, setAwayKitColor] = useState("#e53935");

  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [flashScore, setFlashScore] = useState(false);
  const [matchStarted, setMatchStarted] = useState(false);
  const [startFirstHalfConfirmOpen, setStartFirstHalfConfirmOpen] = useState(false);
  const [startSecondHalfConfirmOpen, setStartSecondHalfConfirmOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalDialogSide, setGoalDialogSide] = useState<TeamSide | null>(null);
  const [goalDialogOwnGoal, setGoalDialogOwnGoal] = useState(false);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [cardDialogSide, setCardDialogSide] = useState<TeamSide | null>(null);
  const [cardDialogType, setCardDialogType] = useState<"yellowCards" | "redCards">("yellowCards");
  const [substitutionDialogOpen, setSubstitutionDialogOpen] = useState(false);
  const [substitutionDialogSide, setSubstitutionDialogSide] = useState<TeamSide | null>(null);
  const [substitutionPairs, setSubstitutionPairs] = useState<SubstitutionPair[]>([createEmptySubstitutionPair()]);
  const [workflowPhase, setWorkflowPhase] = useState<"players-entered" | "about-to-start" | "first-half" | "end-first-half" | "prepare-second-half" | "second-half" | "second-half-ended" | "game-finished" | "extra-time-1" | "extra-time-2" | "penalties" | "golden-goal" | "match-ended">("players-entered");
  const [extraTimeEnabled, setExtraTimeEnabled] = useState(false);
  const [penaltiesEnabled, setPenaltiesEnabled] = useState(false);
  const [goldenGoalEnabled, setGoldenGoalEnabled] = useState(false);
  const [matchTimeMinutes, setMatchTimeMinutes] = useState(90);
  const [extraTimeFirstHalfMinutes, setExtraTimeFirstHalfMinutes] = useState(15);
  const [extraTimeSecondHalfMinutes, setExtraTimeSecondHalfMinutes] = useState(15);
  const [homePenaltyShootout, setHomePenaltyShootout] = useState<PenaltyShootoutAttempt[]>([]);
  const [awayPenaltyShootout, setAwayPenaltyShootout] = useState<PenaltyShootoutAttempt[]>([]);
  const [selectedHomePenaltyShooter, setSelectedHomePenaltyShooter] = useState("");
  const [selectedAwayPenaltyShooter, setSelectedAwayPenaltyShooter] = useState("");
  const [pregameSequenceStep, setPregameSequenceStep] = useState<"idle" | "away" | "home">("idle");
  const [pregameSequenceRunId, setPregameSequenceRunId] = useState(0);
  const [showHomeTeamRoster, setShowHomeTeamRoster] = useState(false);
  const [showAwayTeamRoster, setShowAwayTeamRoster] = useState(false);
  const [showRotationView, setShowRotationView] = useState(false);
  const [selectedMatchStats, setSelectedMatchStats] = useState<string[]>(DEFAULT_MATCH_STATS);
  const [statBoardCounts, setStatBoardCounts] = useState<StatCounterMap>({});
  const [homeLineup, setHomeLineup] = useState<TeamLineup>({ starting: [], bench: [] });
  const [awayLineup, setAwayLineup] = useState<TeamLineup>({ starting: [], bench: [] });
  const [homeRotation, setHomeRotation] = useState<{ formation: string; rows: RotationRow[] }>({ formation: "", rows: [] });
  const [awayRotation, setAwayRotation] = useState<{ formation: string; rows: RotationRow[] }>({ formation: "", rows: [] });
  const [goalRecords, setGoalRecords] = useState<GoalRecord[]>([]);
  const [cardRecords, setCardRecords] = useState<CardRecord[]>([]);
  const [substitutionRecords, setSubstitutionRecords] = useState<SubstitutionRecord[]>([]);
  const [matchStartContext, setMatchStartContext] = useState<MatchStartContext | null>(null);
  const engineChannelRef = useRef<BroadcastChannel | null>(null);
  const lastSentRelayTsRef = useRef(0);
  const halftimeStatsTimeoutRef = useRef<number | null>(null);
  const sendEngineMessage = (payload: Record<string, unknown>) => {
    const now = Date.now();
    const relayTs = now > lastSentRelayTsRef.current ? now : lastSentRelayTsRef.current + 1;
    lastSentRelayTsRef.current = relayTs;
    const message = { ...payload, relayTs };
    engineChannelRef.current?.postMessage(message);
    if (typeof window !== "undefined") {
      localStorage.setItem(ENGINE_RELAY_KEY, JSON.stringify(message));
    }
  };
  const broadcastPenaltyShootout = (
    homeAttempts: PenaltyShootoutAttempt[] = homePenaltyShootout,
    awayAttempts: PenaltyShootoutAttempt[] = awayPenaltyShootout,
  ) => {
    sendEngineMessage({
      type: "penaltyShootout",
      source: "livescore",
      matchId,
      homeAttempts: homeAttempts.slice(0, MAX_PENALTY_SHOOTOUT_ATTEMPTS),
      awayAttempts: awayAttempts.slice(0, MAX_PENALTY_SHOOTOUT_ATTEMPTS),
    });
  };
  const updateClockValue = (nextMinutes: string, nextSeconds: string, nextClockRunning = clockRunning) => {
    const safeMinutes = sanitizeClockPart(nextMinutes, 99);
    const safeSeconds = sanitizeClockPart(nextSeconds, 59);
    const nextClock = `${safeMinutes}:${safeSeconds}`;
    setClock(nextClock);
    broadcastScoreState(nextClock, nextClockRunning);
  };
  const adjustClockBySeconds = (deltaSeconds: number) => {
    const [minutes = "0", seconds = "0"] = clock.split(":");
    const totalSeconds = Math.max(0, (Number.parseInt(minutes, 10) || 0) * 60 + (Number.parseInt(seconds, 10) || 0) + deltaSeconds);
    const nextClock = `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
    setClock(nextClock);
    broadcastScoreState(nextClock, clockRunning);
  };
  const broadcastScoreState = (nextClock: string, nextClockRunning: boolean) => {
    sendEngineMessage({
      type: "score",
      source: "livescore",
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      period,
      clock: nextClock,
      clockRunning: nextClockRunning,
      homeKitColor,
      awayKitColor,
    });
  };
  const buildRosterPanel = (
    teamName: string,
    lineup: TeamLineup,
    rotation: { formation: string; rows: RotationRow[] },
    visible: boolean,
    preferredMode: "rotation" | "lineup",
  ): RosterPanelPayload => {
    const hasRotation = rotation.rows.length > 0;
    const mode = preferredMode === "rotation" && hasRotation ? "rotation" : "lineup";
    const lineupOnly = preferredMode === "rotation" && !hasRotation;

    return {
      visible,
      teamName,
      mode,
      lineupOnly,
      formation: rotation.formation,
      rows: mode === "rotation" ? rotation.rows : [],
      starting: lineup.starting,
      bench: lineup.bench,
    };
  };
  const getRosterOverlayPayload = () => {
    if (pregameSequenceStep === "away") {
      return {
        type: "teamRosterOverlay" as const,
        matchId,
        home: buildRosterPanel(homeTeam, homeLineup, homeRotation, false, "lineup"),
        away: buildRosterPanel(awayTeam, awayLineup, awayRotation, true, "rotation"),
      };
    }

    if (pregameSequenceStep === "home") {
      return {
        type: "teamRosterOverlay" as const,
        matchId,
        home: buildRosterPanel(homeTeam, homeLineup, homeRotation, true, "rotation"),
        away: buildRosterPanel(awayTeam, awayLineup, awayRotation, false, "lineup"),
      };
    }

    return {
      type: "teamRosterOverlay" as const,
      matchId,
      home: buildRosterPanel(homeTeam, homeLineup, homeRotation, showHomeTeamRoster, showRotationView ? "rotation" : "lineup"),
      away: buildRosterPanel(awayTeam, awayLineup, awayRotation, showAwayTeamRoster, showRotationView ? "rotation" : "lineup"),
    };
  };

  useEffect(() => {
    const channel = engineChannelRef.current;
    if (!channel) return;

    sendEngineMessage(getRosterOverlayPayload());
  }, [
    awayLineup.bench,
    awayLineup.starting,
    awayRotation.formation,
    awayRotation.rows,
    awayTeam,
    homeLineup.bench,
    homeLineup.starting,
    homeRotation.formation,
    homeRotation.rows,
    homeTeam,
    matchId,
    pregameSequenceStep,
    showAwayTeamRoster,
    showHomeTeamRoster,
    showRotationView,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const channel = engineChannelRef.current;
    if (!channel) return;

    const heartbeat = window.setInterval(() => {
      sendEngineMessage(getRosterOverlayPayload());
    }, 1500);

    return () => window.clearInterval(heartbeat);
  }, [
    awayLineup.bench,
    awayLineup.starting,
    awayRotation.formation,
    awayRotation.rows,
    awayTeam,
    homeLineup.bench,
    homeLineup.starting,
    homeRotation.formation,
    homeRotation.rows,
    homeTeam,
    matchId,
    pregameSequenceStep,
    showAwayTeamRoster,
    showHomeTeamRoster,
    showRotationView,
  ]);

  useEffect(() => {
    if (pregameSequenceStep === "idle") return;

    const timeout = window.setTimeout(() => {
      setPregameSequenceStep((prev) => {
        if (prev === "away") return "home";
        if (prev === "home") return "idle";
        return prev;
      });
    }, 10000);

    return () => window.clearTimeout(timeout);
  }, [pregameSequenceRunId, pregameSequenceStep]);

  useEffect(() => {
    setStatBoardCounts((prev) => {
      const next: StatCounterMap = {};
      (selectedMatchStats.length > 0 ? selectedMatchStats : DEFAULT_MATCH_STATS).forEach((key) => {
        next[key] = prev[key] || { home: 0, away: 0 };
      });
      return next;
    });
  }, [selectedMatchStats]);

  const resetMatchState = () => {
    const resetClock = "00:00";
    const zeroedStats: StatCounterMap = {};
    (selectedMatchStats.length > 0 ? selectedMatchStats : DEFAULT_MATCH_STATS).forEach((key) => {
      zeroedStats[key] = { home: 0, away: 0 };
    });

    setHomeScore(0);
    setAwayScore(0);
    setPeriod("1");
    setClock(resetClock);
    setClockRunning(false);
    setStatBoardCounts(zeroedStats);
    setEvents([]);
    setFlashScore(false);
    setShowHomeTeamRoster(false);
    setShowAwayTeamRoster(false);
    setShowRotationView(false);
    setWorkflowPhase("players-entered");
    setPregameSequenceStep("idle");
    setMatchStarted(false);
    setStartFirstHalfConfirmOpen(false);
    setStartSecondHalfConfirmOpen(false);
    setGoalDialogOpen(false);
    setGoalDialogSide(null);
    setGoalDialogOwnGoal(false);
    setCardDialogOpen(false);
    setCardDialogSide(null);
    setSubstitutionDialogOpen(false);
    setSubstitutionDialogSide(null);
    setSubstitutionPairs([createEmptySubstitutionPair()]);
    setGoalRecords([]);
    setCardRecords([]);
    setSubstitutionRecords([]);
    setMatchStartContext(null);
    setHomePenaltyShootout([]);
    setAwayPenaltyShootout([]);
    setSelectedHomePenaltyShooter("");
    setSelectedAwayPenaltyShooter("");
    if (halftimeStatsTimeoutRef.current) {
      window.clearTimeout(halftimeStatsTimeoutRef.current);
      halftimeStatsTimeoutRef.current = null;
    }

    // Push the reset scoreboard state to all listeners (Overlay/ControlRoom).
    sendEngineMessage({
      type: "score",
      source: "livescore",
      homeTeam,
      awayTeam,
      homeScore: 0,
      awayScore: 0,
      period: "1",
      clock: resetClock,
      clockRunning: false,
      homeKitColor,
      awayKitColor,
    });
    broadcastPenaltyShootout([], []);
    sendEngineMessage({ type: "halftimeStatsHide", matchId, ts: String(Date.now()) });
  };

  const findGoalkeeper = (rotation: { formation: string; rows: RotationRow[] }, lineup: TeamLineup) => {
    const explicitGoalkeeper = rotation.rows.find((row) => row.role.toUpperCase() === "MV")?.player || "";
    if (explicitGoalkeeper) return explicitGoalkeeper;
    return lineup.starting[0] || "";
  };

  const getPersistedTotalMinutes = (rawTotalMinutes: number, penaltyContext?: PenaltyShootoutContext) => {
    const safeCurrentMinutes = sanitizePositiveMinutes(rawTotalMinutes, 0);
    const regulationMinutes = sanitizePositiveMinutes(matchTimeMinutes, 90) || 90;
    const configuredExtraTimeMinutes = extraTimeEnabled
      ? sanitizePositiveMinutes(extraTimeFirstHalfMinutes, 15) + sanitizePositiveMinutes(extraTimeSecondHalfMinutes, 15)
      : 0;
    const fullExtraTimeMinutes = regulationMinutes + configuredExtraTimeMinutes;

    if (workflowPhase === "penalties" || Boolean(penaltyContext) || workflowPhase === "extra-time-2") {
      return Math.max(safeCurrentMinutes, fullExtraTimeMinutes);
    }

    if (workflowPhase === "second-half-ended" || workflowPhase === "game-finished") {
      return Math.max(safeCurrentMinutes, regulationMinutes);
    }

    return safeCurrentMinutes;
  };

  const persistPlayedPlayerStats = (
    totalMinutes: number,
    finalHomeScore: number,
    finalAwayScore: number,
    penaltyContext?: PenaltyShootoutContext,
  ) => {
    if (typeof window === "undefined") return;
    const persistedTotalMinutes = getPersistedTotalMinutes(totalMinutes, penaltyContext);

    const startContext = matchStartContext || {
      homeStarting: [...homeLineup.starting],
      awayStarting: [...awayLineup.starting],
      homeGoalkeeper: findGoalkeeper(homeRotation, homeLineup),
      awayGoalkeeper: findGoalkeeper(awayRotation, awayLineup),
    };

    const normalize = (name: string) => stripPlayerNumberSuffix(name).toLowerCase();

    const buildSideStats = (side: TeamSide) => {
      const sideTeam = side === "home" ? homeTeam : awayTeam;
      const sideStarting = side === "home" ? startContext.homeStarting : startContext.awayStarting;
      const sideGoalkeeper = side === "home" ? startContext.homeGoalkeeper : startContext.awayGoalkeeper;
      const opponentSide: TeamSide = side === "home" ? "away" : "home";

      const participation = new Map<string, { originalName: string; inMinute: number | null; outMinute: number | null }>();
      sideStarting.forEach((player) => {
        participation.set(normalize(player), { originalName: player, inMinute: 0, outMinute: null });
      });

      substitutionRecords
        .filter((record) => record.side === side)
        .sort((a, b) => a.minute - b.minute)
        .forEach((record) => {
          record.pairs.forEach((pair) => {
            const outKey = normalize(pair.outPlayer);
            const inKey = normalize(pair.inPlayer);

            const outEntry = participation.get(outKey) || { originalName: pair.outPlayer, inMinute: 0, outMinute: null };
            outEntry.outMinute = outEntry.outMinute === null ? record.minute : Math.min(outEntry.outMinute, record.minute);
            participation.set(outKey, outEntry);

            const inEntry = participation.get(inKey) || { originalName: pair.inPlayer, inMinute: null, outMinute: null };
            inEntry.inMinute = inEntry.inMinute === null ? record.minute : Math.min(inEntry.inMinute, record.minute);
            participation.set(inKey, inEntry);
          });
        });

      cardRecords
        .filter((record) => record.side === side && record.cardType === "red")
        .forEach((record) => {
          const key = normalize(record.player);
          const entry = participation.get(key);
          if (!entry) return;
          entry.outMinute = entry.outMinute === null ? record.minute : Math.min(entry.outMinute, record.minute);
          participation.set(key, entry);
        });

      const goalCountByPlayer = new Map<string, number>();
      goalRecords.filter((record) => record.side === side).forEach((record) => {
        const key = normalize(record.player);
        goalCountByPlayer.set(key, (goalCountByPlayer.get(key) || 0) + 1);
      });

      const yellowByPlayer = new Map<string, number>();
      const redByPlayer = new Map<string, number>();
      cardRecords.filter((record) => record.side === side).forEach((record) => {
        const key = normalize(record.player);
        if (record.cardType === "yellow") {
          yellowByPlayer.set(key, (yellowByPlayer.get(key) || 0) + 1);
        } else {
          redByPlayer.set(key, (redByPlayer.get(key) || 0) + 1);
        }
      });

      const goalkeeperConceded = new Map<string, number>();
      let activeGoalkeeper = normalize(sideGoalkeeper || "");
      if (activeGoalkeeper) goalkeeperConceded.set(activeGoalkeeper, 0);

      substitutionRecords
        .filter((record) => record.side === side)
        .sort((a, b) => a.minute - b.minute)
        .forEach((record) => {
          record.pairs.forEach((pair) => {
            const outKey = normalize(pair.outPlayer);
            const inKey = normalize(pair.inPlayer);
            if (outKey === activeGoalkeeper) {
              activeGoalkeeper = inKey;
              if (!goalkeeperConceded.has(activeGoalkeeper)) goalkeeperConceded.set(activeGoalkeeper, 0);
            }
          });
        });

      goalRecords
        .filter((record) => record.side === opponentSide)
        .sort((a, b) => a.minute - b.minute)
        .forEach((record) => {
          // Re-evaluate active goalkeeper up to this goal minute.
          let currentGoalkeeper = normalize(sideGoalkeeper || "");
          substitutionRecords
            .filter((sub) => sub.side === side && sub.minute <= record.minute)
            .sort((a, b) => a.minute - b.minute)
            .forEach((sub) => {
              sub.pairs.forEach((pair) => {
                if (normalize(pair.outPlayer) === currentGoalkeeper) {
                  currentGoalkeeper = normalize(pair.inPlayer);
                }
              });
            });

          if (!currentGoalkeeper) return;
          goalkeeperConceded.set(currentGoalkeeper, (goalkeeperConceded.get(currentGoalkeeper) || 0) + 1);
        });

      return Array.from(participation.values()).map((entry) => {
        const playerKey = normalize(entry.originalName);
        const inMinute = entry.inMinute ?? 0;
        const outMinute = entry.outMinute ?? persistedTotalMinutes;
        const minutesPlayed = Math.max(0, outMinute - inMinute);
        const isGoalkeeper = playerKey === normalize(sideGoalkeeper);
        const conceded = isGoalkeeper ? (goalkeeperConceded.get(playerKey) || 0) : null;
        const cleanSheet = isGoalkeeper ? (minutesPlayed > 0 && (conceded || 0) === 0 ? 1 : 0) : null;
        const { firstName, lastName } = splitPlayerName(entry.originalName);

        return {
          playerName: stripPlayerNumberSuffix(entry.originalName),
          firstName,
          lastName,
          teamName: sideTeam,
          side,
          minutesPlayed,
          goals: goalCountByPlayer.get(playerKey) || 0,
          yellowCards: yellowByPlayer.get(playerKey) || 0,
          redCards: redByPlayer.get(playerKey) || 0,
          goalsConceded: conceded,
          cleanSheets: cleanSheet,
          isGoalkeeper,
        };
      });
    };

    const contextHomeAttempts = penaltyContext?.homeAttempts ?? homePenaltyShootout;
    const contextAwayAttempts = penaltyContext?.awayAttempts ?? awayPenaltyShootout;
    const homePenaltyGoals = contextHomeAttempts.filter((attempt) => attempt.result === "scored").length;
    const awayPenaltyGoals = contextAwayAttempts.filter((attempt) => attempt.result === "scored").length;
    const decidedByPenalties = finalHomeScore === finalAwayScore && homePenaltyGoals !== awayPenaltyGoals;
    const homeResult = decidedByPenalties
      ? (homePenaltyGoals > awayPenaltyGoals ? "win" : "loss")
      : (finalHomeScore > finalAwayScore ? "win" : finalHomeScore < finalAwayScore ? "loss" : "draw");
    const awayResult = decidedByPenalties
      ? (awayPenaltyGoals > homePenaltyGoals ? "win" : "loss")
      : (finalAwayScore > finalHomeScore ? "win" : finalAwayScore < finalHomeScore ? "loss" : "draw");

    const buildTeamStats = () => {
      const statKeys = selectedMatchStats.length > 0 ? selectedMatchStats : DEFAULT_MATCH_STATS;
      const homeStats: Record<string, number | string> = {};
      const awayStats: Record<string, number | string> = {};

      statKeys.forEach((statKey) => {
        if (statKey === "goals") {
          homeStats[statKey] = finalHomeScore;
          awayStats[statKey] = finalAwayScore;
          return;
        }

        const panelCounts = statBoardCounts[statKey];
        if (panelCounts) {
          homeStats[statKey] = panelCounts.home || 0;
          awayStats[statKey] = panelCounts.away || 0;
          return;
        }

        homeStats[statKey] = "-";
        awayStats[statKey] = "-";
      });

      return [
        {
          teamName: homeTeam,
          side: "home" as const,
          goalsFor: finalHomeScore,
          goalsAgainst: finalAwayScore,
          result: homeResult,
          decidedByPenalties,
          penaltyScoreFor: homePenaltyGoals,
          penaltyScoreAgainst: awayPenaltyGoals,
          stats: homeStats,
        },
        {
          teamName: awayTeam,
          side: "away" as const,
          goalsFor: finalAwayScore,
          goalsAgainst: finalHomeScore,
          result: awayResult,
          decidedByPenalties,
          penaltyScoreFor: awayPenaltyGoals,
          penaltyScoreAgainst: homePenaltyGoals,
          stats: awayStats,
        },
      ];
    };

    const teamStats = buildTeamStats();

    const matchRecord = {
      matchId: matchId || `${homeTeam}__${awayTeam}`,
      homeTeam,
      awayTeam,
      homeScore: finalHomeScore,
      awayScore: finalAwayScore,
      totalMinutes: persistedTotalMinutes,
      playedAt: new Date().toISOString(),
      teams: teamStats,
      players: [...buildSideStats("home"), ...buildSideStats("away")],
    };

    try {
      const raw = localStorage.getItem(PLAYER_MATCH_STATS_KEY);
      const parsed = raw ? (JSON.parse(raw) as Array<{ matchId: string } & Record<string, unknown>>) : [];
      const next = Array.isArray(parsed) ? parsed.filter((item) => item.matchId !== matchRecord.matchId) : [];
      next.push(matchRecord);
      localStorage.setItem(PLAYER_MATCH_STATS_KEY, JSON.stringify(next));
    } catch {
      localStorage.setItem(PLAYER_MATCH_STATS_KEY, JSON.stringify([matchRecord]));
    }

    try {
      const rawTeamStats = localStorage.getItem(TEAM_MATCH_STATS_KEY);
      const parsedTeamStats = rawTeamStats ? (JSON.parse(rawTeamStats) as Array<{ matchId: string } & Record<string, unknown>>) : [];
      const nextTeamStats = Array.isArray(parsedTeamStats)
        ? parsedTeamStats.filter((item) => item.matchId !== matchRecord.matchId)
        : [];
      nextTeamStats.push({
        matchId: matchRecord.matchId,
        playedAt: matchRecord.playedAt,
        homeTeam,
        awayTeam,
        homeScore: finalHomeScore,
        awayScore: finalAwayScore,
        totalMinutes: persistedTotalMinutes,
        teams: teamStats,
      });
      localStorage.setItem(TEAM_MATCH_STATS_KEY, JSON.stringify(nextTeamStats));
    } catch {
      localStorage.setItem(TEAM_MATCH_STATS_KEY, JSON.stringify([
        {
          matchId: matchRecord.matchId,
          playedAt: matchRecord.playedAt,
          homeTeam,
          awayTeam,
          homeScore: finalHomeScore,
          awayScore: finalAwayScore,
          totalMinutes: persistedTotalMinutes,
          teams: teamStats,
        },
      ]));
    }
  };
  const [clockMinutes = "00", clockSeconds = "00"] = clock.split(":");

  useEffect(() => {
    if (homeTeamFromQuery) setHomeTeam(homeTeamFromQuery);
    if (awayTeamFromQuery) setAwayTeam(awayTeamFromQuery);
    if (homeLogoFromQuery) setHomeLogo(homeLogoFromQuery);
    if (awayLogoFromQuery) setAwayLogo(awayLogoFromQuery);
    if (leagueLogoFromQuery) setLeagueLogo(leagueLogoFromQuery);
  }, [awayLogoFromQuery, awayTeamFromQuery, homeLogoFromQuery, homeTeamFromQuery, leagueLogoFromQuery]);

  useEffect(() => {
    if (!matchId || typeof window === "undefined") return;

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (!key.endsWith(":match-link-data")) continue;

      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as Record<string, {
          homeTeam: string;
          awayTeam: string;
          homeLogo: string;
          awayLogo: string;
          leagueLogo: string;
          collectedStats?: string[];
          extraTimeEnabled?: boolean;
          penaltiesEnabled?: boolean;
          goldenGoalEnabled?: boolean;
          matchTimeMinutes?: number;
          extraTimeFirstHalfMinutes?: number;
          extraTimeSecondHalfMinutes?: number;
        }>;
        const data = parsed?.[matchId];
        if (!data) continue;

        if (data.homeTeam) setHomeTeam(data.homeTeam);
        if (data.awayTeam) setAwayTeam(data.awayTeam);
        if (data.homeLogo) setHomeLogo(data.homeLogo);
        if (data.awayLogo) setAwayLogo(data.awayLogo);
        if (data.leagueLogo) setLeagueLogo(data.leagueLogo);
        const storedStats = Array.isArray(data.collectedStats)
          ? data.collectedStats.filter(
              (stat): stat is string =>
                typeof stat === "string" && MATCH_STATS_OPTIONS.some((option) => option.key === stat)
            )
          : DEFAULT_MATCH_STATS;
        setSelectedMatchStats(storedStats.includes("substitutions") ? storedStats : [...storedStats, "substitutions"]);
        setExtraTimeEnabled(Boolean(data.extraTimeEnabled));
        setPenaltiesEnabled(Boolean(data.penaltiesEnabled));
        setGoldenGoalEnabled(Boolean(data.goldenGoalEnabled));
        setMatchTimeMinutes(sanitizePositiveMinutes(data.matchTimeMinutes ?? 90, 90) || 90);
        setExtraTimeFirstHalfMinutes(sanitizePositiveMinutes(data.extraTimeFirstHalfMinutes ?? 15, 15));
        setExtraTimeSecondHalfMinutes(sanitizePositiveMinutes(data.extraTimeSecondHalfMinutes ?? 15, 15));
        break;
      } catch {
        // Ignore malformed localStorage payloads.
      }
    }
  }, [matchId]);

  useEffect(() => {
    const matchStartKey = `ligr:match-started:${matchId || "global"}`;
    const hasStarted = typeof window !== "undefined" ? Boolean(localStorage.getItem(matchStartKey)) : false;
    setMatchStarted(hasStarted);
  }, [matchId]);

  useEffect(() => {
    if (!clockRunning) return;

    const interval = window.setInterval(() => {
      setClock((prev) => {
        const [minutes, seconds] = prev.split(":").map(Number);
        const totalSeconds = minutes * 60 + seconds + 1;
        const nextClock = `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
        broadcastScoreState(nextClock, true);
        return nextClock;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [awayScore, awayTeam, clockRunning, homeScore, homeTeam, period]);

  useEffect(() => {
    if (typeof window === "undefined" || (!homeTeam && !awayTeam)) return;

    const mapKeyToPlayerName = (teamName: string, playersData: Array<{ firstName: string; lastName: string; team: string; number: string }>) => {
      const map = new Map<string, string>();
      playersData
        .filter((player) => player.team === teamName)
        .forEach((player, index) => {
          const key = `${teamName}-${index}-${player.firstName}-${player.lastName}-${player.number}`;
          map.set(key, `${player.firstName} ${player.lastName}${player.number ? ` #${player.number}` : ""}`.trim());
        });
      return map;
    };

    const fallbackNameFromPlayerKey = (key: string) => {
      const parts = key.split("-");
      if (parts.length < 5) return key;
      const number = parts[parts.length - 1];
      const lastName = parts[parts.length - 2];
      const firstName = parts[parts.length - 3];
      return `${firstName} ${lastName}${number ? ` #${number}` : ""}`.trim();
    };

    const toNames = (keys: string[], playerMap: Map<string, string>) =>
      keys.map((key) => playerMap.get(key) || fallbackNameFromPlayerKey(key)).filter(Boolean);

    let homeLineupLoaded = false;
    let awayLineupLoaded = false;
    let homeRotationLoaded = false;
    let awayRotationLoaded = false;

    const playersByStoragePrefix: Record<string, Array<{ firstName: string; lastName: string; team: string; number: string }>> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (!key.endsWith(":players")) continue;
      try {
        const rawPlayers = localStorage.getItem(key);
        if (!rawPlayers) continue;
        const prefix = key.replace(":players", "");
        playersByStoragePrefix[prefix] = JSON.parse(rawPlayers) as Array<{ firstName: string; lastName: string; team: string; number: string }>;
      } catch {
        // Ignore malformed players payloads.
      }
    }

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (!key.endsWith(":lineups")) continue;

      try {
        const rawLineups = localStorage.getItem(key);
        if (!rawLineups) continue;

        const parsedLineups = JSON.parse(rawLineups) as Record<string, { starting?: string[]; bench?: string[] }>;
        const homeTeamLineup = parsedLineups?.[homeTeam];
        const awayTeamLineup = parsedLineups?.[awayTeam];
        if (!homeTeamLineup && !awayTeamLineup) continue;

        const prefix = key.replace(":lineups", "");
        const playersData = playersByStoragePrefix[prefix] || [];
        const homePlayerMap = mapKeyToPlayerName(homeTeam, playersData);
        const awayPlayerMap = mapKeyToPlayerName(awayTeam, playersData);

        if (homeTeamLineup) {
          setHomeLineup({
            starting: toNames(Array.isArray(homeTeamLineup.starting) ? homeTeamLineup.starting : [], homePlayerMap),
            bench: toNames(Array.isArray(homeTeamLineup.bench) ? homeTeamLineup.bench : [], homePlayerMap),
          });
          homeLineupLoaded = true;
        }

        if (awayTeamLineup) {
          setAwayLineup({
            starting: toNames(Array.isArray(awayTeamLineup.starting) ? awayTeamLineup.starting : [], awayPlayerMap),
            bench: toNames(Array.isArray(awayTeamLineup.bench) ? awayTeamLineup.bench : [], awayPlayerMap),
          });
          awayLineupLoaded = true;
        }

        if (homeLineupLoaded && awayLineupLoaded) break;
      } catch {
        // Ignore malformed localStorage payloads.
      }
    }

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (!key.endsWith(":football-rotations")) continue;

      try {
        const rawRotations = localStorage.getItem(key);
        if (!rawRotations) continue;
        const parsedRotations = JSON.parse(rawRotations) as Record<string, { formation?: string; assignments?: Record<string, string> }>;
        const prefix = key.replace(":football-rotations", "");
        const playersData = playersByStoragePrefix[prefix] || [];
        const homePlayerMap = mapKeyToPlayerName(homeTeam, playersData);
        const awayPlayerMap = mapKeyToPlayerName(awayTeam, playersData);

        const homeTeamRotation = parsedRotations?.[homeTeam];
        if (homeTeamRotation) {
          const assignments = homeTeamRotation.assignments || {};
          const rows = Object.entries(assignments)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([roleKey, playerKey]) => ({
              role: roleKey,
              player: homePlayerMap.get(playerKey) || fallbackNameFromPlayerKey(playerKey) || "Ei valittu",
            }));

          setHomeRotation({
            formation: homeTeamRotation.formation || "",
            rows,
          });
          homeRotationLoaded = true;
        }

        const awayTeamRotation = parsedRotations?.[awayTeam];
        if (awayTeamRotation) {
          const assignments = awayTeamRotation.assignments || {};
          const rows = Object.entries(assignments)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([roleKey, playerKey]) => ({
              role: roleKey,
              player: awayPlayerMap.get(playerKey) || fallbackNameFromPlayerKey(playerKey) || "Ei valittu",
            }));

          setAwayRotation({
            formation: awayTeamRotation.formation || "",
            rows,
          });
          awayRotationLoaded = true;
        }

        if (homeRotationLoaded && awayRotationLoaded) break;
      } catch {
        // Ignore malformed rotation payloads.
      }
    }

    if (!homeLineupLoaded) {
      setHomeLineup({ starting: [], bench: [] });
    }
    if (!awayLineupLoaded) {
      setAwayLineup({ starting: [], bench: [] });
    }
    if (!homeRotationLoaded) {
      setHomeRotation({ formation: "", rows: [] });
    }
    if (!awayRotationLoaded) {
      setAwayRotation({ formation: "", rows: [] });
    }
  }, [awayTeam, homeTeam]);

  useEffect(() => {
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
        // Ignore ControlRoom clock heartbeat here so manual Livescore clock edits are not overwritten.
        if (d.source !== "control-room") {
          setClock(d.clock);
          if (typeof d.clockRunning === "boolean") {
            setClockRunning(d.clockRunning);
          }
        }
      }
      if (d.type === "resetMatch") {
        if (!d.matchId || d.matchId === matchId) {
          resetMatchState();
        }
      }
      if (d.type === "goal") {
        setHomeScore((prev) => prev); // keep in sync via score message
        setFlashScore(true);
        setTimeout(() => setFlashScore(false), 1200);
        setEvents((prev) => [
          {
            id: `${Date.now()}`,
            type: "goal",
            minute: d.minute ?? "",
            text: d.text ?? "Maali!",
          },
          ...prev,
        ]);
      }
      if (d.type === "penalty") {
        const text: string = d.text ?? "";
        const isYellow = text.toLowerCase().includes("keltainen");
        const isRed = text.toLowerCase().includes("punainen");
        setEvents((prev) => [
          {
            id: `${Date.now()}`,
            type: isRed ? "red" : isYellow ? "yellow" : "info",
            minute: "",
            text,
          },
          ...prev,
        ]);
      }
      if (d.type === "lower") {
        setEvents((prev) => [
          {
            id: `${Date.now()}`,
            type: "sub",
            minute: "",
            text: d.text ?? "",
          },
          ...prev,
        ]);
      }
      if (d.type === "branding") {
        setHomeLogo(d.homeLogo ?? "");
        setAwayLogo(d.awayLogo ?? "");
        setLeagueLogo(d.leagueLogo ?? "");
      }
    };

    return () => {
      channel.close();
      engineChannelRef.current = null;
    };
  }, []);

  const hidePreMatchPreview = () => {
    const timestamp = String(Date.now());
    const forceHidePreMatchKey = `ligr:force-hide-prematch:${matchId || "global"}`;

    if (typeof window !== "undefined") {
      localStorage.setItem(forceHidePreMatchKey, timestamp);
    }

    sendEngineMessage({ type: "hidePreMatch", matchId, ts: timestamp });
    return timestamp;
  };

  const startPlayersEnteredSequence = () => {
    setWorkflowPhase("players-entered");
    hidePreMatchPreview();
    setMatchStarted(false);
    setShowHomeTeamRoster(false);
    setShowAwayTeamRoster(false);
    setPregameSequenceRunId((prev) => prev + 1);
    setPregameSequenceStep("away");
  };

  const triggerAboutToStart = () => {
    const timestamp = hidePreMatchPreview();
    setWorkflowPhase("about-to-start");
    setMatchStarted(false);
    setPregameSequenceStep("idle");
    setShowHomeTeamRoster(false);
    setShowAwayTeamRoster(false);
    if (halftimeStatsTimeoutRef.current) {
      window.clearTimeout(halftimeStatsTimeoutRef.current);
      halftimeStatsTimeoutRef.current = null;
    }
    sendEngineMessage({ type: "halftimeStatsHide", matchId, ts: timestamp });
    sendEngineMessage({ type: "aboutToStart", matchId, ts: timestamp, text: "Ottelu alkaa pian" });
  };

  const startFirstHalf = () => {
    setWorkflowPhase("first-half");
    setPregameSequenceStep("idle");
    const timestamp = hidePreMatchPreview();
    const matchStartKey = `ligr:match-started:${matchId || "global"}`;
    const globalMatchStartKey = "ligr:match-started:global";
    if (typeof window !== "undefined") {
      localStorage.setItem(matchStartKey, timestamp);
      if (!matchId) {
        localStorage.setItem(globalMatchStartKey, timestamp);
      }
    }
    if (halftimeStatsTimeoutRef.current) {
      window.clearTimeout(halftimeStatsTimeoutRef.current);
      halftimeStatsTimeoutRef.current = null;
    }
    sendEngineMessage({ type: "halftimeStatsHide", matchId, ts: timestamp });
    sendEngineMessage({ type: "matchStart", matchId, ts: timestamp });
    setGoalRecords([]);
    setCardRecords([]);
    setSubstitutionRecords([]);
    setMatchStartContext({
      homeStarting: [...homeLineup.starting],
      awayStarting: [...awayLineup.starting],
      homeGoalkeeper: findGoalkeeper(homeRotation, homeLineup),
      awayGoalkeeper: findGoalkeeper(awayRotation, awayLineup),
    });
    setShowHomeTeamRoster(false);
    setShowAwayTeamRoster(false);
    setClockRunning(true);
    broadcastScoreState(clock, true);
    setMatchStarted(true);
    setStartFirstHalfConfirmOpen(false);
  };

  const startSecondHalf = () => {
    setWorkflowPhase("second-half");
    setPregameSequenceStep("idle");
    const timestamp = hidePreMatchPreview();
    const [clockMinutes = "0", clockSeconds = "0"] = clock.split(":");
    const totalSeconds = (Number.parseInt(clockMinutes, 10) || 0) * 60 + (Number.parseInt(clockSeconds, 10) || 0);
    const nextClock = totalSeconds < 45 * 60 ? "45:00" : clock;

    if (halftimeStatsTimeoutRef.current) {
      window.clearTimeout(halftimeStatsTimeoutRef.current);
      halftimeStatsTimeoutRef.current = null;
    }

    setPeriod("2");
    setClock(nextClock);
    setShowHomeTeamRoster(false);
    setShowAwayTeamRoster(false);
    setClockRunning(true);
    setMatchStarted(true);
    setStartSecondHalfConfirmOpen(false);

    sendEngineMessage({ type: "halftimeStatsHide", matchId, ts: timestamp });
    sendEngineMessage({ type: "matchStart", matchId, ts: timestamp });
    sendEngineMessage({
      type: "score",
      source: "livescore",
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      period: "2",
      clock: nextClock,
      clockRunning: true,
      homeKitColor,
      awayKitColor,
    });
  };

  const startExtraTimeFirst = () => {
    const timestamp = String(Date.now());
    const [clockMinutes = "0", clockSeconds = "0"] = clock.split(":");
    const totalSeconds = (Number.parseInt(clockMinutes, 10) || 0) * 60 + (Number.parseInt(clockSeconds, 10) || 0);
    const nextClock = totalSeconds < 90 * 60 ? "90:00" : clock;
    setWorkflowPhase("extra-time-1");
    setPregameSequenceStep("idle");
    setPeriod("3");
    setClock(nextClock);
    setClockRunning(true);
    setMatchStarted(true);
    setShowHomeTeamRoster(false);
    setShowAwayTeamRoster(false);
    sendEngineMessage({ type: "halftimeStatsHide", matchId, ts: timestamp });
    sendEngineMessage({ type: "matchStart", matchId, ts: timestamp });
    sendEngineMessage({
      type: "score",
      source: "livescore",
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      period: "3",
      clock: nextClock,
      clockRunning: true,
      homeKitColor,
      awayKitColor,
    });
  };

  const startExtraTimeSecond = () => {
    const timestamp = String(Date.now());
    const [clockMinutes = "0", clockSeconds = "0"] = clock.split(":");
    const totalSeconds = (Number.parseInt(clockMinutes, 10) || 0) * 60 + (Number.parseInt(clockSeconds, 10) || 0);
    const nextClock = totalSeconds < 105 * 60 ? "105:00" : clock;
    setWorkflowPhase("extra-time-2");
    setPregameSequenceStep("idle");
    setPeriod("4");
    setClock(nextClock);
    setClockRunning(true);
    setMatchStarted(true);
    setShowHomeTeamRoster(false);
    setShowAwayTeamRoster(false);
    sendEngineMessage({ type: "halftimeStatsHide", matchId, ts: timestamp });
    sendEngineMessage({ type: "matchStart", matchId, ts: timestamp });
    sendEngineMessage({
      type: "score",
      source: "livescore",
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      period: "4",
      clock: nextClock,
      clockRunning: true,
      homeKitColor,
      awayKitColor,
    });
  };

  const startPenalties = () => {
    const timestamp = String(Date.now());
    setWorkflowPhase("penalties");
    setPregameSequenceStep("idle");
    setClockRunning(false);
    setMatchStarted(false);
    setHomePenaltyShootout([]);
    setAwayPenaltyShootout([]);
    setSelectedHomePenaltyShooter("");
    setSelectedAwayPenaltyShooter("");
    sendEngineMessage({ type: "halftimeStatsHide", matchId, ts: timestamp });
    sendEngineMessage({ type: "aboutToStart", matchId, ts: timestamp, text: "Rangaistuspotkut" });
    broadcastPenaltyShootout([], []);
    broadcastScoreState(clock, false);
  };

  const startGoldenGoal = () => {
    const timestamp = String(Date.now());
    setWorkflowPhase("golden-goal");
    setPregameSequenceStep("idle");
    setClockRunning(false);
    setMatchStarted(false);
    sendEngineMessage({ type: "halftimeStatsHide", matchId, ts: timestamp });
    sendEngineMessage({ type: "aboutToStart", matchId, ts: timestamp, text: "Kultainen maali" });
    broadcastScoreState(clock, false);
  };

  const endMatch = () => {
    const timestamp = String(Date.now());
    setWorkflowPhase("second-half-ended");
    setPregameSequenceStep("idle");
    setClockRunning(false);
    setMatchStarted(false);
    setShowHomeTeamRoster(false);
    setShowAwayTeamRoster(false);
    setStartSecondHalfConfirmOpen(false);
    broadcastScoreState(clock, false);
    persistPlayedPlayerStats(clockToMinute(clock), homeScore, awayScore);
    sendEngineMessage({ type: "halftimeStatsHide", matchId, ts: timestamp });
    sendEngineMessage({ type: "aboutToStart", matchId, ts: timestamp, text: "2Jakso paattynyt" });
  };

  const finishGame = (finalMessage = "Ottelu on päättynyt", penaltyContext?: PenaltyShootoutContext) => {
    const timestamp = String(Date.now());
    setWorkflowPhase("game-finished");
    setPregameSequenceStep("idle");
    setClockRunning(false);
    setMatchStarted(false);
    setShowHomeTeamRoster(false);
    setShowAwayTeamRoster(false);
    setStartSecondHalfConfirmOpen(false);
    broadcastScoreState(clock, false);
    persistPlayedPlayerStats(clockToMinute(clock), homeScore, awayScore, penaltyContext);
    sendEngineMessage({ type: "halftimeStatsHide", matchId, ts: timestamp });
    sendEngineMessage({ type: "aboutToStart", matchId, ts: timestamp, text: finalMessage });

    const labelByKey = new Map(MATCH_STATS_OPTIONS.map((option) => [option.key, option.label]));
    const fulltimeStatRows: HalftimeStatRow[] = (selectedMatchStats.length > 0 ? selectedMatchStats : DEFAULT_MATCH_STATS).map((statKey) => {
      const panelCounts = statBoardCounts[statKey];
      if (panelCounts) {
        return {
          key: statKey,
          label: labelByKey.get(statKey) || statKey,
          home: String(panelCounts.home || 0),
          away: String(panelCounts.away || 0),
        };
      }
      if (statKey === "goals") {
        return {
          key: statKey,
          label: labelByKey.get(statKey) || statKey,
          home: String(homeScore),
          away: String(awayScore),
        };
      }
      return {
        key: statKey,
        label: labelByKey.get(statKey) || statKey,
        home: "-",
        away: "-",
      };
    });

    if (halftimeStatsTimeoutRef.current) {
      window.clearTimeout(halftimeStatsTimeoutRef.current);
    }

    halftimeStatsTimeoutRef.current = window.setTimeout(() => {
      sendEngineMessage({
        type: "halftimeStats",
        matchId,
        ts: String(Date.now()),
        title: "Ottelu paattynyt",
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        clock,
        stats: fulltimeStatRows,
        nextScene: "aboutToStart",
        nextText: finalMessage,
      });
      halftimeStatsTimeoutRef.current = null;
    }, 5000);
  };

  const endFirstHalf = () => {
    setWorkflowPhase("end-first-half");
    setPregameSequenceStep("idle");
    setClockRunning(false);
    broadcastScoreState(clock, false);
    persistPlayedPlayerStats(clockToMinute(clock), homeScore, awayScore);

    const goals = events.filter((event) => event.type === "goal").length;
    const yellowCards = events.filter((event) => event.type === "yellow").length;
    const redCards = events.filter((event) => event.type === "red").length;
    const substitutions = events.filter((event) => event.type === "sub").length;
    const penaltiesTotal = events.filter((event) => /rangaistuspotku|rankkari|penalty/i.test(event.text || "")).length;
    const labelByKey = new Map(MATCH_STATS_OPTIONS.map((option) => [option.key, option.label]));
    const normalizedHome = homeTeam.trim().toLowerCase();
    const normalizedAway = awayTeam.trim().toLowerCase();

    const eventCountsByTeam = (eventType: LiveEvent["type"]) => {
      let home = 0;
      let away = 0;

      events.filter((event) => event.type === eventType).forEach((event) => {
        const text = (event.text || "").toLowerCase();
        const hasHome = normalizedHome && text.includes(normalizedHome);
        const hasAway = normalizedAway && text.includes(normalizedAway);
        if (hasHome && !hasAway) home += 1;
        if (hasAway && !hasHome) away += 1;
      });

      return {
        home: home > 0 ? String(home) : "-",
        away: away > 0 ? String(away) : "-",
      };
    };

    const buildStatValuePair = (statKey: string): { home: string; away: string } => {
      const panelCounts = statBoardCounts[statKey];
      if (panelCounts) {
        return { home: String(panelCounts.home || 0), away: String(panelCounts.away || 0) };
      }

      if (statKey === "goals") {
        return { home: String(homeScore), away: String(awayScore) };
      }

      if (statKey === "yellowCards") {
        const counts = eventCountsByTeam("yellow");
        return counts.home !== "-" || counts.away !== "-"
          ? counts
          : { home: String(yellowCards), away: "-" };
      }

      if (statKey === "redCards") {
        const counts = eventCountsByTeam("red");
        return counts.home !== "-" || counts.away !== "-"
          ? counts
          : { home: String(redCards), away: "-" };
      }

      if (statKey === "substitutions") {
        const counts = eventCountsByTeam("sub");
        return counts.home !== "-" || counts.away !== "-"
          ? counts
          : { home: String(substitutions), away: "-" };
      }

      if (statKey === "penalties") {
        return { home: String(penaltiesTotal), away: "-" };
      }

      // Team-specific stats are not yet captured in Livescore events, so keep placeholders.
      return { home: "-", away: "-" };
    };

    const halftimeStatRows: HalftimeStatRow[] = (selectedMatchStats.length > 0 ? selectedMatchStats : DEFAULT_MATCH_STATS).map((statKey) => {
      const pair = buildStatValuePair(statKey);
      return {
        key: statKey,
        label: labelByKey.get(statKey) || statKey,
        home: pair.home,
        away: pair.away,
      };
    });

    if (halftimeStatsTimeoutRef.current) {
      window.clearTimeout(halftimeStatsTimeoutRef.current);
    }

    halftimeStatsTimeoutRef.current = window.setTimeout(() => {
      sendEngineMessage({
        type: "halftimeStats",
        matchId,
        ts: String(Date.now()),
        title: "1. jakso paattynyt",
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        clock,
        goals,
        yellowCards,
        redCards,
        substitutions,
        stats: halftimeStatRows,
        nextScene: "aboutToStart",
        nextText: "Tauko",
      });
      halftimeStatsTimeoutRef.current = null;
    }, 10000);
  };

  const prepareSecondHalf = () => {
    setWorkflowPhase("prepare-second-half");
    setPregameSequenceStep("idle");
    setClockRunning(false);
    setPeriod("2");
    setShowHomeTeamRoster(false);
    setShowAwayTeamRoster(false);
    hidePreMatchPreview();

    sendEngineMessage({
      type: "score",
      source: "livescore",
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      period: "2",
      clock,
      clockRunning: false,
      homeKitColor,
      awayKitColor,
    });

    const labelByKey = new Map(MATCH_STATS_OPTIONS.map((option) => [option.key, option.label]));
    const halftimeStatRows: HalftimeStatRow[] = (selectedMatchStats.length > 0 ? selectedMatchStats : DEFAULT_MATCH_STATS).map((statKey) => {
      const panelCounts = statBoardCounts[statKey];
      if (panelCounts) {
        return {
          key: statKey,
          label: labelByKey.get(statKey) || statKey,
          home: String(panelCounts.home || 0),
          away: String(panelCounts.away || 0),
        };
      }
      if (statKey === "goals") {
        return {
          key: statKey,
          label: labelByKey.get(statKey) || statKey,
          home: String(homeScore),
          away: String(awayScore),
        };
      }
      return {
        key: statKey,
        label: labelByKey.get(statKey) || statKey,
        home: "-",
        away: "-",
      };
    });

    sendEngineMessage({
      type: "halftimeStats",
      matchId,
      ts: String(Date.now()),
      title: "1. jakso paattynyt",
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      clock,
      stats: halftimeStatRows,
      nextScene: "aboutToStart",
      nextText: "Jakso 2",
    });
  };

  useEffect(() => () => {
    if (halftimeStatsTimeoutRef.current) {
      window.clearTimeout(halftimeStatsTimeoutRef.current);
    }
  }, []);

  const requestStartFirstHalf = () => {
    if (matchStarted) return;
    setStartFirstHalfConfirmOpen(true);
  };

  const requestStartSecondHalf = () => {
    if (clockRunning || workflowPhase !== "prepare-second-half") return;
    setStartSecondHalfConfirmOpen(true);
  };

  const getPenaltyShootoutScoredGoals = (attempts: PenaltyShootoutAttempt[]) => attempts.filter((attempt) => attempt.result === "scored").length;

  const resolvePenaltyShootoutWinner = (homeAttempts: PenaltyShootoutAttempt[], awayAttempts: PenaltyShootoutAttempt[]): TeamSide | null => {
    const homePenaltyGoals = getPenaltyShootoutScoredGoals(homeAttempts);
    const awayPenaltyGoals = getPenaltyShootoutScoredGoals(awayAttempts);

    const homeRemainingAttempts = Math.max(0, MAX_PENALTY_SHOOTOUT_ATTEMPTS - homeAttempts.length);
    const awayRemainingAttempts = Math.max(0, MAX_PENALTY_SHOOTOUT_ATTEMPTS - awayAttempts.length);

    const homeCurrentTotal = homeScore + homePenaltyGoals;
    const awayCurrentTotal = awayScore + awayPenaltyGoals;
    const maxHomeReachable = homeCurrentTotal + homeRemainingAttempts;
    const maxAwayReachable = awayCurrentTotal + awayRemainingAttempts;

    if (homeCurrentTotal > maxAwayReachable) return "home";
    if (awayCurrentTotal > maxHomeReachable) return "away";

    if (homeAttempts.length === MAX_PENALTY_SHOOTOUT_ATTEMPTS && awayAttempts.length === MAX_PENALTY_SHOOTOUT_ATTEMPTS) {
      if (homeCurrentTotal > awayCurrentTotal) return "home";
      if (awayCurrentTotal > homeCurrentTotal) return "away";
    }

    return null;
  };

  const getPenaltyShootoutPlayers = (side: TeamSide) => {
    const lineup = side === "home" ? homeLineup : awayLineup;
    return Array.from(new Set([...(lineup.starting ?? []), ...(lineup.bench ?? [])].filter(Boolean)));
  };

  const registerPenaltyAttempt = (side: TeamSide, result: PenaltyShootoutResult) => {
    const shooter = (side === "home" ? selectedHomePenaltyShooter : selectedAwayPenaltyShooter).trim() || "Tuntematon";
    const nextAttempt: PenaltyShootoutAttempt = { player: shooter, result };
    const nextHome = side === "home"
      ? [...homePenaltyShootout, nextAttempt].slice(0, MAX_PENALTY_SHOOTOUT_ATTEMPTS)
      : homePenaltyShootout;
    const nextAway = side === "away"
      ? [...awayPenaltyShootout, nextAttempt].slice(0, MAX_PENALTY_SHOOTOUT_ATTEMPTS)
      : awayPenaltyShootout;

    setHomePenaltyShootout(nextHome);
    setAwayPenaltyShootout(nextAway);
    broadcastPenaltyShootout(nextHome, nextAway);

    const winner = resolvePenaltyShootoutWinner(nextHome, nextAway);
    if (!winner) return;

    const homePenaltyGoals = getPenaltyShootoutScoredGoals(nextHome);
    const awayPenaltyGoals = getPenaltyShootoutScoredGoals(nextAway);
    const winnerName = winner === "home" ? homeTeam : awayTeam;
    finishGame(
      `Ottelu on päättynyt - Voittaja: ${winnerName} (${homeScore}-${awayScore}, rp ${homePenaltyGoals}-${awayPenaltyGoals})`,
      { homeAttempts: nextHome, awayAttempts: nextAway },
    );
  };

  const undoPenaltyAttempt = (side: TeamSide) => {
    if (side === "home") {
      const nextHome = homePenaltyShootout.slice(0, -1);
      setHomePenaltyShootout(nextHome);
      broadcastPenaltyShootout(nextHome, awayPenaltyShootout);
      return;
    }

    const nextAway = awayPenaltyShootout.slice(0, -1);
    setAwayPenaltyShootout(nextAway);
    broadcastPenaltyShootout(homePenaltyShootout, nextAway);
  };

  const clearPenaltyShootout = () => {
    setHomePenaltyShootout([]);
    setAwayPenaltyShootout([]);
    broadcastPenaltyShootout([], []);
  };

  const openGoalDialog = (side: TeamSide) => {
    setGoalDialogSide(side);
    setGoalDialogOwnGoal(false);
    setGoalDialogOpen(true);
  };

  const openCardDialog = (type: "yellowCards" | "redCards", side: TeamSide) => {
    setCardDialogType(type);
    setCardDialogSide(side);
    setCardDialogOpen(true);
  };

  const openSubstitutionDialog = (side: TeamSide) => {
    setSubstitutionDialogSide(side);
    setSubstitutionPairs([createEmptySubstitutionPair()]);
    setSubstitutionDialogOpen(true);
  };

  const getValidSubstitutionPairs = (pairs: SubstitutionPair[]) => {
    const usedOut = new Set<string>();
    const usedIn = new Set<string>();

    return pairs.filter((pair) => {
      const outPlayer = pair.outPlayer.trim();
      const inPlayer = pair.inPlayer.trim();
      if (!outPlayer || !inPlayer || outPlayer === inPlayer) return false;
      if (usedOut.has(outPlayer) || usedIn.has(inPlayer)) return false;
      usedOut.add(outPlayer);
      usedIn.add(inPlayer);
      return true;
    });
  };

  const updateSubstitutionPair = (index: number, field: keyof SubstitutionPair, value: string) => {
    setSubstitutionPairs((prev) => prev.map((pair, pairIndex) => (pairIndex === index ? { ...pair, [field]: value } : pair)));
  };

  const addSubstitutionPair = () => {
    setSubstitutionPairs((prev) => (prev.length >= MAX_MULTI_SUBSTITUTIONS ? prev : [...prev, createEmptySubstitutionPair()]));
  };

  const removeSubstitutionPair = (index: number) => {
    setSubstitutionPairs((prev) => {
      const next = prev.filter((_, pairIndex) => pairIndex !== index);
      return next.length > 0 ? next : [createEmptySubstitutionPair()];
    });
  };

  const applySubstitutionToLineup = (lineup: TeamLineup, playerOut: string, playerIn: string): TeamLineup => {
    const nextStarting = lineup.starting.map((player) => (player === playerOut ? playerIn : player));
    const nextBench = [...lineup.bench.filter((player) => player !== playerIn && player !== playerOut), playerOut];
    return {
      starting: nextStarting,
      bench: nextBench,
    };
  };

  const confirmSubstitution = () => {
    if (!substitutionDialogSide) return;

    const validPairs = getValidSubstitutionPairs(substitutionPairs).slice(0, MAX_MULTI_SUBSTITUTIONS);
    if (validPairs.length === 0) return;

    const isHome = substitutionDialogSide === "home";
    const teamName = isHome ? homeTeam : awayTeam;

    if (isHome) {
      setHomeLineup((prev) => validPairs.reduce((current, pair) => applySubstitutionToLineup(current, pair.outPlayer, pair.inPlayer), prev));
      setHomeRotation((prev) => ({
        ...prev,
        rows: validPairs.reduce(
          (currentRows, pair) => currentRows.map((row) => (row.player === pair.outPlayer ? { ...row, player: pair.inPlayer } : row)),
          prev.rows
        ),
      }));
    } else {
      setAwayLineup((prev) => validPairs.reduce((current, pair) => applySubstitutionToLineup(current, pair.outPlayer, pair.inPlayer), prev));
      setAwayRotation((prev) => ({
        ...prev,
        rows: validPairs.reduce(
          (currentRows, pair) => currentRows.map((row) => (row.player === pair.outPlayer ? { ...row, player: pair.inPlayer } : row)),
          prev.rows
        ),
      }));
    }

    updateStatCounter("substitutions", substitutionDialogSide, validPairs.length);
    setSubstitutionRecords((prev) => [
      ...prev,
      {
        side: substitutionDialogSide,
        minute: clockToMinute(clock),
        pairs: validPairs,
      },
    ]);

    const substitutionText = validPairs.map((pair) => `${pair.outPlayer} ⟶ ${pair.inPlayer}`).join(" | ");
    const teamLogo = isHome ? homeLogo : awayLogo;
    sendEngineMessage({
      type: "substitutionCard",
      minute: clock,
      side: substitutionDialogSide,
      teamName,
      teamLogo,
      pairs: validPairs,
    });

    setEvents((prev) => [
      {
        id: `${Date.now()}`,
        type: "sub",
        minute: clock,
        text: `🔄 ${substitutionText}${teamName ? ` (${teamName})` : ""}`,
      },
      ...prev,
    ]);

    setSubstitutionDialogOpen(false);
    setSubstitutionDialogSide(null);
    setSubstitutionPairs([createEmptySubstitutionPair()]);
  };

  const confirmCard = (player: string) => {
    if (!cardDialogSide) return;
    const normalizedPlayer = stripPlayerNumberSuffix(player).toLowerCase();
    const priorYellowCount = cardRecords.filter((record) => (
      record.side === cardDialogSide
      && record.cardType === "yellow"
      && stripPlayerNumberSuffix(record.player).toLowerCase() === normalizedPlayer
    )).length;
    const isSecondYellow = cardDialogType === "yellowCards" && priorYellowCount >= 1;
    const isRed = cardDialogType === "redCards" || isSecondYellow;

    if (cardDialogType === "yellowCards") {
      updateStatCounter("yellowCards", cardDialogSide, 1);
    }
    if (isRed) {
      updateStatCounter("redCards", cardDialogSide, 1);
    }

    setCardRecords((prev) => {
      const next = [
        ...prev,
        {
          player,
          side: cardDialogSide,
          cardType: "yellow" as const,
          minute: clockToMinute(clock),
        },
      ];

      if (cardDialogType === "redCards") {
        next[next.length - 1] = {
          player,
          side: cardDialogSide,
          cardType: "red",
          minute: clockToMinute(clock),
        };
        return next;
      }

      if (isSecondYellow) {
        next.push({
          player,
          side: cardDialogSide,
          cardType: "red",
          minute: clockToMinute(clock),
        });
      }

      return next;
    });

    const currentRedCount = Math.max(0, statBoardCounts.redCards?.[cardDialogSide] || 0);
    const nextRedCardCount = isRed ? currentRedCount + 1 : currentRedCount;
    const teamName = cardDialogSide === "home" ? homeTeam : awayTeam;
    const teamLogo = cardDialogSide === "home" ? homeLogo : awayLogo;
    const cardEventId = [
      matchId || "global",
      cardDialogSide,
      stripPlayerNumberSuffix(player).toLowerCase(),
      clock,
      isRed ? "red" : "yellow",
      Date.now(),
    ].join("|");
    sendEngineMessage({
      type: "cardScorer",
      eventId: cardEventId,
      cardType: isRed ? "red" : "yellow",
      player,
      minute: clock,
      side: cardDialogSide,
      teamName,
      teamLogo,
      redCardCount: nextRedCardCount,
    });
    setEvents((prev) => [
      {
        id: `${Date.now()}`,
        type: isRed ? "red" as const : "yellow" as const,
        minute: clock,
        text: `${isRed ? "🟥" : "🟨"} ${player}${isSecondYellow ? " (2. keltainen)" : ""}`,
      },
      ...prev,
    ]);
    setCardDialogOpen(false);
    setCardDialogSide(null);
  };

  const confirmGoal = (scorer: string) => {
    if (!goalDialogSide) return;
    const isOwnGoal = goalDialogOwnGoal;
    updateStatCounter("goals", goalDialogSide, 1);
    updateStatCounter("shotsOnTarget", goalDialogSide, 1);
    const scorerLabel = isOwnGoal ? `${scorer} (OM)` : scorer;
    setGoalRecords((prev) => [
      ...prev,
      {
        player: scorerLabel,
        side: goalDialogSide,
        minute: clockToMinute(clock),
      },
    ]);
    const teamName = goalDialogSide === "home" ? homeTeam : awayTeam;
    const teamLogo = goalDialogSide === "home" ? homeLogo : awayLogo;
    sendEngineMessage({
      type: "goalScorer",
      scorer: scorerLabel,
      minute: clock,
      side: goalDialogSide,
      teamName,
      teamLogo,
    });
    setEvents((prev) => [
      {
        id: `${Date.now()}`,
        type: "goal" as const,
        minute: clock,
        text: `⚽ ${scorerLabel}${teamName ? ` (${teamName})` : ""}`,
      },
      ...prev,
    ]);
    setGoalDialogOpen(false);
    setGoalDialogSide(null);
    setGoalDialogOwnGoal(false);
  };

  const updateStatCounter = (statKey: string, side: TeamSide, delta: number) => {
    setStatBoardCounts((prev) => {
      const current = prev[statKey] || { home: 0, away: 0 };
      const nextValue = Math.max(0, (current[side] || 0) + delta);
      const next = {
        ...prev,
        [statKey]: {
          ...current,
          [side]: nextValue,
        },
      };

      if (statKey === "goals") {
        const nextHomeScore = next[statKey].home;
        const nextAwayScore = next[statKey].away;
        setHomeScore(nextHomeScore);
        setAwayScore(nextAwayScore);
        sendEngineMessage({
          type: "score",
          source: "livescore",
          homeTeam,
          awayTeam,
          homeScore: nextHomeScore,
          awayScore: nextAwayScore,
          period,
          clock,
          clockRunning,
        });
      }

      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center py-10 px-4">
      {/* Header */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          {leagueLogo
            ? <img src={leagueLogo} alt="league" className="h-8 object-contain" />
            : <span className="text-xs font-bold uppercase tracking-widest text-gray-500">LIVE</span>
          }
          <div className="flex items-center gap-2">
            {matchId ? (
              <span className="rounded-full border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-300">
                Match: {matchId}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-red-400">Live</span>
            </span>
            <button
              type="button"
              className="rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/25 transition-colors"
              onClick={() => {
                const matchStartKey = `ligr:match-started:${matchId || "global"}`;
                const globalMatchStartKey = "ligr:match-started:global";
                const forceHidePreMatchKey = `ligr:force-hide-prematch:${matchId || "global"}`;
                const legacyForceHidePreMatchKey = "ligr:force-hide-prematch";
                if (typeof window !== "undefined") {
                  localStorage.removeItem(matchStartKey);
                  localStorage.removeItem(globalMatchStartKey);
                  localStorage.removeItem(forceHidePreMatchKey);
                  localStorage.removeItem(legacyForceHidePreMatchKey);
                }
                sendEngineMessage({ type: "resetMatch", matchId, ts: String(Date.now()) });
                resetMatchState();
              }}
            >
              Aloita alusta
            </button>
          </div>
        </div>

        <div className="mb-4 space-y-4">
          <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-3">
            <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-200/85">Match Workflow</p>
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/75">Jakso 1</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${workflowPhase === "players-entered" ? "border-cyan-300/80 bg-cyan-300/20 text-cyan-100" : "border-gray-700 bg-gray-900/50 text-gray-300 hover:border-cyan-400/40 hover:text-cyan-100"}`}
                    onClick={startPlayersEnteredSequence}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/85">1</p>
                    <p className="mt-1 text-sm font-semibold">Kokoonpanot</p>
                    <p className="mt-1 text-xs text-gray-300/80">Vieras 10s, sitten koti 10s.</p>
                  </button>

                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${workflowPhase === "about-to-start" ? "border-amber-300/80 bg-amber-300/20 text-amber-50" : "border-gray-700 bg-gray-900/50 text-gray-300 hover:border-amber-400/40 hover:text-amber-100"}`}
                    onClick={triggerAboutToStart}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/85">2</p>
                    <p className="mt-1 text-sm font-semibold">Valmiina aloittamaan</p>
                    <p className="mt-1 text-xs text-gray-300/80">Näyttää oman overlay-bannerin.</p>
                  </button>

                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${workflowPhase === "first-half" ? "border-emerald-300/80 bg-emerald-300/20 text-emerald-50" : "border-gray-700 bg-gray-900/50 text-gray-300 hover:border-emerald-400/40 hover:text-emerald-100"}`}
                    onClick={requestStartFirstHalf}
                    disabled={matchStarted}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/85">3</p>
                    <p className="mt-1 text-sm font-semibold">Aloita jakso 1</p>
                    <p className="mt-1 text-xs text-gray-300/80">Piilottaa ennakon ja asettaa ottelun käyntiin.</p>
                  </button>

                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${workflowPhase === "end-first-half" ? "border-yellow-300/80 bg-yellow-300/20 text-yellow-50" : "border-gray-700 bg-gray-900/50 text-gray-300 hover:border-yellow-400/40 hover:text-yellow-100"}`}
                    onClick={endFirstHalf}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-200/85">4</p>
                    <p className="mt-1 text-sm font-semibold">Lopeta 1. jakso</p>
                    <p className="mt-1 text-xs text-gray-300/80">Pysayttaa kellon ja avaa tilastot 10 s kuluttua.</p>
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-200/75">Jakso 2</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${workflowPhase === "prepare-second-half" ? "border-indigo-300/80 bg-indigo-300/20 text-indigo-50" : "border-gray-700 bg-gray-900/50 text-gray-300 hover:border-indigo-400/40 hover:text-indigo-100"}`}
                    onClick={prepareSecondHalf}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-200/85">5</p>
                    <p className="mt-1 text-sm font-semibold">Valmistaudu jaksoon 2</p>
                    <p className="mt-1 text-xs text-gray-300/80">Nayttaa tilastot 30 s, sitten recap Jakso 2.</p>
                  </button>

                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${workflowPhase === "second-half" ? "border-emerald-300/80 bg-emerald-300/20 text-emerald-50" : "border-gray-700 bg-gray-900/50 text-gray-300 hover:border-emerald-400/40 hover:text-emerald-100"}`}
                    onClick={requestStartSecondHalf}
                    disabled={clockRunning || workflowPhase !== "prepare-second-half"}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/85">6</p>
                    <p className="mt-1 text-sm font-semibold">Aloita jakso 2</p>
                    <p className="mt-1 text-xs text-gray-300/80">Kysyy vahvistuksen ja kaynnistaa kellon ajasta 45:00.</p>
                  </button>

                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${workflowPhase === "second-half-ended" ? "border-rose-300/80 bg-rose-300/20 text-rose-50" : "border-gray-700 bg-gray-900/50 text-gray-300 hover:border-rose-400/40 hover:text-rose-100"}`}
                    onClick={endMatch}
                    disabled={period !== "2"}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-200/85">7</p>
                    <p className="mt-1 text-sm font-semibold">2Jakso paattynyt</p>
                    <p className="mt-1 text-xs text-gray-300/80">Pysayttaa kellon ja nayttaa 2. jakson paattymisruudun.</p>
                  </button>

                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${workflowPhase === "game-finished" ? "border-rose-300/80 bg-rose-300/20 text-rose-50" : "border-gray-700 bg-gray-900/50 text-gray-300 hover:border-rose-400/40 hover:text-rose-100"}`}
                    onClick={() => finishGame()}
                    disabled={period !== "2"}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-200/85">8</p>
                    <p className="mt-1 text-sm font-semibold">Peli on päättynyt</p>
                    <p className="mt-1 text-xs text-gray-300/80">Pysayttaa kellon ja nayttaa lopullisen paattynyt-ruudun.</p>
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-rose-200/75">Workflow rivi 3</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${workflowPhase === "extra-time-1" ? "border-rose-300/80 bg-rose-300/20 text-rose-50" : "border-gray-700 bg-gray-900/50 text-gray-300 hover:border-rose-400/40 hover:text-rose-100"}`}
                    onClick={startExtraTimeFirst}
                    disabled={!extraTimeEnabled}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-200/85">9</p>
                    <p className="mt-1 text-sm font-semibold">Jatko ottelu 1</p>
                    <p className="mt-1 text-xs text-gray-300/80">Kaynnistaa jatkoajan 1. osan ajasta 90:00.</p>
                  </button>

                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${workflowPhase === "extra-time-2" ? "border-fuchsia-300/80 bg-fuchsia-300/20 text-fuchsia-50" : "border-gray-700 bg-gray-900/50 text-gray-300 hover:border-fuchsia-400/40 hover:text-fuchsia-100"}`}
                    onClick={startExtraTimeSecond}
                    disabled={!extraTimeEnabled}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200/85">10</p>
                    <p className="mt-1 text-sm font-semibold">Jatko ottelu 2</p>
                    <p className="mt-1 text-xs text-gray-300/80">Kaynnistaa jatkoajan 2. osan ajasta 105:00.</p>
                  </button>

                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${workflowPhase === "penalties" ? "border-amber-300/80 bg-amber-300/20 text-amber-50" : "border-gray-700 bg-gray-900/50 text-gray-300 hover:border-amber-400/40 hover:text-amber-100"}`}
                    onClick={startPenalties}
                    disabled={!penaltiesEnabled}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/85">11</p>
                    <p className="mt-1 text-sm font-semibold">Rangaistuspotkut</p>
                    <p className="mt-1 text-xs text-gray-300/80">Nayttaa rangaistuspotku-vaiheen.</p>
                  </button>

                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${workflowPhase === "golden-goal" ? "border-cyan-300/80 bg-cyan-300/20 text-cyan-50" : "border-gray-700 bg-gray-900/50 text-gray-300 hover:border-cyan-400/40 hover:text-cyan-100"}`}
                    onClick={startGoldenGoal}
                    disabled={!goldenGoalEnabled}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/85">12</p>
                    <p className="mt-1 text-sm font-semibold">Kultainenmaali</p>
                    <p className="mt-1 text-xs text-gray-300/80">Nayttaa kultainen maali -vaiheen.</p>
                  </button>
                </div>
              </div>
            </div>
            {pregameSequenceStep !== "idle" ? (
              <p className="mt-3 text-center text-xs font-medium text-cyan-100/85">
                {pregameSequenceStep === "away" ? "Automaatio: vierasjoukkue näkyy nyt 10 sekuntia." : "Automaatio: kotijoukkue näkyy nyt 10 sekuntia."}
              </p>
            ) : null}

            {workflowPhase === "penalties" ? (
              <div className="mt-3 rounded-xl border border-amber-300/35 bg-amber-500/10 p-3">
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-amber-100">Rangaistuspotkukilpailu (5 laukojalle)</p>
                <p className="mt-1 text-center text-xs font-semibold text-amber-100/90">
                  Kokonaistulos (ottelu + rankkarit): {homeTeam} {homeScore + homePenaltyShootout.filter((item) => item.result === "scored").length} - {awayScore + awayPenaltyShootout.filter((item) => item.result === "scored").length} {awayTeam}
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-gray-900/60 p-2">
                    <p className="text-sm font-semibold text-white">{homeTeam}</p>
                    <p className="text-xs text-gray-300">Osumat: {homePenaltyShootout.filter((item) => item.result === "scored").length} / {homePenaltyShootout.length}</p>
                    <select
                      className="mt-2 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                      value={selectedHomePenaltyShooter}
                      onChange={(event) => setSelectedHomePenaltyShooter(event.target.value)}
                    >
                      <option value="">Valitse laukoja</option>
                      {getPenaltyShootoutPlayers("home").map((player) => (
                        <option key={`home-penalty-player-${player}`} value={player}>{player}</option>
                      ))}
                      <option value="Tuntematon">Tuntematon</option>
                    </select>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700" onClick={() => registerPenaltyAttempt("home", "scored")} disabled={homePenaltyShootout.length >= MAX_PENALTY_SHOOTOUT_ATTEMPTS}>+ Maali</button>
                      <button type="button" className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700" onClick={() => registerPenaltyAttempt("home", "missed")} disabled={homePenaltyShootout.length >= MAX_PENALTY_SHOOTOUT_ATTEMPTS}>+ Huti</button>
                      <button type="button" className="rounded-md border border-gray-500 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:bg-gray-800" onClick={() => undoPenaltyAttempt("home")} disabled={homePenaltyShootout.length === 0}>Peru viimeinen</button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-gray-900/60 p-2">
                    <p className="text-sm font-semibold text-white text-right">{awayTeam}</p>
                    <p className="text-xs text-gray-300 text-right">Osumat: {awayPenaltyShootout.filter((item) => item.result === "scored").length} / {awayPenaltyShootout.length}</p>
                    <select
                      className="mt-2 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                      value={selectedAwayPenaltyShooter}
                      onChange={(event) => setSelectedAwayPenaltyShooter(event.target.value)}
                    >
                      <option value="">Valitse laukoja</option>
                      {getPenaltyShootoutPlayers("away").map((player) => (
                        <option key={`away-penalty-player-${player}`} value={player}>{player}</option>
                      ))}
                      <option value="Tuntematon">Tuntematon</option>
                    </select>
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      <button type="button" className="rounded-md border border-gray-500 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:bg-gray-800" onClick={() => undoPenaltyAttempt("away")} disabled={awayPenaltyShootout.length === 0}>Peru viimeinen</button>
                      <button type="button" className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700" onClick={() => registerPenaltyAttempt("away", "missed")} disabled={awayPenaltyShootout.length >= MAX_PENALTY_SHOOTOUT_ATTEMPTS}>+ Huti</button>
                      <button type="button" className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700" onClick={() => registerPenaltyAttempt("away", "scored")} disabled={awayPenaltyShootout.length >= MAX_PENALTY_SHOOTOUT_ATTEMPTS}>+ Maali</button>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex justify-center">
                  <button type="button" className="rounded-md border border-amber-300/50 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-100 hover:bg-amber-500/25" onClick={clearPenaltyShootout}>Nollaa rankkarit</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {startFirstHalfConfirmOpen ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md rounded-2xl border border-white/15 bg-gray-900 p-5 shadow-2xl">
              <p className="text-lg font-bold text-white">Tahdotko aloittaa ottelun?</p>
              <p className="mt-1 text-sm text-gray-300">Valitse Kyllä käynnistääksesi ottelun tai En peruuttaaksesi.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800 transition-colors"
                  onClick={() => setStartFirstHalfConfirmOpen(false)}
                >
                  En
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                  onClick={startFirstHalf}
                >
                  Kyllä
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {startSecondHalfConfirmOpen ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md rounded-2xl border border-white/15 bg-gray-900 p-5 shadow-2xl">
              <p className="text-lg font-bold text-white">Tahdotko aloittaa 2. jakson?</p>
              <p className="mt-1 text-sm text-gray-300">Valitse Kyllä käynnistääksesi toisen jakson ajasta 45:00 tai nykyisestä myöhemmästä ajasta.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800 transition-colors"
                  onClick={() => setStartSecondHalfConfirmOpen(false)}
                >
                  En
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                  onClick={startSecondHalf}
                >
                  Kyllä
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {goalDialogOpen && goalDialogSide !== null ? (() => {
          const side = goalDialogSide;
          const scorerSide: TeamSide = goalDialogOwnGoal ? (side === "home" ? "away" : "home") : side;
          const teamName = side === "home" ? homeTeam : awayTeam;
          const scorerTeamName = scorerSide === "home" ? homeTeam : awayTeam;
          const lineup = scorerSide === "home" ? homeLineup : awayLineup;
          const players = [...(lineup?.starting ?? []), ...(lineup?.bench ?? [])].filter(Boolean);
          return (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4">
              <div className="w-full max-w-md rounded-2xl border border-white/15 bg-gray-900 p-5 shadow-2xl">
                <p className="text-lg font-bold text-white">⚽ Kuka maalin teki?</p>
                <p className="mt-1 text-sm text-gray-400">{teamName}</p>
                <label className="mt-3 flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-xs text-gray-200">
                  <input
                    type="checkbox"
                    checked={goalDialogOwnGoal}
                    onChange={(event) => setGoalDialogOwnGoal(event.target.checked)}
                  />
                  <span>Oma maali (valitse pelaaja joukkueesta: {scorerTeamName})</span>
                </label>
                <div className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto">
                  {players.length > 0 ? players.map((player) => (
                    <button
                      key={player}
                      type="button"
                      className="w-full rounded-lg bg-gray-800 px-4 py-2 text-left text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                      onClick={() => confirmGoal(player)}
                    >
                      {player}
                    </button>
                  )) : null}
                  <button
                    type="button"
                    className="w-full rounded-lg bg-gray-800 px-4 py-2 text-left text-sm font-semibold text-gray-400 hover:bg-emerald-700 hover:text-white transition-colors"
                    onClick={() => confirmGoal("Tuntematon")}
                  >
                    Tuntematon
                  </button>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800 transition-colors"
                    onClick={() => { setGoalDialogOpen(false); setGoalDialogSide(null); setGoalDialogOwnGoal(false); }}
                  >
                    Peruuta
                  </button>
                </div>
              </div>
            </div>
          );
        })() : null}

        {cardDialogOpen && cardDialogSide !== null ? (() => {
          const side = cardDialogSide;
          const isRed = cardDialogType === "redCards";
          const teamName = side === "home" ? homeTeam : awayTeam;
          const lineup = side === "home" ? homeLineup : awayLineup;
          const players = [...(lineup?.starting ?? []), ...(lineup?.bench ?? [])].filter(Boolean);
          return (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4">
              <div className="w-full max-w-md rounded-2xl border border-white/15 bg-gray-900 p-5 shadow-2xl">
                <p className="text-lg font-bold text-white">{isRed ? "🟥 Kuka sai punaisen kortin?" : "🟨 Kuka sai keltaisen kortin?"}</p>
                <p className="mt-1 text-sm text-gray-400">{teamName}</p>
                <div className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto">
                  {players.length > 0 ? players.map((player) => (
                    <button
                      key={player}
                      type="button"
                      className={`w-full rounded-lg bg-gray-800 px-4 py-2 text-left text-sm font-semibold text-white transition-colors ${isRed ? "hover:bg-red-700" : "hover:bg-yellow-600"}`}
                      onClick={() => confirmCard(player)}
                    >
                      {player}
                    </button>
                  )) : null}
                  <button
                    type="button"
                    className={`w-full rounded-lg bg-gray-800 px-4 py-2 text-left text-sm font-semibold text-gray-400 transition-colors ${isRed ? "hover:bg-red-700 hover:text-white" : "hover:bg-yellow-600 hover:text-white"}`}
                    onClick={() => confirmCard("Tuntematon")}
                  >
                    Tuntematon
                  </button>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800 transition-colors"
                    onClick={() => { setCardDialogOpen(false); setCardDialogSide(null); }}
                  >
                    Peruuta
                  </button>
                </div>
              </div>
            </div>
          );
        })() : null}

        {substitutionDialogOpen && substitutionDialogSide !== null ? (() => {
          const side = substitutionDialogSide;
          const teamName = side === "home" ? homeTeam : awayTeam;
          const lineup = side === "home" ? homeLineup : awayLineup;
          const starters = (lineup?.starting ?? []).filter(Boolean);
          const bench = (lineup?.bench ?? []).filter(Boolean);
          const selectedOutPlayers = substitutionPairs.map((pair) => pair.outPlayer).filter(Boolean);
          const selectedInPlayers = substitutionPairs.map((pair) => pair.inPlayer).filter(Boolean);
          const canConfirm = getValidSubstitutionPairs(substitutionPairs).length > 0;

          return (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4">
              <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-gray-900 p-5 shadow-2xl">
                <p className="text-lg font-bold text-white">🔄 Pelaajavaihdot (max 5)</p>
                <p className="mt-1 text-sm text-gray-400">{teamName}</p>

                <div className="mt-4 space-y-2">
                  {substitutionPairs.map((pair, index) => {
                    const availableOutPlayers = starters.filter((player) => player === pair.outPlayer || !selectedOutPlayers.includes(player));
                    const availableInPlayers = bench.filter((player) => player === pair.inPlayer || !selectedInPlayers.includes(player));

                    return (
                      <div key={`sub-pair-${index}`} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 rounded-xl border border-white/10 bg-gray-950/40 p-2">
                        <select
                          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                          value={pair.outPlayer}
                          onChange={(event) => updateSubstitutionPair(index, "outPlayer", event.target.value)}
                        >
                          <option value="">Ulos pelaaja</option>
                          {availableOutPlayers.map((player) => (
                            <option key={`sub-out-option-${index}-${player}`} value={player}>{player}</option>
                          ))}
                        </select>

                        <select
                          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                          value={pair.inPlayer}
                          onChange={(event) => updateSubstitutionPair(index, "inPlayer", event.target.value)}
                        >
                          <option value="">Sisaan pelaaja</option>
                          {availableInPlayers.map((player) => (
                            <option key={`sub-in-option-${index}-${player}`} value={player}>{player}</option>
                          ))}
                        </select>

                        <button
                          type="button"
                          className="rounded-lg border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-800 disabled:opacity-40"
                          disabled={substitutionPairs.length === 1}
                          onClick={() => removeSubstitutionPair(index)}
                        >
                          Poista
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="mt-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-200 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={addSubstitutionPair}
                  disabled={substitutionPairs.length >= MAX_MULTI_SUBSTITUTIONS}
                >
                  + Lisaa vaihto ({substitutionPairs.length}/{MAX_MULTI_SUBSTITUTIONS})
                </button>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800 transition-colors"
                    onClick={() => {
                      setSubstitutionDialogOpen(false);
                      setSubstitutionDialogSide(null);
                      setSubstitutionPairs([createEmptySubstitutionPair()]);
                    }}
                  >
                    Peruuta
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canConfirm}
                    onClick={confirmSubstitution}
                  >
                    Vahvista vaihto
                  </button>
                </div>
              </div>
            </div>
          );
        })() : null}

        {/* Control Panel */}
        <div className="mt-4 overflow-hidden rounded-3xl border border-gray-800 bg-[#151515] shadow-2xl">
          <div className="bg-[#101217] px-4 py-4">
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-black uppercase tracking-[0.08em] text-gray-300">{period === "1" ? "First Half" : `${period}. Jakso`}</p>
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  {homeLogo
                    ? <img src={homeLogo} alt={homeTeam} className="h-10 w-10 object-contain" />
                    : <div className="h-10 w-10 rounded-full bg-gray-700" />
                  }
                  <p className="text-3xl font-black uppercase text-white">{homeTeam.slice(0, 4)}</p>
                  <label className="cursor-pointer" title="Kotiasun väri">
                    <div className="h-6 w-6 rounded-full border-2 border-white/40 shadow" style={{ background: homeKitColor }} />
                    <input
                      type="color"
                      value={homeKitColor}
                      onChange={(e) => { setHomeKitColor(e.target.value); broadcastScoreState(clock, clockRunning); }}
                      className="sr-only"
                    />
                  </label>
                </div>

                <p className="text-6xl font-black tabular-nums text-white">{homeScore} {awayScore}</p>

                <div className="flex items-center gap-2">
                  <label className="cursor-pointer" title="Vierasasun väri">
                    <div className="h-6 w-6 rounded-full border-2 border-white/40 shadow" style={{ background: awayKitColor }} />
                    <input
                      type="color"
                      value={awayKitColor}
                      onChange={(e) => { setAwayKitColor(e.target.value); broadcastScoreState(clock, clockRunning); }}
                      className="sr-only"
                    />
                  </label>
                  <p className="text-3xl font-black uppercase text-white">{awayTeam.slice(0, 4)}</p>
                  {awayLogo
                    ? <img src={awayLogo} alt={awayTeam} className="h-10 w-10 object-contain" />
                    : <div className="h-10 w-10 rounded-full bg-gray-700" />
                  }
                </div>
              </div>

              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  className="h-12 w-12 rounded-xl bg-[#2b2d31] text-xl text-gray-100 hover:bg-[#3a3d44]"
                  onClick={() => {
                    setClockRunning(false);
                    broadcastScoreState(clock, false);
                  }}
                >
                  ⏸
                </button>
                <button
                  type="button"
                  className="h-12 w-12 rounded-xl bg-[#2b2d31] text-xl text-gray-100 hover:bg-[#3a3d44]"
                  onClick={() => {
                    setClockRunning(!clockRunning);
                    broadcastScoreState(clock, !clockRunning);
                  }}
                >
                  {clockRunning ? "■" : "▶"}
                </button>
                <div className="rounded-xl bg-[#222731] px-5 py-2 text-5xl font-black tabular-nums text-white">{clock}</div>
                <button
                  type="button"
                  className="h-12 w-12 rounded-xl bg-[#2b2d31] text-3xl text-gray-100 hover:bg-[#3a3d44]"
                  onClick={() => adjustClockBySeconds(-60)}
                >
                  -
                </button>
                <button
                  type="button"
                  className="h-12 w-12 rounded-xl bg-[#2b2d31] text-3xl text-gray-100 hover:bg-[#3a3d44]"
                  onClick={() => adjustClockBySeconds(60)}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#ececec] p-2">
            {(selectedMatchStats.length > 0 ? selectedMatchStats : DEFAULT_MATCH_STATS).map((statKey) => {
              const statLabel = MATCH_STATS_OPTIONS.find((option) => option.key === statKey)?.label || statKey;
              const homeValue = statKey === "goals" ? homeScore : (statBoardCounts[statKey]?.home || 0);
              const awayValue = statKey === "goals" ? awayScore : (statBoardCounts[statKey]?.away || 0);

              const displayOnly = DISPLAY_ONLY_STATS.has(statKey);
              const isGoalStat = statKey === "goals";
              const isCardStat = statKey === "yellowCards" || statKey === "redCards";
              const isSubstitutionStat = statKey === "substitutions";
              const isYellowCard = statKey === "yellowCards";

              return (
                <div key={`panel-stat-${statKey}`} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-gray-300 bg-[#f3f3f3] px-3 py-2">
                  <div className="flex min-w-0 items-center justify-start gap-2">
                    {isGoalStat ? (
                      <>
                        <div className="w-12 text-center text-4xl font-black tabular-nums text-[#171717]">{homeValue}</div>
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                          onClick={() => openGoalDialog("home")}
                        >
                          ⚽ Maali
                        </button>
                      </>
                    ) : isCardStat ? (
                      <>
                        <div className="w-12 text-center text-4xl font-black tabular-nums text-[#171717]">{homeValue}</div>
                        <button
                          type="button"
                          className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors ${isYellowCard ? "bg-yellow-500 hover:bg-yellow-600" : "bg-red-600 hover:bg-red-700"}`}
                          onClick={() => openCardDialog(statKey as "yellowCards" | "redCards", "home")}
                        >
                          {isYellowCard ? "🟨" : "🟥"} Kortti
                        </button>
                      </>
                    ) : isSubstitutionStat ? (
                      <>
                        <div className="w-12 text-center text-4xl font-black tabular-nums text-[#171717]">{homeValue}</div>
                        <button
                          type="button"
                          className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 transition-colors"
                          onClick={() => openSubstitutionDialog("home")}
                        >
                          🔄 Vaihto
                        </button>
                      </>
                    ) : displayOnly ? (
                      <div className="w-full text-center text-4xl font-black tabular-nums text-[#171717]">{homeValue}</div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="h-9 w-9 rounded-lg bg-[#1f2937] text-lg font-black text-white hover:bg-[#111827]"
                          onClick={() => updateStatCounter(statKey, "home", -1)}
                          disabled={homeValue <= 0}
                        >
                          -
                        </button>
                        <div className="w-12 text-center text-4xl font-black tabular-nums text-[#171717]">{homeValue}</div>
                        <button
                          type="button"
                          className="h-9 w-9 rounded-lg bg-[#1f2937] text-lg font-black text-white hover:bg-[#111827]"
                          onClick={() => updateStatCounter(statKey, "home", 1)}
                        >
                          +
                        </button>
                      </>
                    )}
                  </div>

                  <div className="mx-2 flex min-w-[170px] items-center justify-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-blue-600 bg-green-200 text-2xl">
                      {STAT_ICON_BY_KEY[statKey] || "◎"}
                    </div>
                    <p className="max-w-[230px] truncate text-base font-black uppercase tracking-[0.05em] text-[#212121]">{statLabel}</p>
                  </div>

                  <div className="flex min-w-0 items-center justify-end gap-2">
                    {isGoalStat ? (
                      <>
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                          onClick={() => openGoalDialog("away")}
                        >
                          ⚽ Maali
                        </button>
                        <div className="w-12 text-center text-4xl font-black tabular-nums text-[#171717]">{awayValue}</div>
                      </>
                    ) : isCardStat ? (
                      <>
                        <button
                          type="button"
                          className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors ${isYellowCard ? "bg-yellow-500 hover:bg-yellow-600" : "bg-red-600 hover:bg-red-700"}`}
                          onClick={() => openCardDialog(statKey as "yellowCards" | "redCards", "away")}
                        >
                          {isYellowCard ? "🟨" : "🟥"} Kortti
                        </button>
                        <div className="w-12 text-center text-4xl font-black tabular-nums text-[#171717]">{awayValue}</div>
                      </>
                    ) : isSubstitutionStat ? (
                      <>
                        <button
                          type="button"
                          className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 transition-colors"
                          onClick={() => openSubstitutionDialog("away")}
                        >
                          🔄 Vaihto
                        </button>
                        <div className="w-12 text-center text-4xl font-black tabular-nums text-[#171717]">{awayValue}</div>
                      </>
                    ) : displayOnly ? (
                      <div className="w-full text-center text-4xl font-black tabular-nums text-[#171717]">{awayValue}</div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="h-9 w-9 rounded-lg bg-[#1f2937] text-lg font-black text-white hover:bg-[#111827]"
                          onClick={() => updateStatCounter(statKey, "away", -1)}
                          disabled={awayValue <= 0}
                        >
                          -
                        </button>
                        <div className="w-12 text-center text-4xl font-black tabular-nums text-[#171717]">{awayValue}</div>
                        <button
                          type="button"
                          className="h-9 w-9 rounded-lg bg-[#1f2937] text-lg font-black text-white hover:bg-[#111827]"
                          onClick={() => updateStatCounter(statKey, "away", 1)}
                        >
                          +
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-700">Powered by LIGR Live</p>
      </div>
    </div>
  );
}

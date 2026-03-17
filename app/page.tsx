"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

type StatsSubTab = "summary" | "teams" | "players";

type TeamStatItem = {
  name: string;
  logo: string;
};

type PlayerStatItem = {
  firstName: string;
  lastName: string;
  team: string;
  number: string;
  photo: string;
};

type PlayerMatchStatItem = {
  playerName: string;
  teamName: string;
  minutesPlayed: number;
  goals: number;
  yellowCards: number;
  redCards: number;
  goalsConceded: number | null;
  cleanSheets: number | null;
  isGoalkeeper: boolean;
};

type MatchStatItem = {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
};

type TeamMatchStatTeamEntry = {
  teamName: string;
  result: "win" | "loss" | "draw";
  goalsFor: number;
  goalsAgainst: number;
};

type TeamMatchStatRecord = {
  matchId: string;
  teams: TeamMatchStatTeamEntry[];
};

type TeamStatsTotals = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};

type PlayerStatsTotals = {
  minutesPlayed: number;
  goals: number;
  yellowCards: number;
  redCards: number;
  goalsConceded: number;
  cleanSheets: number;
  isGoalkeeper: boolean;
};

const PLAYER_MATCH_STATS_KEY = "ligr:player-match-stats";
const TEAM_MATCH_STATS_KEY = "ligr:team-match-stats";
const ADMIN_TEAM_OVERRIDES_KEY = "ligr:admin-team-stat-overrides";
const ADMIN_PLAYER_OVERRIDES_KEY = "ligr:admin-player-stat-overrides";

export default function HomePage() {
  const [isStatsView, setIsStatsView] = useState(false);
  const [loggedIn,setLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminOpen,setAdminOpen] = useState(false);
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");

  const login = () => {
    if (email === "admin" && password === "admin") {
      setLoggedIn(true);
      setIsAdmin(true);
      setAdminOpen(false);
      setEmail("");
      setPassword("");
      if (typeof window !== "undefined") {
        localStorage.setItem("isAdmin", "true");
      }
    }
  };

  const logout = () => {
    setLoggedIn(false);
    setIsAdmin(false);
    setEmail("");
    setPassword("");
    if (typeof window !== "undefined") {
      localStorage.removeItem("isAdmin");
    }
  };

  const [competitions, setCompetitions] = useState<Array<{name:string;logo:string;}>>([
    { name: "Kansallinen Ykkönen", logo: "https://via.placeholder.com/80?text=Ykkönen" },
    { name: "Kottek Puulaaki", logo: "https://via.placeholder.com/80?text=Puulaaki" },
    { name: "Miesten Harjoitusottelu", logo: "https://via.placeholder.com/80?text=Harjoitus" },
  ]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newCompName, setNewCompName] = useState("");
  const [newCompLogo, setNewCompLogo] = useState("");
  const [statsSubTab, setStatsSubTab] = useState<StatsSubTab>("summary");
  const [statsTeams, setStatsTeams] = useState<TeamStatItem[]>([]);
  const [statsPlayers, setStatsPlayers] = useState<PlayerStatItem[]>([]);
  const [playerMatchStats, setPlayerMatchStats] = useState<PlayerMatchStatItem[]>([]);
  const [statsMatches, setStatsMatches] = useState<MatchStatItem[]>([]);
  const [teamMatchStats, setTeamMatchStats] = useState<TeamMatchStatRecord[]>([]);
  const [selectedStatsTeam, setSelectedStatsTeam] = useState<string>("");
  const [selectedStatsPlayerKey, setSelectedStatsPlayerKey] = useState<string>("");
  const [teamStatsSearch, setTeamStatsSearch] = useState("");
  const [playerStatsSearch, setPlayerStatsSearch] = useState("");
  const [teamStatOverrides, setTeamStatOverrides] = useState<Record<string, TeamStatsTotals>>({});
  const [playerStatOverrides, setPlayerStatOverrides] = useState<Record<string, PlayerStatsTotals>>({});
  const [teamStatsEditDraft, setTeamStatsEditDraft] = useState<TeamStatsTotals | null>(null);
  const [playerStatsEditDraft, setPlayerStatsEditDraft] = useState<PlayerStatsTotals | null>(null);

  const normalizeKey = (value: string) => value.trim().toLowerCase();
  const clampNonNegative = (value: number) => (Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);
  const canEditStats = loggedIn || isAdmin;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readStatsTab = () => {
      const params = new URLSearchParams(window.location.search);
      setIsStatsView(params.get("tab") === "stats");
    };

    readStatsTab();
    window.addEventListener("popstate", readStatsTab);

    return () => {
      window.removeEventListener("popstate", readStatsTab);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasAdminSession = localStorage.getItem("isAdmin") === "true";
    setIsAdmin(hasAdminSession);
    if (hasAdminSession) setLoggedIn(true);

    const rawTeamOverrides = localStorage.getItem(ADMIN_TEAM_OVERRIDES_KEY);
    if (rawTeamOverrides) {
      try {
        const parsed = JSON.parse(rawTeamOverrides) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const next = Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>)
              .filter((entry): entry is [string, TeamStatsTotals] => {
                if (typeof entry[0] !== "string") return false;
                const value = entry[1] as Partial<TeamStatsTotals>;
                return typeof value === "object" && value !== null;
              })
              .map(([key, value]) => {
                const typed = value as Partial<TeamStatsTotals>;
                return [
                  key,
                  {
                    played: clampNonNegative(typeof typed.played === "number" ? typed.played : 0),
                    wins: clampNonNegative(typeof typed.wins === "number" ? typed.wins : 0),
                    draws: clampNonNegative(typeof typed.draws === "number" ? typed.draws : 0),
                    losses: clampNonNegative(typeof typed.losses === "number" ? typed.losses : 0),
                    goalsFor: clampNonNegative(typeof typed.goalsFor === "number" ? typed.goalsFor : 0),
                    goalsAgainst: clampNonNegative(typeof typed.goalsAgainst === "number" ? typed.goalsAgainst : 0),
                  },
                ];
              })
          );
          setTeamStatOverrides(next);
        }
      } catch {
        // Ignore malformed admin override payload.
      }
    }

    const rawPlayerOverrides = localStorage.getItem(ADMIN_PLAYER_OVERRIDES_KEY);
    if (rawPlayerOverrides) {
      try {
        const parsed = JSON.parse(rawPlayerOverrides) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const next = Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>)
              .filter((entry): entry is [string, PlayerStatsTotals] => {
                if (typeof entry[0] !== "string") return false;
                const value = entry[1] as Partial<PlayerStatsTotals>;
                return typeof value === "object" && value !== null;
              })
              .map(([key, value]) => {
                const typed = value as Partial<PlayerStatsTotals>;
                return [
                  key,
                  {
                    minutesPlayed: clampNonNegative(typeof typed.minutesPlayed === "number" ? typed.minutesPlayed : 0),
                    goals: clampNonNegative(typeof typed.goals === "number" ? typed.goals : 0),
                    yellowCards: clampNonNegative(typeof typed.yellowCards === "number" ? typed.yellowCards : 0),
                    redCards: clampNonNegative(typeof typed.redCards === "number" ? typed.redCards : 0),
                    goalsConceded: clampNonNegative(typeof typed.goalsConceded === "number" ? typed.goalsConceded : 0),
                    cleanSheets: clampNonNegative(typeof typed.cleanSheets === "number" ? typed.cleanSheets : 0),
                    isGoalkeeper: typed.isGoalkeeper === true,
                  },
                ];
              })
          );
          setPlayerStatOverrides(next);
        }
      } catch {
        // Ignore malformed admin override payload.
      }
    }
  }, []);

  useEffect(() => {
    if (!isStatsView || typeof window === "undefined") return;

    const teamsMap = new Map<string, TeamStatItem>();
    const playersMap = new Map<string, PlayerStatItem>();
    const matches: MatchStatItem[] = [];
    const playerStats: PlayerMatchStatItem[] = [];
    const teamStatsByMatchId = new Map<string, TeamMatchStatRecord>();

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (!key.endsWith(":teams") && !key.endsWith(":players") && !key.endsWith(":matches") && key !== PLAYER_MATCH_STATS_KEY && key !== TEAM_MATCH_STATS_KEY) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) continue;

        if (key.endsWith(":teams")) {
          parsed.forEach((entry) => {
            const team = entry as { name?: unknown; logo?: unknown };
            const name = typeof team.name === "string" ? team.name.trim() : "";
            if (!name) return;
            const dedupeKey = name.toLowerCase();
            if (!teamsMap.has(dedupeKey)) {
              teamsMap.set(dedupeKey, {
                name,
                logo: typeof team.logo === "string" ? team.logo : "",
              });
            }
          });
        }

        if (key.endsWith(":players")) {
          parsed.forEach((entry) => {
            const player = entry as { firstName?: unknown; lastName?: unknown; team?: unknown; number?: unknown; photo?: unknown };
            const firstName = typeof player.firstName === "string" ? player.firstName.trim() : "";
            const lastName = typeof player.lastName === "string" ? player.lastName.trim() : "";
            const team = typeof player.team === "string" ? player.team.trim() : "";
            const number = typeof player.number === "string" ? player.number.trim() : "";
            const photo = typeof player.photo === "string" ? player.photo.trim() : "";
            if (!firstName && !lastName) return;
            const dedupeKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${team.toLowerCase()}|${number}`;
            if (!playersMap.has(dedupeKey)) {
              playersMap.set(dedupeKey, { firstName, lastName, team, number, photo });
            }
          });
        }

        if (key.endsWith(":matches")) {
          parsed.forEach((entry) => {
            const match = entry as {
              homeTeam?: unknown;
              awayTeam?: unknown;
              homeScore?: unknown;
              awayScore?: unknown;
              status?: unknown;
            };

            const homeTeam = typeof match.homeTeam === "string" ? match.homeTeam.trim() : "";
            const awayTeam = typeof match.awayTeam === "string" ? match.awayTeam.trim() : "";
            if (!homeTeam || !awayTeam) return;

            const homeScore = typeof match.homeScore === "number" ? match.homeScore : null;
            const awayScore = typeof match.awayScore === "number" ? match.awayScore : null;
            const status = typeof match.status === "string" ? match.status.toLowerCase().trim() : "";

            matches.push({ homeTeam, awayTeam, homeScore, awayScore, status });
          });
        }

        if (key === PLAYER_MATCH_STATS_KEY) {
          parsed.forEach((entry) => {
            const matchEntry = entry as { players?: unknown };
            if (!Array.isArray(matchEntry.players)) return;

            matchEntry.players.forEach((player) => {
              const playerEntry = player as {
                playerName?: unknown;
                teamName?: unknown;
                minutesPlayed?: unknown;
                goals?: unknown;
                yellowCards?: unknown;
                redCards?: unknown;
                goalsConceded?: unknown;
                cleanSheets?: unknown;
                isGoalkeeper?: unknown;
              };

              const playerName = typeof playerEntry.playerName === "string" ? playerEntry.playerName.trim() : "";
              const teamName = typeof playerEntry.teamName === "string" ? playerEntry.teamName.trim() : "";
              if (!playerName) return;

              playerStats.push({
                playerName,
                teamName,
                minutesPlayed: typeof playerEntry.minutesPlayed === "number" ? playerEntry.minutesPlayed : 0,
                goals: typeof playerEntry.goals === "number" ? playerEntry.goals : 0,
                yellowCards: typeof playerEntry.yellowCards === "number" ? playerEntry.yellowCards : 0,
                redCards: typeof playerEntry.redCards === "number" ? playerEntry.redCards : 0,
                goalsConceded: typeof playerEntry.goalsConceded === "number" ? playerEntry.goalsConceded : null,
                cleanSheets: typeof playerEntry.cleanSheets === "number" ? playerEntry.cleanSheets : null,
                isGoalkeeper: playerEntry.isGoalkeeper === true,
              });
            });
          });
        }

        if (key === TEAM_MATCH_STATS_KEY) {
          parsed.forEach((entry) => {
            const matchEntry = entry as { matchId?: unknown; teams?: unknown };
            if (typeof matchEntry.matchId !== "string" || !Array.isArray(matchEntry.teams)) return;

            const teams = matchEntry.teams
              .map((teamEntry) => {
                const team = teamEntry as {
                  teamName?: unknown;
                  result?: unknown;
                  goalsFor?: unknown;
                  goalsAgainst?: unknown;
                };

                if (typeof team.teamName !== "string") return null;
                if (team.result !== "win" && team.result !== "loss" && team.result !== "draw") return null;

                return {
                  teamName: team.teamName,
                  result: team.result,
                  goalsFor: typeof team.goalsFor === "number" ? team.goalsFor : 0,
                  goalsAgainst: typeof team.goalsAgainst === "number" ? team.goalsAgainst : 0,
                } as TeamMatchStatTeamEntry;
              })
              .filter((team): team is TeamMatchStatTeamEntry => team !== null);

            if (teams.length === 0) return;
            teamStatsByMatchId.set(matchEntry.matchId, { matchId: matchEntry.matchId, teams });
          });
        }
      } catch {
        // Ignore malformed localStorage values.
      }
    }

    setStatsTeams(Array.from(teamsMap.values()).sort((a, b) => a.name.localeCompare(b.name, "fi")));
    setStatsPlayers(
      Array.from(playersMap.values()).sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fi"))
    );
    setPlayerMatchStats(playerStats);
    setStatsMatches(matches);
    setTeamMatchStats(Array.from(teamStatsByMatchId.values()));
  }, [isStatsView]);

  const playerStatsByIdentity = useMemo(() => {
    const normalized = (value: string) => value.trim().toLowerCase();
    const totals = new Map<string, {
      minutesPlayed: number;
      goals: number;
      yellowCards: number;
      redCards: number;
      goalsConceded: number;
      cleanSheets: number;
      isGoalkeeper: boolean;
    }>();

    playerMatchStats.forEach((stat) => {
      const key = `${normalized(stat.playerName)}|${normalized(stat.teamName)}`;
      const current = totals.get(key) || {
        minutesPlayed: 0,
        goals: 0,
        yellowCards: 0,
        redCards: 0,
        goalsConceded: 0,
        cleanSheets: 0,
        isGoalkeeper: false,
      };

      current.minutesPlayed += stat.minutesPlayed;
      current.goals += stat.goals;
      current.yellowCards += stat.yellowCards;
      current.redCards += stat.redCards;
      current.goalsConceded += stat.goalsConceded || 0;
      current.cleanSheets += stat.cleanSheets || 0;
      current.isGoalkeeper = current.isGoalkeeper || stat.isGoalkeeper;
      totals.set(key, current);
    });

    return totals;
  }, [playerMatchStats]);

  const toPlayerIdentityKey = (playerName: string, teamName: string) => `${playerName.trim().toLowerCase()}|${teamName.trim().toLowerCase()}`;

  const selectedStatsPlayer = useMemo(() => {
    if (!selectedStatsPlayerKey) return null;
    return statsPlayers.find((player) => {
      const fullName = `${player.firstName} ${player.lastName}`.trim();
      return toPlayerIdentityKey(fullName, player.team || "") === selectedStatsPlayerKey;
    }) || null;
  }, [selectedStatsPlayerKey, statsPlayers]);

  const selectedTeamStats = useMemo(() => {
    if (!selectedStatsTeam) return null;

    const teamName = normalizeKey(selectedStatsTeam);

    const directTeamRows = teamMatchStats
      .flatMap((record) => (Array.isArray(record.teams) ? record.teams : []))
      .filter((row) => row.teamName.toLowerCase() === teamName);

    if (directTeamRows.length > 0) {
      let played = 0;
      let wins = 0;
      let draws = 0;
      let losses = 0;
      let goalsFor = 0;
      let goalsAgainst = 0;

      directTeamRows.forEach((row) => {
        played += 1;
        goalsFor += row.goalsFor || 0;
        goalsAgainst += row.goalsAgainst || 0;
        if (row.result === "win") wins += 1;
        if (row.result === "draw") draws += 1;
        if (row.result === "loss") losses += 1;
      });

      const computed: TeamStatsTotals = {
        played,
        wins,
        draws,
        losses,
        goalsFor,
        goalsAgainst,
      };

      const override = teamStatOverrides[teamName];
      return override ? { ...computed, ...override } : computed;
    }

    let played = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;

    statsMatches.forEach((match) => {
      const isHome = match.homeTeam.toLowerCase() === teamName;
      const isAway = match.awayTeam.toLowerCase() === teamName;
      if (!isHome && !isAway) return;

      const hasScore = typeof match.homeScore === "number" && typeof match.awayScore === "number";
      const statusIndicatesPlayed = ["finished", "completed", "played", "ft"].includes(match.status);
      if (!statusIndicatesPlayed || !hasScore) return;

      played += 1;
      if (hasScore) {
        const teamGoals = isHome ? (match.homeScore as number) : (match.awayScore as number);
        const oppGoals = isHome ? (match.awayScore as number) : (match.homeScore as number);
        goalsFor += teamGoals;
        goalsAgainst += oppGoals;

        if (teamGoals > oppGoals) wins += 1;
        if (teamGoals === oppGoals) draws += 1;
        if (teamGoals < oppGoals) losses += 1;
      }
    });

    const computed: TeamStatsTotals = {
      played,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
    };

    const override = teamStatOverrides[teamName];
    return override ? { ...computed, ...override } : computed;
  }, [normalizeKey, selectedStatsTeam, statsMatches, teamMatchStats, teamStatOverrides]);

  const selectedPlayerTotals = useMemo(() => {
    if (!selectedStatsPlayer) return null;

    const fullName = `${selectedStatsPlayer.firstName} ${selectedStatsPlayer.lastName}`.trim();
    const identityKey = toPlayerIdentityKey(fullName, selectedStatsPlayer.team || "");
    const base = playerStatsByIdentity.get(identityKey) || {
      minutesPlayed: 0,
      goals: 0,
      yellowCards: 0,
      redCards: 0,
      goalsConceded: 0,
      cleanSheets: 0,
      isGoalkeeper: false,
    };
    const override = playerStatOverrides[identityKey];
    return override ? { ...base, ...override } : base;
  }, [playerStatOverrides, playerStatsByIdentity, selectedStatsPlayer]);

  useEffect(() => {
    if (!selectedTeamStats) {
      setTeamStatsEditDraft(null);
      return;
    }
    setTeamStatsEditDraft(selectedTeamStats);
  }, [selectedTeamStats]);

  useEffect(() => {
    if (!selectedPlayerTotals) {
      setPlayerStatsEditDraft(null);
      return;
    }
    setPlayerStatsEditDraft(selectedPlayerTotals);
  }, [selectedPlayerTotals]);

  const updateTeamDraftField = (field: keyof TeamStatsTotals, value: string) => {
    const parsed = Number.parseInt(value, 10);
    setTeamStatsEditDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: clampNonNegative(Number.isFinite(parsed) ? parsed : 0) };
    });
  };

  const updatePlayerDraftField = (field: keyof PlayerStatsTotals, value: string) => {
    const parsed = Number.parseInt(value, 10);
    setPlayerStatsEditDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: clampNonNegative(Number.isFinite(parsed) ? parsed : 0) };
    });
  };

  const saveTeamStatsOverride = () => {
    if (!selectedStatsTeam || !teamStatsEditDraft || typeof window === "undefined") return;
    const key = normalizeKey(selectedStatsTeam);
    const next = { ...teamStatOverrides, [key]: teamStatsEditDraft };
    setTeamStatOverrides(next);
    localStorage.setItem(ADMIN_TEAM_OVERRIDES_KEY, JSON.stringify(next));
  };

  const clearTeamStatsOverride = () => {
    if (!selectedStatsTeam || typeof window === "undefined") return;
    const key = normalizeKey(selectedStatsTeam);
    const next = { ...teamStatOverrides };
    delete next[key];
    setTeamStatOverrides(next);
    localStorage.setItem(ADMIN_TEAM_OVERRIDES_KEY, JSON.stringify(next));
  };

  const savePlayerStatsOverride = () => {
    if (!selectedStatsPlayer || !playerStatsEditDraft || typeof window === "undefined") return;
    const fullName = `${selectedStatsPlayer.firstName} ${selectedStatsPlayer.lastName}`.trim();
    const key = toPlayerIdentityKey(fullName, selectedStatsPlayer.team || "");
    const next = { ...playerStatOverrides, [key]: playerStatsEditDraft };
    setPlayerStatOverrides(next);
    localStorage.setItem(ADMIN_PLAYER_OVERRIDES_KEY, JSON.stringify(next));
  };

  const clearPlayerStatsOverride = () => {
    if (!selectedStatsPlayer || typeof window === "undefined") return;
    const fullName = `${selectedStatsPlayer.firstName} ${selectedStatsPlayer.lastName}`.trim();
    const key = toPlayerIdentityKey(fullName, selectedStatsPlayer.team || "");
    const next = { ...playerStatOverrides };
    delete next[key];
    setPlayerStatOverrides(next);
    localStorage.setItem(ADMIN_PLAYER_OVERRIDES_KEY, JSON.stringify(next));
  };

  const filteredStatsTeams = useMemo(() => {
    const q = teamStatsSearch.trim().toLowerCase();
    if (!q) return statsTeams;
    return statsTeams.filter((team) => team.name.toLowerCase().includes(q));
  }, [statsTeams, teamStatsSearch]);

  const filteredStatsPlayers = useMemo(() => {
    const q = playerStatsSearch.trim().toLowerCase();
    if (!q) return statsPlayers;
    return statsPlayers.filter((player) => {
      const fullName = `${player.firstName} ${player.lastName}`.trim().toLowerCase();
      const team = (player.team || "").toLowerCase();
      const number = (player.number || "").toLowerCase();
      return fullName.includes(q) || team.includes(q) || number.includes(q);
    });
  }, [statsPlayers, playerStatsSearch]);

  const filteredCompetitions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return competitions;
    return competitions.filter((c) => c.name.toLowerCase().includes(q));
  }, [competitions, search]);

  const statsSummary = useMemo(() => {
    const total = competitions.length;
    const withLogo = competitions.filter((competition) => Boolean(competition.logo)).length;
    const withoutLogo = Math.max(0, total - withLogo);
    const searchHits = filteredCompetitions.length;

    return {
      total,
      withLogo,
      withoutLogo,
      searchHits,
      logoCoverage: total > 0 ? Math.round((withLogo / total) * 100) : 0,
    };
  }, [competitions, filteredCompetitions]);

  const addCompetition = () => {
    if (!newCompName.trim()) return;
    setCompetitions((prev) => [...prev, { name: newCompName.trim(), logo: newCompLogo || "https://via.placeholder.com/80" }]);
    setNewCompName("");
    setNewCompLogo("");
    setCreateOpen(false);
  };

  const removeCompetition = (index: number) => {
    setCompetitions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCompetitionLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setNewCompLogo(URL.createObjectURL(file));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 text-gray-900">
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <motion.h1 
            className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Karpot‑TV Graphics
          </motion.h1>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                Kirjautue {email}
              </span>
            )}
            {isAdmin ? (
              <Button 
                onClick={logout}
                variant="outline"
                className="hover:bg-red-50"
              >
                Kirjaudu ulos
              </Button>
          </div>
        </div>
      </header>

      {!loggedIn && !isStatsView && (
        <motion.section 
          className="max-w-7xl mx-auto px-6 py-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <motion.h2 
            className="text-5xl font-bold mb-6 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            Welcome
          </motion.h2>
          <motion.p 
            className="text-xl text-gray-600 leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            Karpot‑TV’s custom broadcast graphics platform. Please log in to
            access control rooms.
          </motion.p>
        </motion.section>
      )}

      <motion.section 
        className="max-w-7xl mx-auto px-6 py-20 space-y-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
          {!isStatsView ? (
            <motion.div
              className="rounded-3xl border border-gray-200 bg-white/80 p-8 shadow-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
            >
              <h2 className="text-3xl font-bold text-gray-800">Etusivu</h2>
              <p className="mt-3 text-gray-600">
                Kilpailut-osio on poistettu etusivulta. Avaa tilastot ylävalikon kautta tai kirjaudu hallintaan jatkaaksesi.
              </p>
            </motion.div>
          ) : (
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <motion.h2
                className="text-4xl font-bold text-gray-800"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.45 }}
              >
                Tilastot
              </motion.h2>

              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${statsSubTab === "summary" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}
                  onClick={() => setStatsSubTab("summary")}
                >
                  Yhteenveto
                </button>
                <button
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${statsSubTab === "teams" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}
                  onClick={() => setStatsSubTab("teams")}
                >
                  Joukkueet
                </button>
                <button
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${statsSubTab === "players" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}
                  onClick={() => setStatsSubTab("players")}
                >
                  Pelaajat
                </button>
              </div>

              {statsSubTab === "summary" ? (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      <p className="text-sm font-medium text-gray-500">Kilpailut yhteensä</p>
                      <p className="mt-2 text-3xl font-black text-gray-900">{statsSummary.total}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      <p className="text-sm font-medium text-gray-500">Joukkueet</p>
                      <p className="mt-2 text-3xl font-black text-gray-900">{statsTeams.length}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      <p className="text-sm font-medium text-gray-500">Pelaajat</p>
                      <p className="mt-2 text-3xl font-black text-gray-900">{statsPlayers.length}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      <p className="text-sm font-medium text-gray-500">Logojen kattavuus</p>
                      <p className="mt-2 text-3xl font-black text-gray-900">{statsSummary.logoCoverage}%</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Hakutilanne</p>
                    <p className="mt-2 text-lg text-gray-800">
                      Hakuehdolla <span className="font-bold">{search || "(tyhjä)"}</span> löytyy <span className="font-bold">{statsSummary.searchHits}</span> kilpailua.
                    </p>
                  </div>
                </>
              ) : null}

              {statsSubTab === "teams" ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Joukkueet ({statsTeams.length})</p>

                  <div className="mt-3 max-w-md">
                    <Input
                      placeholder="Hae joukkueita"
                      value={teamStatsSearch}
                      onChange={(event) => setTeamStatsSearch(event.target.value)}
                    />
                  </div>

                  {selectedStatsTeam && selectedTeamStats ? (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm font-semibold uppercase tracking-wide text-blue-800">{selectedStatsTeam}</p>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                        <div className="rounded-lg bg-white p-3">
                          <p className="text-xs font-semibold text-gray-500">Pelatut ottelut</p>
                          <p className="mt-1 text-2xl font-black text-gray-900">{selectedTeamStats.played}</p>
                        </div>
                        <div className="rounded-lg bg-white p-3">
                          <p className="text-xs font-semibold text-gray-500">Voitot</p>
                          <p className="mt-1 text-2xl font-black text-gray-900">{selectedTeamStats.wins}</p>
                        </div>
                        <div className="rounded-lg bg-white p-3">
                          <p className="text-xs font-semibold text-gray-500">Tasapelit</p>
                          <p className="mt-1 text-2xl font-black text-gray-900">{selectedTeamStats.draws}</p>
                        </div>
                        <div className="rounded-lg bg-white p-3">
                          <p className="text-xs font-semibold text-gray-500">Häviöt</p>
                          <p className="mt-1 text-2xl font-black text-gray-900">{selectedTeamStats.losses}</p>
                        </div>
                        <div className="rounded-lg bg-white p-3">
                          <p className="text-xs font-semibold text-gray-500">Tehdyt maalit</p>
                          <p className="mt-1 text-2xl font-black text-gray-900">{selectedTeamStats.goalsFor}</p>
                        </div>
                        <div className="rounded-lg bg-white p-3">
                          <p className="text-xs font-semibold text-gray-500">Päästetyt maalit</p>
                          <p className="mt-1 text-2xl font-black text-gray-900">{selectedTeamStats.goalsAgainst}</p>
                        </div>
                      </div>

                      {canEditStats && teamStatsEditDraft ? (
                        <div className="mt-4 rounded-lg border border-blue-300 bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Admin: Muokkaa joukkuetilastoja</p>
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                            <Input type="number" min={0} value={String(teamStatsEditDraft.played)} onChange={(event) => updateTeamDraftField("played", event.target.value)} placeholder="Pelatut" />
                            <Input type="number" min={0} value={String(teamStatsEditDraft.wins)} onChange={(event) => updateTeamDraftField("wins", event.target.value)} placeholder="Voitot" />
                            <Input type="number" min={0} value={String(teamStatsEditDraft.draws)} onChange={(event) => updateTeamDraftField("draws", event.target.value)} placeholder="Tasapelit" />
                            <Input type="number" min={0} value={String(teamStatsEditDraft.losses)} onChange={(event) => updateTeamDraftField("losses", event.target.value)} placeholder="Häviöt" />
                            <Input type="number" min={0} value={String(teamStatsEditDraft.goalsFor)} onChange={(event) => updateTeamDraftField("goalsFor", event.target.value)} placeholder="Tehdyt" />
                            <Input type="number" min={0} value={String(teamStatsEditDraft.goalsAgainst)} onChange={(event) => updateTeamDraftField("goalsAgainst", event.target.value)} placeholder="Päästetyt" />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button type="button" onClick={saveTeamStatsOverride} className="bg-blue-600 hover:bg-blue-700">Tallenna</Button>
                            <Button type="button" variant="outline" onClick={clearTeamStatsOverride}>Poista muokkaus</Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredStatsTeams.length === 0 ? (
                      <p className="text-gray-600">Hakua vastaavia joukkueita ei löytynyt.</p>
                    ) : (
                      filteredStatsTeams.map((team) => (
                        <div key={team.name} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                          {team.logo
                            ? <img src={team.logo} alt={team.name} className="h-10 w-10 rounded-full object-contain bg-white" />
                            : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-700">{team.name.slice(0, 1)}</div>
                          }
                          <button
                            type="button"
                            className="truncate text-left text-sm font-semibold text-gray-800 hover:text-blue-700"
                            onClick={() => setSelectedStatsTeam(team.name)}
                          >
                            {team.name}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              {statsSubTab === "players" ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Pelaajat ({statsPlayers.length})</p>
                  <p className="mt-2 text-sm text-gray-600">Paina pelaajan logoa avataksesi tilastot.</p>

                  <div className="mt-3 max-w-md">
                    <Input
                      placeholder="Hae pelaajia tai joukkueita"
                      value={playerStatsSearch}
                      onChange={(event) => setPlayerStatsSearch(event.target.value)}
                    />
                  </div>

                  {selectedStatsPlayer ? (() => {
                    const fullName = `${selectedStatsPlayer.firstName} ${selectedStatsPlayer.lastName}`.trim();
                    return (
                      <div className="mt-5 rounded-xl border border-gray-200 bg-[#f3f4f6] p-3">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[180px_1fr]">
                          <div className="rounded-md bg-white p-2 shadow-sm">
                            <div className="flex h-[176px] items-center justify-center rounded-md bg-[#eeeeee]">
                              {selectedStatsPlayer.photo
                                ? <img src={selectedStatsPlayer.photo} alt={fullName} className="h-full w-full rounded-md object-cover" />
                                : <div className="flex h-full w-full items-center justify-center rounded-md bg-gray-200 text-4xl font-black text-gray-500">{fullName.slice(0, 1) || "?"}</div>
                              }
                            </div>
                            <p className="mt-3 text-lg font-semibold text-gray-900">{selectedStatsPlayer.firstName || "-"}</p>
                            <p className="text-[30px] font-black uppercase italic leading-tight text-gray-900">{selectedStatsPlayer.lastName || "-"}</p>
                            <p className="mt-1 text-lg font-semibold text-gray-900">{selectedStatsPlayer.number || "-"}</p>
                          </div>

                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                              <div className="rounded-md bg-white px-3 py-2">
                                <p className="text-[11px] font-semibold text-gray-500">Peliaika</p>
                                <p className="text-2xl font-black text-gray-900">{selectedPlayerTotals?.minutesPlayed ?? 0}</p>
                              </div>
                              <div className="rounded-md bg-white px-3 py-2">
                                <p className="text-[11px] font-semibold text-gray-500">Tehdyt maalit</p>
                                <p className="text-2xl font-black text-gray-900">{selectedPlayerTotals?.goals ?? 0}</p>
                              </div>
                              <div className="rounded-md bg-white px-3 py-2">
                                <p className="text-[11px] font-semibold text-gray-500">Keltaiset kortit</p>
                                <p className="text-2xl font-black text-gray-900">{selectedPlayerTotals?.yellowCards ?? 0}</p>
                              </div>
                              <div className="rounded-md bg-white px-3 py-2">
                                <p className="text-[11px] font-semibold text-gray-500">Punaiset kortit</p>
                                <p className="text-2xl font-black text-gray-900">{selectedPlayerTotals?.redCards ?? 0}</p>
                              </div>
                              <div className="rounded-md bg-white px-3 py-2">
                                <p className="text-[11px] font-semibold text-gray-500">Päästetyt maalit (MV)</p>
                                <p className="text-2xl font-black text-gray-900">{selectedPlayerTotals?.isGoalkeeper ? selectedPlayerTotals.goalsConceded : "-"}</p>
                              </div>
                              <div className="rounded-md bg-white px-3 py-2">
                                <p className="text-[11px] font-semibold text-gray-500">Nollapelit (MV)</p>
                                <p className="text-2xl font-black text-gray-900">{selectedPlayerTotals?.isGoalkeeper ? selectedPlayerTotals.cleanSheets : "-"}</p>
                              </div>
                            </div>

                            {canEditStats && playerStatsEditDraft ? (
                              <div className="rounded-md border border-blue-300 bg-white p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Admin: Muokkaa pelaajatilastoja</p>
                                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                                  <Input type="number" min={0} value={String(playerStatsEditDraft.minutesPlayed)} onChange={(event) => updatePlayerDraftField("minutesPlayed", event.target.value)} placeholder="Peliaika" />
                                  <Input type="number" min={0} value={String(playerStatsEditDraft.goals)} onChange={(event) => updatePlayerDraftField("goals", event.target.value)} placeholder="Maalit" />
                                  <Input type="number" min={0} value={String(playerStatsEditDraft.yellowCards)} onChange={(event) => updatePlayerDraftField("yellowCards", event.target.value)} placeholder="Keltaiset" />
                                  <Input type="number" min={0} value={String(playerStatsEditDraft.redCards)} onChange={(event) => updatePlayerDraftField("redCards", event.target.value)} placeholder="Punaiset" />
                                  <Input type="number" min={0} value={String(playerStatsEditDraft.goalsConceded)} onChange={(event) => updatePlayerDraftField("goalsConceded", event.target.value)} placeholder="Päästetyt" />
                                  <Input type="number" min={0} value={String(playerStatsEditDraft.cleanSheets)} onChange={(event) => updatePlayerDraftField("cleanSheets", event.target.value)} placeholder="Nollapelit" />
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button type="button" onClick={savePlayerStatsOverride} className="bg-blue-600 hover:bg-blue-700">Tallenna</Button>
                                  <Button type="button" variant="outline" onClick={clearPlayerStatsOverride}>Poista muokkaus</Button>
                                </div>
                              </div>
                            ) : null}

                            <div className="h-12 rounded-md bg-[#dfe6ef]" />
                          </div>
                        </div>
                      </div>
                    );
                  })() : null}

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {filteredStatsPlayers.length === 0 ? (
                      <p className="text-gray-600">Hakua vastaavia pelaajia ei löytynyt.</p>
                    ) : (
                      filteredStatsPlayers.map((player) => {
                        const fullName = `${player.firstName} ${player.lastName}`.trim();
                        const identityKey = toPlayerIdentityKey(fullName, player.team || "");
                        const isSelected = selectedStatsPlayerKey === identityKey;
                        return (
                          <button
                            type="button"
                            key={`${player.firstName}-${player.lastName}-${player.team}-${player.number}`}
                            className={`rounded-xl border px-3 py-3 text-left transition ${isSelected ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50 hover:border-blue-200"}`}
                            onClick={() => setSelectedStatsPlayerKey(identityKey)}
                          >
                            <div className="flex items-center gap-3">
                              {player.photo
                                ? <img src={player.photo} alt={fullName} className="h-12 w-12 rounded-full object-cover bg-white" />
                                : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-700">{fullName.slice(0, 1) || "?"}</div>
                              }
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-900">{fullName}</p>
                                <p className="truncate text-xs text-gray-600">{player.team || "-"}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}

          {createOpen && loggedIn && (
            <motion.div 
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div 
                className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="text-2xl font-bold mb-4">Create Competition</h3>
                <div className="space-y-4">
                  <Input
                    placeholder="Competition name"
                    value={newCompName}
                    onChange={(e) => setNewCompName(e.target.value)}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCompetitionLogoUpload}
                    className="w-full bg-white border border-gray-300 p-3 rounded-lg file:bg-blue-50 file:text-blue-700 file:border-0 file:rounded file:px-3 file:py-1"
                  />
                  {newCompLogo && (
                    <img src={newCompLogo} alt="Logo preview" className="w-24 h-24 rounded-full border-4 border-white shadow-lg" />
                  )}
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <Button onClick={() => setCreateOpen(false)} variant="outline">Cancel</Button>
                  <Button onClick={addCompetition} className="bg-red-600 hover:bg-red-700">Create</Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </motion.section>

      {adminOpen && (
        <motion.div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="bg-white p-8 rounded-2xl max-w-md w-full mx-4 shadow-2xl"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-2xl font-bold mb-6 text-center">Admin Login</h3>
            <div className="space-y-4">
              <Input placeholder="Username" value={email} onChange={e=>setEmail(e.target.value)} className="w-full"/>
              <Input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full"/>
              <button onClick={login} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg">Login</button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <motion.footer 
        className="max-w-7xl mx-auto px-6 py-10 text-gray-700 text-sm text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        © {new Date().getFullYear()} Broadcast Graphics System
      </motion.footer>
    </div>
  );
}

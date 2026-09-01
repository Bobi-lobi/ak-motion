"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleHelp, Clock, Flag, Lock, Medal, Sparkles, Trophy, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { useApp } from "@/components/app-provider";
import {
  calculatePlayerScores,
  eventTypeXpLimits,
  questDefinitions,
  rankLadder,
  roleXp,
  type PlayerScore,
  type QuestProgress
} from "@/lib/gamification";

export default function RankingsPage() {
  const { data, session } = useApp();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [helpOpen, setHelpOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [claimedQuestIds, setClaimedQuestIds] = useState<string[]>([]);
  const [claimAnimation, setClaimAnimation] = useState<{ id: string; xp: number } | null>(null);

  const claimStorageKey = session?.id ? `ak-motion-claimed-quests:${session.id}:${year}` : "";

  useEffect(() => {
    if (!claimStorageKey) {
      setClaimedQuestIds([]);
      return;
    }
    try {
      const parsed = JSON.parse(window.localStorage.getItem(claimStorageKey) ?? "[]");
      setClaimedQuestIds(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
    } catch {
      setClaimedQuestIds([]);
    }
  }, [claimStorageKey]);

  function claimQuest(quest: QuestProgress) {
    if (!session || quest.current < quest.goal || claimedQuestIds.includes(quest.id)) {
      return;
    }
    const next = [...claimedQuestIds, quest.id];
    setClaimedQuestIds(next);
    if (claimStorageKey) {
      window.localStorage.setItem(claimStorageKey, JSON.stringify(next));
    }
    setClaimAnimation({ id: `${quest.id}-${Date.now()}`, xp: quest.bonusXp });
    window.setTimeout(() => setClaimAnimation(null), 950);
  }

  const years = useMemo(() => {
    const allYears = new Set([currentYear, ...data.events.map((event) => new Date(event.startsAt).getFullYear())]);
    return Array.from(allYears).sort((a, b) => b - a);
  }, [currentYear, data.events]);

  const scores = useMemo(() => calculatePlayerScores(data.profiles, data.events, data.assignments, data.attendance, year, session?.id ? { [session.id]: claimedQuestIds } : {}), [
    data.assignments,
    data.attendance,
    data.events,
    data.profiles,
    claimedQuestIds,
    session?.id,
    year
  ]);

  const currentPlayer = scores.find((score) => score.profile.id === session?.id) ?? scores[0] ?? null;
  const podium = scores.slice(0, 3);

  return (
    <RouteGuard>
      <AppShell title="Level" eyebrow="Technik-Liga" contentClassName="ranking-page" titleIcon={<Trophy size={30} />}>
        <section className="ranking-hero">
          <div className="ranking-hero-copy">
            <span className="eyebrow">Saison {year}</span>
            <h2>XP sammeln, Titel freischalten, Einsatz zeigen.</h2>
            <p>
              XP entstehen aus abgeschlossenen Veranstaltungen. Titel zeigen, wer zuverlässig dabei ist und Verantwortung übernimmt.
            </p>
          </div>
          <button className="icon-button ranking-help-button" type="button" aria-label="XP-Regeln anzeigen" onClick={() => setHelpOpen(true)}>
            <CircleHelp size={20} />
          </button>
          <div className="ranking-hero-actions">
            <label className="select-label ranking-year-select">
              Jahr
              <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
                {years.map((yearItem) => (
                  <option key={yearItem} value={yearItem}>
                    {yearItem}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="ranking-arena">
          <PlayerStatus score={currentPlayer} />
          <TrophyRoad points={currentPlayer?.points ?? 0} />
        </section>

        {podium.length ? <Podium scores={podium} /> : null}

        <section className="ranking-layout">
          <article className="ranking-board">
            <div className="ranking-section-head">
              <div>
                <span className="eyebrow">Rangliste</span>
                <h2>Technik-Liga</h2>
              </div>
              <span className="ranking-count">{scores.length} Spieler</span>
            </div>

            <div className="ranking-table">
              {scores.map((score, index) => (
                <div className="ranking-row" key={score.profile.id}>
                  <span className="ranking-position">{index + 1}</span>
                  <span className="profile-avatar">
                    <PizzaHatAvatar score={score} />
                  </span>
                  <div className="ranking-person">
                    <strong>{score.profile.name}</strong>
                    <span>{score.rank}</span>
                  </div>
                  <div className="ranking-metrics">
                    <span>{score.completedEvents} Einsätze</span>
                    <strong>{score.points} XP</strong>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <QuestPanel quests={currentPlayer?.activeQuests ?? []} onClaim={claimQuest} onShowCompleted={() => setCompletedOpen(true)} />
        </section>

        {helpOpen ? <XpHelpModal onClose={() => setHelpOpen(false)} /> : null}
        {completedOpen ? <CompletedQuestsModal score={currentPlayer} onClose={() => setCompletedOpen(false)} /> : null}
        {claimAnimation ? (
          <div className="quest-claim-fly" key={claimAnimation.id}>
            <Sparkles size={18} />
            +{claimAnimation.xp} XP
          </div>
        ) : null}
      </AppShell>
    </RouteGuard>
  );
}

function PlayerStatus({ score }: { score: PlayerScore | null }) {
  if (!score) {
    return (
      <article className="player-rank-panel empty">
        <span className="game-icon">
          <Trophy size={22} />
        </span>
        <h3>Noch keine XP</h3>
        <p>Sobald abgeschlossene Einteilungen vorhanden sind, startet der Fortschritt.</p>
      </article>
    );
  }

  return (
    <article className="player-rank-panel">
      <div className="player-rank-topline">
        <span className="profile-avatar podium-avatar">
          <PizzaHatAvatar score={score} />
        </span>
        <div>
          <span className="eyebrow">Dein Titel</span>
          <h3>{score.rank}</h3>
        </div>
      </div>

      <div className="player-xp-number">
        <strong>{score.points}</strong>
        <span>XP</span>
      </div>

      <div className="rank-progress-line">
        <div>
          <span>{score.rank}</span>
          <span>{score.nextRank ? score.nextRank.name : "Maximaler Titel"}</span>
        </div>
        <div className="xp-bar" aria-label={`Fortschritt ${score.nextProgress} Prozent`}>
          <span style={{ width: `${score.nextProgress}%` }} />
        </div>
        <p>
          {score.nextRank
            ? `${score.nextRank.min - score.points} XP bis zum nächsten Titel`
            : "Du hast den letzten Titel dieser Saison erreicht."}
        </p>
      </div>

      <div className="player-stat-strip">
        <span>{score.completedEvents} Einsätze</span>
        <span>{score.realEvents} Events</span>
        {score.hasPizzaHat ? <span>Pizza Essen frei</span> : null}
        <span>+{score.questBonus} Quest-XP</span>
      </div>
    </article>
  );
}

function TrophyRoad({ points }: { points: number }) {
  const currentRank = [...rankLadder].reverse().find((rank) => points >= rank.min) ?? rankLadder[0];

  return (
    <article className="trophy-road">
      <div className="ranking-section-head">
        <div>
          <span className="eyebrow">Titelpfad</span>
          <h2>Freischaltungen</h2>
        </div>
        <Medal size={22} />
      </div>
      <div className="trophy-road-path" aria-label="Titelpfad">
        {rankLadder.map((rank, index) => {
          const unlocked = points >= rank.min;
          const current = rank.name === currentRank.name;
          return (
            <div className={`trophy-node${unlocked ? " unlocked" : ""}${current ? " current" : ""}`} key={rank.name}>
              <span className="trophy-dot">{unlocked ? <Trophy size={17} /> : <Lock size={15} />}</span>
              <strong>{rank.name}</strong>
              <small>{rank.min} XP</small>
              {index < rankLadder.length - 1 ? <span className="trophy-connector" aria-hidden="true" /> : null}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function QuestPanel({ onClaim, onShowCompleted, quests }: { onClaim: (quest: QuestProgress) => void; onShowCompleted: () => void; quests: QuestProgress[] }) {
  return (
    <aside className="quest-stage-panel">
      <div className="quest-stage-header">
        <div>
          <span className="eyebrow">Aktive Quests</span>
          <h2>Nächste Aufgaben</h2>
          <p>Erfüllte Quests kannst du abholen. Danach verschwindet die Quest und die nächste schwerere Aufgabe rückt nach.</p>
        </div>
      </div>

      {quests.length ? (
        <>
          <div className="quest-list">
            {quests.map((quest) => (
              <QuestLine key={quest.id} onClaim={onClaim} quest={quest} />
            ))}
          </div>
        </>
      ) : (
        <p className="muted">Alle Quests abgeschlossen. Neue Endgame-Quests können später ergänzt werden.</p>
      )}
      <button className="secondary-button completed-quest-button" type="button" onClick={onShowCompleted}>
        <CheckCircle2 size={16} />
        Abgeschlossene Quests
      </button>
    </aside>
  );
}

function QuestLine({ onClaim, quest }: { onClaim: (quest: QuestProgress) => void; quest: QuestProgress }) {
  const done = quest.current >= quest.goal;

  return (
    <article className={`quest-line${done ? " done" : ""}`}>
      <div className="quest-line-main">
        <span className="quest-icon">{done ? <CheckCircle2 size={18} /> : quest.metric === "afterSchool" ? <Clock size={18} /> : <Flag size={18} />}</span>
        <div>
          <h3>{quest.title}</h3>
          <p>{quest.description}</p>
        </div>
      </div>
      <div className="quest-line-progress">
        <strong>
          {Math.min(quest.current, quest.goal)}/{quest.goal} {quest.unit}
        </strong>
        <span>+{quest.bonusXp} XP</span>
      </div>
      <div className="xp-bar small" aria-label={`Questfortschritt ${quest.progress} Prozent`}>
        <span style={{ width: `${quest.progress}%` }} />
      </div>
      {done ? (
        <button className="button compact quest-claim-button" type="button" onClick={() => onClaim(quest)}>
          <Sparkles size={15} />
          XP abholen
        </button>
      ) : null}
    </article>
  );
}

function Podium({ scores }: { scores: PlayerScore[] }) {
  const orderedPlaces = [
    { score: scores[1], place: 2 },
    { score: scores[0], place: 1 },
    { score: scores[2], place: 3 }
  ].filter((item): item is { score: PlayerScore; place: number } => Boolean(item.score));

  return (
    <section className="podium-stage" aria-label="Top 3">
      {orderedPlaces.map(({ place, score }) => (
        <article className={`podium-player place-${place}`} key={score.profile.id}>
          <div className="podium-player-card">
            <span className="podium-medal">#{place}</span>
            <span className="profile-avatar podium-avatar">
              <PizzaHatAvatar score={score} />
            </span>
            <h3>{score.profile.name}</h3>
            <strong>{score.points} XP</strong>
            <span>{score.rank}</span>
          </div>
          <div className="podium-block">
            <span>{place}</span>
          </div>
        </article>
      ))}
    </section>
  );
}

function CompletedQuestsModal({ onClose, score }: { onClose: () => void; score: PlayerScore | null }) {
  const completed = score?.completedQuests ?? [];

  return (
    <div className="page-modal-backdrop xp-help-backdrop" role="presentation" onClick={onClose}>
      <section className="completed-quests-modal" role="dialog" aria-modal="true" aria-label="Abgeschlossene Quests" onClick={(event) => event.stopPropagation()}>
        <header className="profile-modal-head">
          <div>
            <span className="eyebrow">Archiv</span>
            <h2>Abgeschlossene Quests</h2>
          </div>
          <button className="icon-button ghost" type="button" aria-label="Schließen" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        {completed.length ? (
          <div className="completed-quest-list">
            {completed.map((stage) => (
              <article className="completed-quest-entry" key={stage.id}>
                <span className="quest-icon">
                  <CheckCircle2 size={18} />
                </span>
                <div>
                  <strong>{stage.title}</strong>
                  <p>{stage.completedAtLabel} · +{stage.bonusXp} XP</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Noch keine Quest abgeschlossen.</p>
        )}
      </section>
    </div>
  );
}

function XpHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="page-modal-backdrop xp-help-backdrop" role="presentation" onClick={onClose}>
      <section className="xp-help-modal" role="dialog" aria-modal="true" aria-label="XP-Regeln" onClick={(event) => event.stopPropagation()}>
        <header className="profile-modal-head">
          <div>
            <span className="eyebrow">XP-Regeln</span>
            <h2>So funktioniert das Levelsystem</h2>
          </div>
          <button className="icon-button ghost" type="button" aria-label="Schließen" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="xp-help-grid">
          <article>
            <h3>Veranstaltungs-XP</h3>
            <p>Der Veranstaltungstyp setzt den Maximalwert. Rolle, Dauer, Start nach 14:00 Uhr und Anwesenheit füllen diesen Wert auf.</p>
            <ul>
              {eventTypeXpLimits.map((item) => (
                <li key={item.type}>
                  <span>{item.type}</span>
                  <strong>max. {item.xp} XP</strong>
                </li>
              ))}
            </ul>
          </article>
          <article>
            <h3>Rollen-XP</h3>
            <ul>
              {Object.entries(roleXp).map(([role, xp]) => (
                <li key={role}>
                  <span>{role}</span>
                  <strong>+{xp} XP</strong>
                </li>
              ))}
              <li>
                <span>Anwesenheit markiert</span>
                <strong>+20 XP</strong>
              </li>
            </ul>
          </article>
          <article>
            <h3>Quest-Kette</h3>
            <p>Alle Techniker bekommen denselben Questpfad. Erfüllte Quests geben erst nach dem Abholen Bonus-XP und schalten danach die nächste schwerere Quest frei.</p>
            <ul>
              {questDefinitions.map((quest) => (
                <li key={quest.id}>
                  <span>{quest.title}</span>
                  <strong>+{quest.bonusXp} XP</strong>
                </li>
              ))}
            </ul>
          </article>
          <article>
            <h3>Titelpfad</h3>
            <ul>
              {rankLadder.map((rank) => (
                <li key={rank.name}>
                  <span>{rank.name}</span>
                  <strong>ab {rank.min} XP</strong>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}

function PizzaHatAvatar({ score }: { score: PlayerScore }) {
  return (
    <>
      {score.profile.avatarUrl ? <img src={score.profile.avatarUrl} alt="" /> : initials(score.profile.name)}
      {score.hasPizzaHat ? <span className="pizza-hat" aria-label="Pizza Essen freigeschaltet">🍕</span> : null}
    </>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

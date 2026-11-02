---- MODULE GamePhase ----
EXTENDS Naturals

CONSTANT MaxPopups

VARIABLES phase, focused, popups, audio

Phases == {"menu", "cutscene", "cinematic", "playing", "levelup", "paused", "lost"}
vars == <<phase, focused, popups, audio>>

AudioFor(p) == IF p \in {"paused", "levelup"} THEN "silent" ELSE "on"

TypeOK ==
  /\ phase \in Phases
  /\ focused \in BOOLEAN
  /\ popups \in 0..MaxPopups
  /\ audio \in {"on", "silent"}

Init ==
  /\ phase = "menu"
  /\ focused = TRUE
  /\ popups = 0
  /\ audio = "on"

Go(p) == phase' = p /\ audio' = AudioFor(p)

StartFromTitle == focused /\ phase = "menu" /\ Go("cutscene") /\ popups' = 0 /\ UNCHANGED focused
IntroEnds == focused /\ phase = "cutscene" /\ Go("cinematic") /\ UNCHANGED <<focused, popups>>
Landed == focused /\ phase = "cinematic" /\ Go("playing") /\ UNCHANGED <<focused, popups>>
BossEntrance == focused /\ phase = "playing" /\ Go("cinematic") /\ UNCHANGED <<focused, popups>>
SecondWallet == focused /\ phase = "playing" /\ Go("cutscene") /\ UNCHANGED <<focused, popups>>
SecondWalletEnds == focused /\ phase = "cutscene" /\ Go("playing") /\ UNCHANGED <<focused, popups>>
Pause == focused /\ phase = "playing" /\ Go("paused") /\ UNCHANGED <<focused, popups>>
Resume == phase = "paused" /\ Go("playing") /\ focused' = TRUE /\ UNCHANGED popups
LevelUp == focused /\ phase = "playing" /\ Go("levelup") /\ UNCHANGED <<focused, popups>>
QueuePopup == focused /\ phase = "playing" /\ popups < MaxPopups /\ popups' = popups + 1 /\ UNCHANGED <<phase, focused, audio>>
OpenPopup == focused /\ phase = "playing" /\ popups > 0 /\ popups' = popups - 1 /\ Go("levelup") /\ UNCHANGED focused
PickCard == phase = "levelup" /\ Go("playing") /\ focused' = TRUE /\ UNCHANGED popups
Die == focused /\ phase = "playing" /\ Go("lost") /\ UNCHANGED <<focused, popups>>
Restart == phase = "lost" /\ Go("cinematic") /\ popups' = 0 /\ focused' = TRUE
QuitToTitle == phase \in {"paused", "lost"} /\ Go("menu") /\ popups' = 0 /\ focused' = TRUE

Blur ==
  /\ focused
  /\ focused' = FALSE
  /\ phase' = IF phase = "playing" THEN "paused" ELSE phase
  /\ audio' = AudioFor(phase')
  /\ UNCHANGED popups

Focus == ~focused /\ focused' = TRUE /\ UNCHANGED <<phase, popups, audio>>

Next ==
  \/ StartFromTitle \/ IntroEnds \/ Landed \/ BossEntrance \/ SecondWallet \/ SecondWalletEnds
  \/ Pause \/ Resume \/ LevelUp \/ QueuePopup \/ OpenPopup \/ PickCard
  \/ Die \/ Restart \/ QuitToTitle \/ Blur \/ Focus

Spec == Init /\ [][Next]_vars /\ WF_vars(Focus) /\ WF_vars(PickCard) /\ WF_vars(OpenPopup)

SilentWhileFrozen == phase \in {"paused", "levelup"} => audio = "silent"
NeverPlayingUnfocused == phase = "playing" => focused
NoPopupsOnTitle == phase = "menu" => popups = 0

PopupAlwaysCloses == phase = "levelup" ~> phase # "levelup"
FocusReturns == ~focused ~> focused
====

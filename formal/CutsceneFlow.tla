---- MODULE CutsceneFlow ----
EXTENDS Naturals

CONSTANT BossCycle

VARIABLES scene, bossIndex, victoryShown, alive

vars == <<scene, bossIndex, victoryShown, alive>>

TypeOK ==
  /\ scene \in {"none", "intro", "boss", "victory"}
  /\ bossIndex \in 0..BossCycle
  /\ victoryShown \in BOOLEAN
  /\ alive \in BOOLEAN

Init ==
  /\ scene = "intro"
  /\ bossIndex = 0
  /\ victoryShown = FALSE
  /\ alive = TRUE

IntroEnds == scene = "intro" /\ scene' = "none" /\ UNCHANGED <<bossIndex, victoryShown, alive>>

BossEnters ==
  /\ scene = "none" /\ alive
  /\ scene' = "boss"
  /\ bossIndex' = (bossIndex + 1) % BossCycle
  /\ UNCHANGED <<victoryShown, alive>>

BossSettled == scene = "boss" /\ scene' = "none" /\ UNCHANGED <<bossIndex, victoryShown, alive>>

VictoryPlays ==
  /\ scene = "none" /\ alive /\ ~victoryShown
  /\ scene' = "victory"
  /\ victoryShown' = TRUE
  /\ UNCHANGED <<bossIndex, alive>>

VictoryEnds == scene = "victory" /\ scene' = "none" /\ UNCHANGED <<bossIndex, victoryShown, alive>>

Die == scene = "none" /\ alive /\ alive' = FALSE /\ UNCHANGED <<scene, bossIndex, victoryShown>>

NewRun ==
  /\ ~alive
  /\ alive' = TRUE
  /\ scene' = "intro"
  /\ bossIndex' = 0
  /\ victoryShown' = FALSE

Next == IntroEnds \/ BossEnters \/ BossSettled \/ VictoryPlays \/ VictoryEnds \/ Die \/ NewRun

Spec == Init /\ [][Next]_vars /\ WF_vars(IntroEnds) /\ WF_vars(BossSettled) /\ WF_vars(VictoryEnds)

NoSceneWhileDead == ~alive => scene = "none"
EveryCutsceneEnds == scene # "none" ~> scene = "none"
====

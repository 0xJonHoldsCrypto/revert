---- MODULE CutsceneFlow ----
EXTENDS Naturals

CONSTANT BossCycle

VARIABLES scene, bossIndex, secondWalletShown, alive

vars == <<scene, bossIndex, secondWalletShown, alive>>

TypeOK ==
  /\ scene \in {"none", "intro", "boss", "second_wallet"}
  /\ bossIndex \in 0..BossCycle
  /\ secondWalletShown \in BOOLEAN
  /\ alive \in BOOLEAN

Init ==
  /\ scene = "intro"
  /\ bossIndex = 0
  /\ secondWalletShown = FALSE
  /\ alive = TRUE

IntroEnds == scene = "intro" /\ scene' = "none" /\ UNCHANGED <<bossIndex, secondWalletShown, alive>>

BossEnters ==
  /\ scene = "none" /\ alive
  /\ scene' = "boss"
  /\ bossIndex' = (bossIndex + 1) % BossCycle
  /\ UNCHANGED <<secondWalletShown, alive>>

BossSettled == scene = "boss" /\ scene' = "none" /\ UNCHANGED <<bossIndex, secondWalletShown, alive>>

SecondWalletPlays ==
  /\ scene = "none" /\ alive /\ ~secondWalletShown
  /\ scene' = "second_wallet"
  /\ secondWalletShown' = TRUE
  /\ UNCHANGED <<bossIndex, alive>>

SecondWalletEnds == scene = "second_wallet" /\ scene' = "none" /\ UNCHANGED <<bossIndex, secondWalletShown, alive>>

Die == scene = "none" /\ alive /\ alive' = FALSE /\ UNCHANGED <<scene, bossIndex, secondWalletShown>>

NewRun ==
  /\ ~alive
  /\ alive' = TRUE
  /\ scene' = "intro"
  /\ bossIndex' = 0
  /\ secondWalletShown' = FALSE

Next == IntroEnds \/ BossEnters \/ BossSettled \/ SecondWalletPlays \/ SecondWalletEnds \/ Die \/ NewRun

Spec == Init /\ [][Next]_vars /\ WF_vars(IntroEnds) /\ WF_vars(BossSettled) /\ WF_vars(SecondWalletEnds)

NoSceneWhileDead == ~alive => scene = "none"
EveryCutsceneEnds == scene # "none" ~> scene = "none"
====

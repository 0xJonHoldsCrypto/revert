---- MODULE GamePhase ----
EXTENDS Naturals

VARIABLES phase, hp, elapsed

Phases == {"menu", "playing", "levelup", "paused", "won", "lost"}

TypeOK ==
  /\\ phase \\in Phases
  /\\ hp \\in Nat
  /\\ elapsed \\in Nat

Init ==
  /\\ phase = "menu"
  /\\ hp = 100
  /\\ elapsed = 0

StartRun ==
  /\\ phase = "menu"
  /\\ phase' = "playing"
  /\\ hp' = 100
  /\\ elapsed' = 0
  /\\ UNCHANGED <<>>

Pause ==
  /\\ phase = "playing"
  /\\ phase' = "paused"
  /\\ UNCHANGED <<hp, elapsed>>

Unpause ==
  /\\ phase = "paused"
  /\\ phase' = "playing"
  /\\ UNCHANGED <<hp, elapsed>>

LevelUp ==
  /\\ phase = "playing"
  /\\ phase' = "levelup"
  /\\ UNCHANGED <<hp, elapsed>>

ResumeFromLevelUp ==
  /\\ phase = "levelup"
  /\\ phase' = "playing"
  /\\ UNCHANGED <<hp, elapsed>>

Tick ==
  /\\ phase = "playing"
  /\\ elapsed' = elapsed + 1
  /\\ UNCHANGED <<phase, hp>>

Damage ==
  /\\ phase = "playing"
  /\\ hp > 0
  /\\ hp' = hp - 1
  /\\ UNCHANGED <<phase, elapsed>>

Death ==
  /\\ phase = "playing"
  /\\ hp = 0
  /\\ phase' = "lost"
  /\\ UNCHANGED <<elapsed>>

Win ==
  /\\ phase = "playing"
  /\\ elapsed = 1200
  /\\ phase' = "won"
  /\\ UNCHANGED <<hp>>

Next ==
  \\/ StartRun
  \\/ Pause
  \\/ Unpause
  \\/ LevelUp
  \\/ ResumeFromLevelUp
  \\/ Tick
  \\/ Damage
  \\/ Death
  \\/ Win

Spec == Init /\\ [][Next]_<<phase, hp, elapsed>>

NoMenuPlaying ==
  ~(phase = "menu" /\\ elapsed > 0)

THEOREM Spec => []TypeOK
====
